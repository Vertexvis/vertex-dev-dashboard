/**
 * @jest-environment node
 */
import { getPage } from "@vertexvis/api-client-node";
import type { NextApiResponse } from "next";
import type { Session } from "next-iron-session";

import type { NextIronRequest } from "../../../lib/with-session";
import { handleFileCollectionFiles } from "../../../pages/api/file-collections/[id]/files";

const mockGetClientFromSession = jest.fn();
const mockGetFileCollectionsApi = jest.fn();
const mockListFileCollectionFiles = jest.fn();
const mockGetPage = getPage as jest.Mock;

jest.mock("@vertexvis/api-client-node", () => {
  const actual = jest.requireActual("@vertexvis/api-client-node");
  return {
    ...actual,
    getPage: jest.fn(),
    logError: jest.fn(),
  };
});

jest.mock("../../../lib/vertex-api", () => {
  const actual = jest.requireActual("../../../lib/vertex-api");
  return {
    ...actual,
    getClientFromSession: (...args: unknown[]) =>
      mockGetClientFromSession(...args),
  };
});

jest.mock("../../../lib/file-collections", () => {
  const actual = jest.requireActual("../../../lib/file-collections");
  return {
    ...actual,
    getFileCollectionsApi: (...args: unknown[]) =>
      mockGetFileCollectionsApi(...args),
  };
});

type TestReq = Pick<NextIronRequest, "body" | "method" | "query" | "session">;

interface TestRes extends Pick<NextApiResponse, "json" | "status"> {
  readonly body: () => unknown;
  readonly statusCode: () => number | undefined;
}

describe("file collection files API route", () => {
  beforeEach(() => {
    mockGetClientFromSession.mockResolvedValue({ client: "test-client" });
    mockGetFileCollectionsApi.mockReturnValue({
      listFileCollectionFiles: mockListFileCollectionFiles,
    });
    mockListFileCollectionFiles.mockResolvedValue({ data: {} });
    mockGetPage.mockImplementation(async (apiCall) => {
      await apiCall();
      return {
        cursors: { next: "next-page", self: "self-page" },
        page: { data: [fileData("file-1")] },
      };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("proxies collection file list requests with paging parameters", async () => {
    const res = await callFileCollectionFiles({
      method: "GET",
      query: { id: "collection-1", cursor: "cursor-1", pageSize: "50" },
    });

    expect(mockGetClientFromSession).toHaveBeenCalled();
    expect(mockGetFileCollectionsApi).toHaveBeenCalledWith({
      client: "test-client",
    });
    expect(mockListFileCollectionFiles).toHaveBeenCalledWith({
      id: "collection-1",
      pageCursor: "cursor-1",
      pageSize: 50,
    });
    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [fileData("file-1")],
      status: 200,
    });
  });

  it("uses the default page size when one is not supplied", async () => {
    const res = await callFileCollectionFiles({
      method: "GET",
      query: { id: "collection-1" },
    });

    expect(mockListFileCollectionFiles).toHaveBeenCalledWith({
      id: "collection-1",
      pageCursor: undefined,
      pageSize: 10,
    });
    expect(res.statusCode()).toBe(200);
  });

  it("validates requests before calling Vertex", async () => {
    const missingId = await callFileCollectionFiles({
      method: "GET",
      query: {},
    });
    const unsupportedMethod = await callFileCollectionFiles({
      method: "DELETE",
      query: { id: "collection-1" },
    });

    expect(missingId.statusCode()).toBe(400);
    expect(missingId.body()).toEqual({
      message: "File Collection ID required.",
      status: 400,
    });
    expect(unsupportedMethod.statusCode()).toBe(405);
    expect(unsupportedMethod.body()).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
    expect(mockGetClientFromSession).not.toHaveBeenCalled();
  });
});

async function callFileCollectionFiles(req: {
  readonly method: string;
  readonly query?: Record<string, string | string[]>;
}): Promise<TestRes> {
  const res = createRes();
  await handleFileCollectionFiles(
    createReq(req),
    res as unknown as NextApiResponse
  );
  return res;
}

function createReq({
  method,
  query = {},
}: {
  readonly method: string;
  readonly query?: Record<string, string | string[]>;
}): NextIronRequest {
  const req: TestReq = {
    method,
    query,
    session: {} as Session,
  };
  return req as NextIronRequest;
}

function createRes(): TestRes {
  let responseBody: unknown;
  let responseStatus: number | undefined;
  const res = {} as TestRes;
  res.body = () => responseBody;
  res.statusCode = () => responseStatus;
  res.status = jest.fn((statusCode: number) => {
    responseStatus = statusCode;
    return res;
  });
  res.json = jest.fn((body: unknown) => {
    responseBody = body;
    return res;
  });
  return res;
}

function fileData(id: string): unknown {
  return {
    attributes: {
      created: "2026-06-12T15:30:00Z",
      name: "File One",
      status: "uploaded",
      suppliedId: "file-supplied-1",
      uploaded: "2026-06-12T15:31:00Z",
    },
    id,
    type: "file",
  };
}
