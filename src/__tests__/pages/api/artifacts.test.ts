/**
 * @jest-environment node
 */
import type { NextApiResponse } from "next";

import type { NextIronRequest } from "../../../lib/with-session";
import { handleDocuments } from "../../../pages/api/documents";
import { handleExports } from "../../../pages/api/exports";
import { handleExport } from "../../../pages/api/exports/[id]";
import { handleExportDownloadUrl } from "../../../pages/api/exports/[id]/download-url";
import {
  exportIdFromLocation,
  handleQueuedExport,
} from "../../../pages/api/queued-exports/[id]";

const mockClient = jest.fn();
const createExport = jest.fn();
const getExport = jest.fn();
const getQueuedExport = jest.fn();
const getFile = jest.fn();
const getDocuments = jest.fn();
const createDocument = jest.fn();

jest.mock("../../../lib/vertex-api", () => {
  const actual = jest.requireActual("../../../lib/vertex-api");
  return { ...actual, getClientFromSession: () => mockClient() };
});

interface TestResponse
  extends Pick<NextApiResponse, "json" | "setHeader" | "status"> {
  readonly body: () => unknown;
  readonly headers: () => Record<string, string>;
  readonly statusCode: () => number | undefined;
}

function response(): TestResponse {
  let body: unknown;
  let statusCode: number | undefined;
  const headers: Record<string, string> = {};
  const res = {
    body: () => body,
    headers: () => headers,
    json: jest.fn((value: unknown) => {
      body = value;
      return res;
    }),
    setHeader: jest.fn((name: string, value: string) => {
      headers[name] = value;
      return res;
    }),
    status: jest.fn((value: number) => {
      statusCode = value;
      return res;
    }),
    statusCode: () => statusCode,
  };
  return res as TestResponse;
}

function request(
  method: string,
  body?: unknown,
  query: Record<string, string | string[]> = {}
): NextIronRequest {
  return { body, method, query, session: {} } as NextIronRequest;
}

describe("Artifacts API routes", () => {
  beforeEach(() => {
    mockClient.mockReset().mockResolvedValue({
      config: { basePath: "https://platform.example.test" },
      documents: { createDocument, getDocuments },
      exports: { createExport, getExport, getQueuedExport },
      files: { getFile },
      sceneViewStates: { getSceneViewStates: jest.fn() },
      scenes: { getScene: jest.fn().mockResolvedValue({ data: { data: {} } }) },
    });
    createExport
      .mockReset()
      .mockResolvedValue({ data: { data: { id: "queued-1" } } });
    getExport.mockReset().mockResolvedValue({
      data: {
        data: {
          attributes: {
            created: "2026-07-21",
            downloadUrl: "https://secret.example/download",
            downloadUrlExpiry: 60,
          },
          id: "export-1",
          relationships: { file: { data: { id: "file-1", type: "file" } } },
          type: "export",
        },
      },
    });
    getQueuedExport.mockReset().mockResolvedValue({
      data: {
        data: {
          attributes: { created: "2026-07-21", status: "running" },
          id: "queued-1",
          type: "queued-export",
        },
      },
    });
    getFile
      .mockReset()
      .mockResolvedValue({
        data: { data: { attributes: { status: "complete" } } },
      });
    getDocuments
      .mockReset()
      .mockResolvedValue({ data: { data: [], links: {} } });
    createDocument.mockReset().mockResolvedValue({
      data: {
        data: {
          attributes: {
            createdAt: "now",
            documentType: "PDF",
            fileId: "file-1",
          },
          id: "doc-1",
          type: "document",
        },
      },
    });
  });

  it("gates export creation without creating a client or sending an unverified format", async () => {
    const res = response();
    await handleExports(
      request("POST", JSON.stringify({ format: "anything" })),
      res as NextApiResponse
    );
    expect(res.statusCode()).toBe(503);
    expect(mockClient).not.toHaveBeenCalled();
    expect(createExport).not.toHaveBeenCalled();
  });

  it("does not send a guessed STEP request", async () => {
    const res = response();
    await handleExports(
      request(
        "POST",
        JSON.stringify({
          downloadUrlExpiry: 3600,
          format: "step",
          sceneId: "scene-1",
        })
      ),
      res as NextApiResponse
    );
    expect(res.statusCode()).toBe(503);
    expect(createExport).not.toHaveBeenCalled();
  });

  it("redacts download URLs from export detail and emits them only from the no-store click route", async () => {
    const detail = response();
    const download = response();
    await handleExport(
      request("GET", undefined, { id: "export-1" }),
      detail as NextApiResponse
    );
    await handleExportDownloadUrl(
      request("POST", undefined, { id: "export-1" }),
      download as NextApiResponse
    );
    expect(JSON.stringify(detail.body())).not.toContain("secret.example");
    expect(detail.body()).toMatchObject({ id: "export-1", status: 200 });
    expect(download.headers()).toEqual({ "Cache-Control": "no-store" });
    expect(download.body()).toEqual({
      status: 200,
      url: "https://secret.example/download",
    });
  });

  it("normalizes queued-export polling without forwarding a redirect URL", async () => {
    const res = response();
    await handleQueuedExport(
      request("GET", undefined, { id: "queued-1" }),
      res as NextApiResponse
    );
    expect(res.body()).toEqual({
      queuedExportId: "queued-1",
      state: "running",
      status: 200,
    });
    expect(JSON.stringify(res.body())).not.toContain("http");
  });

  it("rejects off-host locations and resolves only a same-host export redirect", async () => {
    expect(
      exportIdFromLocation(
        "https://attacker.example/exports/export-1",
        "https://platform.example.test"
      )
    ).toBeUndefined();
    expect(
      exportIdFromLocation("/exports/export-1", "https://platform.example.test")
    ).toBe("export-1");
    getQueuedExport.mockResolvedValue({
      data: {},
      headers: { location: "/exports/export-1" },
      status: 302,
    });
    const res = response();
    await handleQueuedExport(
      request("GET", undefined, { id: "queued-1" }),
      res as NextApiResponse
    );
    expect(getQueuedExport).toHaveBeenCalledWith(
      { id: "queued-1" },
      expect.objectContaining({ maxRedirects: 0 })
    );
    expect(res.body()).toEqual({
      exportId: "export-1",
      queuedExportId: "queued-1",
      state: "complete",
      status: 200,
    });
  });

  it("uses typed Documents list/create contracts and blocks invalid create before client acquisition", async () => {
    const invalid = response();
    await handleDocuments(
      request("POST", JSON.stringify({ fileId: "" })),
      invalid as NextApiResponse
    );
    expect(invalid.statusCode()).toBe(400);
    expect(mockClient).not.toHaveBeenCalled();

    const list = response();
    await handleDocuments(
      request("GET", undefined, { pageSize: "500", suppliedId: "doc-a,doc-b" }),
      list as NextApiResponse
    );
    expect(getDocuments).toHaveBeenCalledWith({
      filterSuppliedId: "doc-a,doc-b",
      pageCursor: undefined,
      pageSize: 100,
    });

    const create = response();
    await handleDocuments(
      request(
        "POST",
        JSON.stringify({ fileId: "file-1", suppliedId: "doc-a" })
      ),
      create as NextApiResponse
    );
    expect(createDocument).toHaveBeenCalledWith({
      createDocumentRequest: {
        data: {
          attributes: { fileId: "file-1", suppliedId: "doc-a" },
          type: "document",
        },
      },
    });
    expect(create.statusCode()).toBe(201);
  });
});
