import { NextApiResponse } from "next";

import * as fileCollections from "../../lib/file-collections";
import * as vertexApi from "../../lib/vertex-api";
import { NextIronRequest } from "../../lib/with-session";
import * as route from "./file-collections";

jest.mock("@vertexvis/api-client-node", () => ({
  getPage: jest.fn(async (apiCall: () => Promise<unknown>) => {
    const res = (await apiCall()) as {
      data: { cursors: unknown; data: unknown[] };
    };
    return { cursors: res.data.cursors, page: { data: res.data.data } };
  }),
  head: jest.fn((value?: string | string[]) =>
    Array.isArray(value) ? value[0] : value
  ),
  isFailure: jest.fn((value?: { errors?: unknown }) => value?.errors != null),
  logError: jest.fn(),
}));

jest.mock("../../lib/file-collections", () => ({
  getFileCollectionsApi: jest.fn(),
}));

jest.mock("../../lib/vertex-api", () => ({
  getClientFromSession: jest.fn(),
  makeCall: jest.fn((apiCall: () => unknown) => apiCall()),
}));

jest.mock("../../lib/with-session", () => ({
  __esModule: true,
  default: jest.fn((handler) => handler),
}));

const mockListFileCollections = jest.fn();
const mockDeleteFileCollection = jest.fn();

type MockNextIronRequest = Pick<
  NextIronRequest,
  "body" | "method" | "query" | "session"
>;

type MockNextApiResponse = Pick<NextApiResponse, "json" | "status"> & {
  json: jest.MockedFunction<(body: unknown) => MockNextApiResponse>;
  status: jest.MockedFunction<(statusCode: number) => MockNextApiResponse>;
};

describe("/api/file-collections", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(fileCollections.getFileCollectionsApi).mockReturnValue({
      deleteFileCollection: mockDeleteFileCollection,
      listFileCollections: mockListFileCollections,
    } as ReturnType<typeof fileCollections.getFileCollectionsApi>);
    jest
      .mocked(vertexApi.getClientFromSession)
      .mockResolvedValue(
        {} as Awaited<ReturnType<typeof vertexApi.getClientFromSession>>
      );
    jest
      .mocked(vertexApi.makeCall)
      .mockImplementation((apiCall: () => unknown) =>
        apiCall()
      ) as jest.MockedFunction<typeof vertexApi.makeCall>;

    mockListFileCollections.mockResolvedValue({
      data: {
        cursors: { next: "next-page", self: "self-page" },
        data: [{ id: "collection-1" }],
      },
    });
    mockDeleteFileCollection.mockResolvedValue({ data: { status: 200 } });
  });

  it("lists file collections with query parameters", async () => {
    const res = createRes();

    await route.default(
      createReq({
        method: "GET",
        query: {
          cursor: "cursor-1",
          pageSize: "50",
          suppliedId: "supplied-1",
        },
      }),
      asNextApiResponse(res)
    );

    expect(mockListFileCollections).toHaveBeenCalledWith({
      filterSuppliedId: "supplied-1",
      pageCursor: "cursor-1",
      pageSize: 50,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      cursors: { next: "next-page", self: "self-page" },
      data: [{ id: "collection-1" }],
      status: 200,
    });
  });

  it("uses the default page size when one is not supplied", async () => {
    const res = createRes();

    await route.default(createReq({ method: "GET" }), asNextApiResponse(res));

    expect(mockListFileCollections).toHaveBeenCalledWith({
      filterSuppliedId: undefined,
      pageCursor: undefined,
      pageSize: 10,
    });
  });

  it("requires a delete request body", async () => {
    const res = createRes();

    await route.default(
      createReq({ method: "DELETE" }),
      asNextApiResponse(res)
    );

    expect(mockDeleteFileCollection).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Body required.",
      status: 400,
    });
  });

  it("requires delete IDs", async () => {
    const res = createRes();

    await route.default(
      createReq({ body: "{}", method: "DELETE" }),
      asNextApiResponse(res)
    );

    expect(mockDeleteFileCollection).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid body.",
      status: 400,
    });
  });

  it("deletes each supplied file collection ID", async () => {
    const res = createRes();

    await route.default(
      createReq({
        body: JSON.stringify({ ids: ["collection-1", "collection-2"] }),
        method: "DELETE",
      }),
      asNextApiResponse(res)
    );

    expect(mockDeleteFileCollection).toHaveBeenCalledWith({
      id: "collection-1",
    });
    expect(mockDeleteFileCollection).toHaveBeenCalledWith({
      id: "collection-2",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 200 });
  });

  it("returns Vertex API failures from delete requests", async () => {
    const res = createRes();
    jest.mocked(vertexApi.makeCall).mockResolvedValueOnce({
      errors: new Set([{ status: "404", title: "Collection not found." }]),
    } as Awaited<ReturnType<typeof vertexApi.makeCall>>);

    await route.default(
      createReq({
        body: JSON.stringify({ ids: ["collection-1"] }),
        method: "DELETE",
      }),
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

    await route.default(createReq({ method: "POST" }), asNextApiResponse(res));

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      message: "Method not allowed.",
      status: 405,
    });
  });
});

function createReq({
  body,
  method,
  query = {},
}: {
  body?: string;
  method: string;
  query?: Record<string, string | string[]>;
}): NextIronRequest {
  const req: MockNextIronRequest = { body, method, query, session: {} };
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
