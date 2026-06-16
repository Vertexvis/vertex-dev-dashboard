/**
 * @jest-environment node
 */
import type { MockServerClient } from "mockserver-client";
import { mockServerClient } from "mockserver-client";
import type { NextApiResponse } from "next";
import type { Session } from "next-iron-session";
import type { StartedTestContainer } from "testcontainers";
import { GenericContainer, Wait } from "testcontainers";

import {
  CredsKey,
  EnvKey,
  NetworkConfig as NetworkConfigKey,
  NextIronRequest,
  TokenKey,
} from "../../../lib/with-session";
import { handleFileCollections } from "../../../pages/api/file-collections";
import { handleFileCollection } from "../../../pages/api/file-collections/[id]";

jest.setTimeout(120_000);

type MockNextIronRequest = Pick<
  NextIronRequest,
  "body" | "method" | "query" | "session"
>;

type JsonBody = Record<string, unknown>;

interface MockNextApiResponse extends Pick<NextApiResponse, "json" | "status"> {
  readonly json: jest.MockedFunction<(body: unknown) => MockNextApiResponse>;
  readonly status: jest.MockedFunction<
    (statusCode: number) => MockNextApiResponse
  >;
}

interface TestSession extends Pick<Session, "get" | "set"> {
  readonly values: Map<string, unknown>;
}

describe("file collection API routes", () => {
  let container: StartedTestContainer;
  let mockServer: MockServerClient;
  let apiHost: string;

  beforeAll(async () => {
    container = await new GenericContainer("mockserver/mockserver")
      .withExposedPorts(1080)
      .withEnvironment({ SERVER_PORT: "1080" })
      .withWaitStrategy(Wait.forLogMessage("started on port: 1080"))
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(1080);
    apiHost = `http://${host}:${port}`;
    mockServer = mockServerClient(host, port);
  });

  afterAll(async () => {
    await container?.stop();
  });

  beforeEach(async () => {
    await mockServer.reset();
  });

  describe("/api/file-collections", () => {
    it("lists file collections with query parameters", async () => {
      const res = createRes();
      await expectFileCollectionList({
        queryStringParameters: {
          "filter[suppliedId]": ["supplied-1"],
          "page[cursor]": ["cursor-1"],
          "page[size]": ["50"],
        },
      });

      await handleFileCollections(
        createReq(apiHost, {
          method: "GET",
          query: {
            cursor: "cursor-1",
            pageSize: "50",
            suppliedId: "supplied-1",
          },
        }),
        asNextApiResponse(res)
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        cursors: { next: "next-page", self: "self-page" },
        data: [collectionData("collection-1")],
        status: 200,
      });
      await mockServer.verify(
        {
          method: "GET",
          path: "/file-collections",
          queryStringParameters: {
            "filter[suppliedId]": ["supplied-1"],
            "page[cursor]": ["cursor-1"],
            "page[size]": ["50"],
          },
        },
        1,
        1
      );
    });

    it("uses the default page size when one is not supplied", async () => {
      const res = createRes();
      await expectFileCollectionList({
        queryStringParameters: { "page[size]": ["10"] },
      });

      await handleFileCollections(
        createReq(apiHost, { method: "GET" }),
        asNextApiResponse(res)
      );

      expect(res.status).toHaveBeenCalledWith(200);
      await mockServer.verify(
        {
          method: "GET",
          path: "/file-collections",
          queryStringParameters: { "page[size]": ["10"] },
        },
        1,
        1
      );
    });

    it("requires a delete request body", async () => {
      const res = createRes();

      await handleFileCollections(
        createReq(apiHost, { method: "DELETE" }),
        asNextApiResponse(res)
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Body required.",
        status: 400,
      });
      await mockServer.verifyZeroInteractions();
    });

    it("requires delete IDs", async () => {
      const res = createRes();

      await handleFileCollections(
        createReq(apiHost, { body: "{}", method: "DELETE" }),
        asNextApiResponse(res)
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid body.",
        status: 400,
      });
      await mockServer.verifyZeroInteractions();
    });

    it("deletes each supplied file collection ID", async () => {
      const res = createRes();
      await expectDeleteFileCollection("collection-1");
      await expectDeleteFileCollection("collection-2");

      await handleFileCollections(
        createReq(apiHost, {
          body: JSON.stringify({ ids: ["collection-1", "collection-2"] }),
          method: "DELETE",
        }),
        asNextApiResponse(res)
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 200 });
      await verifyDeleteFileCollection("collection-1");
      await verifyDeleteFileCollection("collection-2");
    });

    it("returns Vertex API failures from delete requests", async () => {
      const res = createRes();
      await expectDeleteFileCollection("collection-1", {
        body: failureBody("404", "Collection not found."),
        statusCode: 404,
      });

      await handleFileCollections(
        createReq(apiHost, {
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
      await verifyDeleteFileCollection("collection-1");
    });

    it("rejects unsupported methods", async () => {
      const res = createRes();

      await handleFileCollections(
        createReq(apiHost, { method: "POST" }),
        asNextApiResponse(res)
      );

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.json).toHaveBeenCalledWith({
        message: "Method not allowed.",
        status: 405,
      });
      await mockServer.verifyZeroInteractions();
    });
  });

  describe("/api/file-collections/[id]", () => {
    it("gets a file collection by ID", async () => {
      const res = createRes();
      await mockServer.mockAnyResponse({
        httpRequest: { method: "GET", path: "/file-collections/collection-1" },
        httpResponse: jsonResponse({
          data: collectionData("collection-1"),
          links: {},
        }),
      });

      await handleFileCollection(
        createReq(apiHost, {
          method: "GET",
          query: { id: "collection-1" },
        }),
        asNextApiResponse(res)
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: collectionData("collection-1"),
        status: 200,
      });
      await mockServer.verify(
        { method: "GET", path: "/file-collections/collection-1" },
        1,
        1
      );
    });

    it("requires a file collection ID", async () => {
      const res = createRes();

      await handleFileCollection(
        createReq(apiHost, { method: "GET" }),
        asNextApiResponse(res)
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "File Collection ID required.",
        status: 400,
      });
      await mockServer.verifyZeroInteractions();
    });

    it("returns Vertex API failures", async () => {
      const res = createRes();
      await mockServer.mockAnyResponse({
        httpRequest: { method: "GET", path: "/file-collections/collection-1" },
        httpResponse: jsonResponse(failureBody("500", "Vertex is upset."), 500),
      });

      await handleFileCollection(
        createReq(apiHost, {
          method: "GET",
          query: { id: "collection-1" },
        }),
        asNextApiResponse(res)
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Vertex is upset.",
        status: 500,
      });
    });

    it("rejects unsupported methods", async () => {
      const res = createRes();

      await handleFileCollection(
        createReq(apiHost, {
          method: "DELETE",
          query: { id: "collection-1" },
        }),
        asNextApiResponse(res)
      );

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.json).toHaveBeenCalledWith({
        message: "Method not allowed.",
        status: 405,
      });
      await mockServer.verifyZeroInteractions();
    });
  });

  async function expectFileCollectionList({
    queryStringParameters,
  }: {
    readonly queryStringParameters: Record<string, string[]>;
  }): Promise<void> {
    await mockServer.mockAnyResponse({
      httpRequest: {
        method: "GET",
        path: "/file-collections",
        queryStringParameters,
      },
      httpResponse: jsonResponse({
        data: [collectionData("collection-1")],
        links: {
          next: { href: `${apiHost}/file-collections?page[cursor]=next-page` },
          self: { href: `${apiHost}/file-collections?page[cursor]=self-page` },
        },
      }),
    });
  }

  async function expectDeleteFileCollection(
    id: string,
    response: { readonly body: JsonBody; readonly statusCode: number } = {
      body: {},
      statusCode: 204,
    }
  ): Promise<void> {
    await mockServer.mockAnyResponse({
      httpRequest: { method: "DELETE", path: `/file-collections/${id}` },
      httpResponse: jsonResponse(response.body, response.statusCode),
    });
  }

  async function verifyDeleteFileCollection(id: string): Promise<void> {
    await mockServer.verify(
      { method: "DELETE", path: `/file-collections/${id}` },
      1,
      1
    );
  }
});

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

function createReq(
  apiHost: string,
  {
    body,
    method,
    query = {},
  }: {
    readonly body?: string;
    readonly method: string;
    readonly query?: Record<string, string | string[]>;
  }
): NextIronRequest {
  const req: MockNextIronRequest = {
    body,
    method,
    query,
    session: createSession(apiHost),
  };
  return req as NextIronRequest;
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
  const session: TestSession = {
    get: jest.fn((key: string) => values.get(key)),
    set: jest.fn((key: string, value: unknown) => {
      values.set(key, value);
    }),
    values,
  };
  return session as unknown as Session;
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
