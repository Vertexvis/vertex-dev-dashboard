/**
 * @jest-environment node
 */
import type { NextApiResponse } from "next";

import { getClientFromSession } from "../../../lib/vertex-api";
import type { NextIronRequest } from "../../../lib/with-session";
import { handleFileCollectionsByFile } from "../../../pages/api/files/[id]/file-collections";

jest.setTimeout(120_000);
jest.mock("../../../lib/vertex-api", () => ({
  getClientFromSession: jest.fn(),
}));

type JsonBody = Record<string, unknown>;

type TestReq = Pick<NextIronRequest, "body" | "method" | "query" | "session">;

interface TestRes extends Pick<NextApiResponse, "json" | "status"> {
  readonly body: () => unknown;
  readonly statusCode: () => number | undefined;
}

let getMock: jest.Mock;

describe("file-associated collections API route", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    getMock = jest.fn();
  });

  it("lists file collections for a file with cursor pagination", async () => {
    mockClient({
      data: {
        data: [collectionData("collection-1")],
        links: {
          next: {
            href: "https://example.vertexvis.io/files/file-1/file-collections?page[cursor]=next-page",
          },
          self: {
            href: "https://example.vertexvis.io/files/file-1/file-collections?page[cursor]=self-page",
          },
        },
      },
    });

    const res = await callRoute({
      method: "GET",
      query: {
        cursor: "cursor-1",
        id: "file-1",
        pageSize: "50",
      },
    });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [collectionData("collection-1")],
      status: 200,
    });
    expect(mockGet()).toHaveBeenCalledWith(
      "https://example.vertexvis.io/files/file-1/file-collections",
      {
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: "Bearer test-token",
        },
        params: {
          "page[cursor]": "cursor-1",
          "page[size]": 50,
        },
      }
    );
  });

  it("encodes file IDs in the request path", async () => {
    mockClient({
      data: {
        data: [collectionData("collection-1")],
        links: {},
      },
    });

    await callRoute({
      method: "GET",
      query: { id: "file/1" },
    });

    expect(mockGet()).toHaveBeenCalledWith(
      "https://example.vertexvis.io/files/file%2F1/file-collections",
      {
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: "Bearer test-token",
        },
        params: {
          "page[cursor]": undefined,
          "page[size]": 10,
        },
      }
    );
  });

  it("uses the default page size when one is not supplied", async () => {
    mockClient({
      data: {
        data: [collectionData("collection-1")],
        links: {},
      },
    });

    const res = await callRoute({
      method: "GET",
      query: { id: "file-1" },
    });

    expect(res.statusCode()).toBe(200);
    expect(mockGet()).toHaveBeenCalledWith(
      "https://example.vertexvis.io/files/file-1/file-collections",
      {
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: "Bearer test-token",
        },
        params: {
          "page[cursor]": undefined,
          "page[size]": 10,
        },
      }
    );
  });

  it("validates that a file ID is present", async () => {
    const res = await callRoute({ method: "GET" });

    expect(res.statusCode()).toBe(400);
    expect(res.body()).toEqual({
      message: "File ID required.",
      status: 400,
    });
    expect(mockGet()).not.toHaveBeenCalled();
  });

  it("returns Vertex API failures from get requests", async () => {
    mockClient({
      error: {
        vertexError: {
          res: failureBody("500", "Vertex is upset."),
        },
      },
    });

    const res = await callRoute({
      method: "GET",
      query: { id: "file-1" },
    });

    expect(res.statusCode()).toBe(500);
    expect(res.body()).toEqual({
      message: "Vertex is upset.",
      status: 500,
    });
  });

  function callRoute(req: {
    readonly method: string;
    readonly query?: Record<string, string | string[]>;
  }): Promise<TestRes> {
    return callApi((r, res) => handleFileCollectionsByFile(r, res), req);
  }

  async function callApi(
    handler: (req: NextIronRequest, res: NextApiResponse) => Promise<void>,
    req: {
      readonly method: string;
      readonly query?: Record<string, string | string[]>;
    }
  ): Promise<TestRes> {
    const res = createRes();
    await handler(createReq(req), res as unknown as NextApiResponse);
    return res;
  }

  function createReq({
    method,
    query = {},
  }: {
    readonly method: string;
    readonly query?: Record<string, string | string[]>;
  }): NextIronRequest {
    return {
      method,
      query,
      session: {} as NextIronRequest["session"],
    } as TestReq as NextIronRequest;
  }
});

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

function collectionData(id: string): JsonBody {
  return {
    attributes: {
      created: "2026-06-10T15:30:00Z",
      name: "Collection One",
      suppliedId: "supplied-1",
    },
    id,
    type: "file-collection",
  };
}

function mockClient({
  data,
  error,
}: {
  readonly data?: JsonBody;
  readonly error?: unknown;
}): void {
  getMock = jest.fn(() =>
    error != null ? Promise.reject(error) : Promise.resolve({ data })
  );

  (getClientFromSession as jest.Mock).mockResolvedValue({
    axiosInstance: { get: getMock },
    config: { basePath: "https://example.vertexvis.io" },
    token: { access_token: "test-token" },
  });
}

function mockGet(): jest.Mock {
  return getMock;
}

function failureBody(status: string, title: string): JsonBody {
  return { errors: [{ status, title }] };
}
