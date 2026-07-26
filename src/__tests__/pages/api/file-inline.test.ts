/**
 * @jest-environment node
 */
import type { NextApiResponse } from "next";

import { InlinePreviewMaxBytes } from "../../../lib/file-preview";
import { NextIronRequest } from "../../../lib/with-session";
import { handleFileInline } from "../../../pages/api/files/[id]/inline";

const mockCreateDownloadUrl = jest.fn();

jest.mock("../../../lib/vertex-api", () => ({
  getClientFromSession: jest.fn(() => ({
    files: { createDownloadUrl: mockCreateDownloadUrl },
  })),
}));

const signedUrl = "https://downloads.example.test/blob";

describe("file inline route", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockCreateDownloadUrl.mockReset();
    mockCreateDownloadUrl.mockResolvedValue({
      data: { data: { attributes: { uri: signedUrl } } },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("streams inline bytes with the MIME inferred from the file name", async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    global.fetch = jest.fn(async () =>
      byteResponse(bytes, { "content-length": String(bytes.byteLength) })
    ) as unknown as typeof fetch;

    const res = createResponse();
    await callInline(res, { id: "file-1", name: "photo.png" });

    expect(mockCreateDownloadUrl).toHaveBeenCalledWith({
      id: "file-1",
      createDownloadRequest: {
        data: { type: "download-url", attributes: { expiry: 30 } },
      },
    });
    expect(res.headers["Content-Type"]).toBe("image/png");
    expect(res.headers["Content-Disposition"]).toBe("inline");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(Buffer.isBuffer(res.sent)).toBe(true);
    expect((res.sent as Buffer).equals(bytes)).toBe(true);
  });

  it("falls back to octet-stream when the extension is unknown", async () => {
    const bytes = Buffer.from("hello");
    global.fetch = jest.fn(async () =>
      byteResponse(bytes, {})
    ) as unknown as typeof fetch;

    const res = createResponse();
    await callInline(res, { id: "file-1", name: "model.jt" });

    expect(res.headers["Content-Type"]).toBe("application/octet-stream");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects assets whose declared length exceeds the ceiling with 413", async () => {
    global.fetch = jest.fn(async () =>
      byteResponse(Buffer.from("x"), {
        "content-length": String(InlinePreviewMaxBytes + 1),
      })
    ) as unknown as typeof fetch;

    const res = createResponse();
    await callInline(res, { id: "file-1", name: "big.pdf" });

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.jsonBody).toMatchObject({ status: 413 });
    expect(res.sent).toBeUndefined();
  });

  it("returns 405 for non-GET methods", async () => {
    const res = createResponse();
    await callInline(res, { id: "file-1" }, "POST");

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.jsonBody).toMatchObject({ status: 405 });
    expect(mockCreateDownloadUrl).not.toHaveBeenCalled();
  });

  it("returns 400 when the file id is missing", async () => {
    const res = createResponse();
    await callInline(res, {});

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.jsonBody).toMatchObject({ status: 400 });
    expect(mockCreateDownloadUrl).not.toHaveBeenCalled();
  });

  it("returns 500 when no signed URL is produced", async () => {
    mockCreateDownloadUrl.mockResolvedValue({
      data: { data: { attributes: {} } },
    });

    const res = createResponse();
    await callInline(res, { id: "file-1", name: "photo.png" });

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.jsonBody).toMatchObject({ status: 500 });
  });
});

interface MockResponse {
  readonly body: () => unknown;
  headers: Record<string, unknown>;
  jsonBody?: unknown;
  sent?: unknown;
  status: jest.Mock;
  setHeader: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
}

function createResponse(): MockResponse {
  const res: MockResponse = {
    body: () => res.jsonBody,
    headers: {},
    status: jest.fn(() => res),
    setHeader: jest.fn((key: string, value: unknown) => {
      res.headers[key] = value;
      return res;
    }),
    json: jest.fn((body: unknown) => {
      res.jsonBody = body;
      return res;
    }),
    send: jest.fn((body: unknown) => {
      res.sent = body;
      return res;
    }),
  };
  return res;
}

function byteResponse(
  bytes: Buffer,
  headers: Record<string, string>
): {
  ok: boolean;
  body: unknown;
  headers: Headers;
  arrayBuffer: () => Promise<ArrayBuffer>;
} {
  return {
    ok: true,
    body: {},
    headers: new Headers(headers),
    arrayBuffer: async () =>
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer,
  };
}

function callInline(
  res: MockResponse,
  query: Record<string, string>,
  method = "GET"
): Promise<void> {
  return handleFileInline(
    { method, query, session: {} } as unknown as NextIronRequest,
    res as unknown as NextApiResponse
  );
}
