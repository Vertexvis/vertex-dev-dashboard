/**
 * @jest-environment node
 */
import type { NextApiResponse } from "next";
import type { Session } from "next-iron-session";

import {
  type MockServerHarness,
  startMockServer,
} from "../../../../test/helpers/mockserver";
import {
  CredsKey,
  EnvKey,
  NetworkConfig as NetworkConfigKey,
  type NextIronRequest,
  TokenKey,
} from "../../../lib/with-session";
import { handleFileCollections } from "../../../pages/api/file-collections";
import { handleFileCollection } from "../../../pages/api/file-collections/[id]";

jest.setTimeout(120_000);

type JsonBody = Record<string, unknown>;

type TestReq = Pick<NextIronRequest, "body" | "method" | "query" | "session">;

interface TestRes extends Pick<NextApiResponse, "json" | "status"> {
  readonly body: () => unknown;
  readonly statusCode: () => number | undefined;
}

describe("file collection API routes", () => {
  let mockServer: MockServerHarness;

  beforeAll(async () => {
    mockServer = await startMockServer();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(async () => {
    await mockServer.client.reset();
  });

  it("passes name and supplied ID filters upstream", async () => {
    await expectFileCollectionList({
      "filter[name][contains]": ["COLLECT"],
      "filter[suppliedId][contains]": ["LIED-1"],
      "page[cursor]": ["cursor-1"],
      "page[size]": ["50"],
    });
    const res = await callFileCollections({
      method: "GET",
      query: {
        cursor: "cursor-1",
        name: "COLLECT",
        pageSize: "50",
        suppliedId: "LIED-1",
      },
    });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [collectionData("collection-1")],
      status: 200,
    });
    await verifyListFileCollections({
      "filter[name][contains]": ["COLLECT"],
      "filter[suppliedId][contains]": ["LIED-1"],
      "page[cursor]": ["cursor-1"],
      "page[size]": ["50"],
    });
  });

  it("returns the collection page supplied by the service without local filtering", async () => {
    await expectFileCollectionList({
      "filter[name][contains]": ["missing"],
      "page[size]": ["10"],
    });

    const res = await callFileCollections({
      method: "GET",
      query: { name: "missing" },
    });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [collectionData("collection-1")],
      status: 200,
    });
    await verifyListFileCollections({
      "filter[name][contains]": ["missing"],
      "page[size]": ["10"],
    });
  });

  it("uses the default page size when one is not supplied", async () => {
    await expectFileCollectionList({ "page[size]": ["10"] });

    const res = await callFileCollections({ method: "GET" });

    expect(res.statusCode()).toBe(200);
    await verifyListFileCollections({ "page[size]": ["10"] });
  });

  it("validates delete request bodies before calling Vertex", async () => {
    const missingBody = await callFileCollections({ method: "DELETE" });
    const invalidBody = await callFileCollections({
      body: "{}",
      method: "DELETE",
    });

    expect(missingBody.statusCode()).toBe(400);
    expect(missingBody.body()).toEqual({
      message: "Body required.",
      status: 400,
    });
    expect(invalidBody.statusCode()).toBe(400);
    expect(invalidBody.body()).toEqual({
      message: "Invalid body.",
      status: 400,
    });
    await mockServer.client.verifyZeroInteractions();
  });

  it("deletes each supplied file collection ID", async () => {
    await expectDeleteFileCollection("collection-1");
    await expectDeleteFileCollection("collection-2");

    const res = await callFileCollections({
      body: JSON.stringify({ ids: ["collection-1", "collection-2"] }),
      method: "DELETE",
    });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({ status: 200 });
    await verifyDeleteFileCollection("collection-1");
    await verifyDeleteFileCollection("collection-2");
  });

  it("returns Vertex API failures from delete requests", async () => {
    await expectDeleteFileCollection("collection-1", {
      body: failureBody("404", "Collection not found."),
      statusCode: 404,
    });

    const res = await callFileCollections({
      body: JSON.stringify({ ids: ["collection-1"] }),
      method: "DELETE",
    });

    expect(res.statusCode()).toBe(404);
    expect(res.body()).toEqual({
      message: "Collection not found.",
      status: 404,
    });
    await verifyDeleteFileCollection("collection-1");
  });

  it("gets a file collection by ID", async () => {
    await mockServer.client.mockAnyResponse({
      httpRequest: { method: "GET", path: "/file-collections/collection-1" },
      httpResponse: jsonResponse({
        data: collectionData("collection-1"),
        links: {},
      }),
    });

    const res = await callFileCollectionById("collection-1", { method: "GET" });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({
      data: collectionData("collection-1"),
      status: 200,
    });
    await mockServer.client.verify(
      { method: "GET", path: "/file-collections/collection-1" },
      1,
      1
    );
  });

  it("includes export availability when requested", async () => {
    await mockServer.client.mockAnyResponse({
      httpRequest: { method: "GET", path: "/file-collections/collection-1" },
      httpResponse: jsonResponse({
        data: collectionData("collection-1"),
        links: {},
      }),
    });
    await mockServer.client.mockAnyResponse({
      httpRequest: {
        method: "GET",
        path: "/file-collections/collection-1/files",
        queryStringParameters: { "page[size]": ["200"] },
      },
      httpResponse: jsonResponse({
        data: [fileData("file-1", "complete")],
        links: {},
      }),
    });

    const res = await callFileCollectionById("collection-1", {
      method: "GET",
      query: { includeExportAvailability: "true" },
    });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({
      data: collectionData("collection-1"),
      export: { enabled: true, fileCount: 1 },
      status: 200,
    });
    await mockServer.client.verify(
      { method: "GET", path: "/file-collections/collection-1" },
      1,
      1
    );
    await mockServer.client.verify(
      {
        method: "GET",
        path: "/file-collections/collection-1/files",
        queryStringParameters: { "page[size]": ["200"] },
      },
      1,
      1
    );
  });

  it("validates file collection ID requests before calling Vertex", async () => {
    const missingId = await callFileCollectionById(undefined, {
      method: "GET",
    });
    const unsupportedMethod = await callFileCollectionById("collection-1", {
      method: "DELETE",
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
    await mockServer.client.verifyZeroInteractions();
  });

  it("returns Vertex API failures from get requests", async () => {
    await mockServer.client.mockAnyResponse({
      httpRequest: { method: "GET", path: "/file-collections/collection-1" },
      httpResponse: jsonResponse(failureBody("500", "Vertex is upset."), 500),
    });

    const res = await callFileCollectionById("collection-1", { method: "GET" });

    expect(res.statusCode()).toBe(500);
    expect(res.body()).toEqual({
      message: "Vertex is upset.",
      status: 500,
    });
  });

  it("rejects unsupported collection methods", async () => {
    const res = await callFileCollections({ method: "POST" });

    expect(res.statusCode()).toBe(405);
    expect(res.body()).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
    await mockServer.client.verifyZeroInteractions();
  });

  function callFileCollections(req: {
    readonly body?: string;
    readonly method: string;
    readonly query?: Record<string, string | string[]>;
  }): Promise<TestRes> {
    return callApi((r, res) => handleFileCollections(r, res), req);
  }

  function callFileCollectionById(
    id: string | undefined,
    req: {
      readonly method: string;
      readonly query?: Record<string, string | string[]>;
    }
  ): Promise<TestRes> {
    return callApi((r, res) => handleFileCollection(r, res), {
      ...req,
      query: id == null ? req.query : { ...req.query, id },
    });
  }

  async function callApi(
    handler: (req: NextIronRequest, res: NextApiResponse) => Promise<void>,
    req: {
      readonly body?: string;
      readonly method: string;
      readonly query?: Record<string, string | string[]>;
    }
  ): Promise<TestRes> {
    const res = createRes();
    await handler(createReq(req), res as unknown as NextApiResponse);
    return res;
  }

  function createReq({
    body,
    method,
    query = {},
  }: {
    readonly body?: string;
    readonly method: string;
    readonly query?: Record<string, string | string[]>;
  }): NextIronRequest {
    const req: TestReq = {
      body,
      method,
      query,
      session: createSession(mockServer.apiHost),
    };
    return req as NextIronRequest;
  }

  async function expectFileCollectionList(
    queryStringParameters: Record<string, string[]>
  ): Promise<void> {
    await mockServer.client.mockAnyResponse({
      httpRequest: {
        method: "GET",
        path: "/file-collections",
        queryStringParameters,
      },
      httpResponse: jsonResponse({
        data: [collectionData("collection-1")],
        links: {
          next: {
            href: `${mockServer.apiHost}/file-collections?page[cursor]=next-page`,
          },
          self: {
            href: `${mockServer.apiHost}/file-collections?page[cursor]=self-page`,
          },
        },
      }),
    });
  }

  async function verifyListFileCollections(
    queryStringParameters: Record<string, string[]>
  ): Promise<void> {
    await mockServer.client.verify(
      { method: "GET", path: "/file-collections", queryStringParameters },
      1,
      1
    );
  }

  async function expectDeleteFileCollection(
    id: string,
    response: { readonly body: JsonBody; readonly statusCode: number } = {
      body: {},
      statusCode: 204,
    }
  ): Promise<void> {
    await mockServer.client.mockAnyResponse({
      httpRequest: { method: "DELETE", path: `/file-collections/${id}` },
      httpResponse: jsonResponse(response.body, response.statusCode),
    });
  }

  async function verifyDeleteFileCollection(id: string): Promise<void> {
    await mockServer.client.verify(
      { method: "DELETE", path: `/file-collections/${id}` },
      1,
      1
    );
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

function fileData(id: string, status: string): JsonBody {
  return {
    attributes: {
      created: "2026-06-12T15:30:00Z",
      name: `${id}.jt`,
      status,
      suppliedId: `${id}-supplied`,
      uploaded: "2026-06-12T15:31:00Z",
    },
    id,
    type: "file",
  };
}

function createSession(apiHost: string): Session {
  const values = new Map<string, unknown>([
    [CredsKey, { id: "client-id", secret: "client-secret" }],
    [EnvKey, "custom"],
    [
      NetworkConfigKey,
      {
        apiHost,
        name: "mock-server",
        renderingHost: apiHost,
        sceneTreeHost: apiHost,
        sceneViewHost: apiHost,
      },
    ],
    [
      TokenKey,
      {
        expiration: Date.now() + 60 * 60 * 1000,
        token: {
          access_token: "test-token",
          account_id: "account-id",
          expires_in: 60 * 60,
          scopes: [],
          token_type: "Bearer",
        },
      },
    ],
  ]);

  return {
    get: (key: string) => values.get(key),
    set: (key: string, value: unknown) => {
      values.set(key, value);
    },
  } as unknown as Session;
}

function failureBody(status: string, title: string): JsonBody {
  return { errors: [{ status, title }] };
}

function jsonResponse(body: JsonBody, statusCode = 200): JsonBody {
  return {
    body: JSON.stringify(body),
    headers: { "content-type": ["application/json"] },
    statusCode,
  };
}
