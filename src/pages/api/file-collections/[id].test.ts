import { NextApiResponse } from "next";

import * as fileCollections from "../../../lib/file-collections";
import * as vertexApi from "../../../lib/vertex-api";
import { NextIronRequest } from "../../../lib/with-session";
import * as route from "./[id]";

jest.mock("@vertexvis/api-client-node", () => ({
  head: jest.fn((value?: string | string[]) =>
    Array.isArray(value) ? value[0] : value
  ),
  logError: jest.fn(),
}));

jest.mock("../../../lib/file-collections", () => ({
  getFileCollectionsApi: jest.fn(),
}));

jest.mock("../../../lib/vertex-api", () => ({
  getClientFromSession: jest.fn(),
}));

jest.mock("../../../lib/with-session", () => ({
  __esModule: true,
  default: jest.fn((handler) => handler),
}));

const mockGetFileCollection = jest.fn();

type MockNextIronRequest = Pick<
  NextIronRequest,
  "method" | "query" | "session"
>;

type MockNextApiResponse = Pick<NextApiResponse, "json" | "status"> & {
  json: jest.MockedFunction<(body: unknown) => MockNextApiResponse>;
  status: jest.MockedFunction<(statusCode: number) => MockNextApiResponse>;
};

describe("/api/file-collections/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(fileCollections.getFileCollectionsApi).mockReturnValue({
      getFileCollection: mockGetFileCollection,
    } as unknown as ReturnType<typeof fileCollections.getFileCollectionsApi>);
    jest
      .mocked(vertexApi.getClientFromSession)
      .mockResolvedValue(
        {} as Awaited<ReturnType<typeof vertexApi.getClientFromSession>>
      );

    mockGetFileCollection.mockResolvedValue({
      data: {
        data: {
          attributes: {
            created: "2026-06-10T15:30:00Z",
            name: "Collection One",
            suppliedId: "supplied-1",
          },
          id: "collection-1",
          type: "file-collection",
        },
      },
    });
  });

  it("gets a file collection by ID", async () => {
    const res = createRes();

    await route.default(
      createReq({ method: "GET", query: { id: "collection-1" } }),
      asNextApiResponse(res)
    );

    expect(mockGetFileCollection).toHaveBeenCalledWith({ id: "collection-1" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        attributes: {
          created: "2026-06-10T15:30:00Z",
          name: "Collection One",
          suppliedId: "supplied-1",
        },
        id: "collection-1",
        type: "file-collection",
      },
      status: 200,
    });
  });

  it("requires a file collection ID", async () => {
    const res = createRes();

    await route.default(createReq({ method: "GET" }), asNextApiResponse(res));

    expect(mockGetFileCollection).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "File Collection ID required.",
      status: 400,
    });
  });

  it("returns Vertex API failures", async () => {
    const res = createRes();
    mockGetFileCollection.mockRejectedValueOnce({
      vertexError: {
        res: {
          errors: new Set([{ status: "404", title: "Collection not found." }]),
        },
      },
    });

    await route.default(
      createReq({ method: "GET", query: { id: "collection-1" } }),
      asNextApiResponse(res)
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Collection not found.",
      status: 404,
    });
  });

  it("rejects unsupported methods", async () => {
    const res = createRes();

    await route.default(
      createReq({ method: "DELETE", query: { id: "collection-1" } }),
      asNextApiResponse(res)
    );

    expect(mockGetFileCollection).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      message: "Method not allowed.",
      status: 405,
    });
  });
});

function createReq({
  method,
  query = {},
}: {
  method: string;
  query?: Record<string, string | string[]>;
}): NextIronRequest {
  const req: MockNextIronRequest = { method, query, session: {} };
  return req as NextIronRequest;
}

function createRes(): MockNextApiResponse {
  const res = {} as MockNextApiResponse;
  res.json = jest.fn(() => res);
  res.status = jest.fn(() => res);
  return res;
}

function asNextApiResponse(res: MockNextApiResponse): NextApiResponse {
  return res as unknown as NextApiResponse;
}
