/**
 * @jest-environment node
 */
import {
  type HttpMockServerHarness,
  startHttpMockServer,
} from "../../../../test/helpers/http-mockserver";
import {
  type NextApiTestHarness,
  startNextApiHarness,
} from "../../../../test/helpers/next-api-harness";
import {
  CredsKey,
  EnvKey,
  NetworkConfig as NetworkConfigKey,
  TokenKey,
} from "../../../lib/with-session";

jest.setTimeout(120_000);
process.env.COOKIE_SECRET = "codex-test-cookie-secret-1234567890";

type JsonBody = Record<string, unknown>;

describe("file collection API routes", () => {
  let app: NextApiTestHarness;
  let mockServer: HttpMockServerHarness;
  let sessionCookie: string;

  beforeAll(async () => {
    mockServer = await startHttpMockServer();
    app = await startNextApiHarness();
    sessionCookie = await app.createSessionCookie(
      createSessionData(mockServer.apiHost)
    );
  });

  afterAll(async () => {
    await app.close();
    await mockServer.stop();
  });

  beforeEach(async () => {
    await mockServer.reset();
  });

  it("lists file collections with query parameters", async () => {
    await expectFileCollectionList(mockServer, {
      "filter[suppliedId]": ["supplied-1"],
      "page[cursor]": ["cursor-1"],
      "page[size]": ["50"],
    });

    const res = await app.request
      .get(
        "/api/file-collections?cursor=cursor-1&pageSize=50&suppliedId=supplied-1"
      )
      .set("Cookie", sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [collectionData("collection-1")],
      status: 200,
    });
    await verifyListFileCollections(mockServer, {
      "filter[suppliedId]": ["supplied-1"],
      "page[cursor]": ["cursor-1"],
      "page[size]": ["50"],
    });
  });

  it("uses the default page size when one is not supplied", async () => {
    await expectFileCollectionList(mockServer, { "page[size]": ["10"] });

    const res = await app.request
      .get("/api/file-collections")
      .set("Cookie", sessionCookie);

    expect(res.status).toBe(200);
    await verifyListFileCollections(mockServer, { "page[size]": ["10"] });
  });

  it("validates delete request bodies before calling Vertex", async () => {
    const missingBody = await app.request
      .delete("/api/file-collections")
      .set("Cookie", sessionCookie);
    const invalidBody = await app.request
      .delete("/api/file-collections")
      .set("Cookie", sessionCookie)
      .set("Content-Type", "text/plain")
      .send("{}");

    expect(missingBody.status).toBe(400);
    expect(missingBody.body).toEqual({
      message: "Body required.",
      status: 400,
    });
    expect(invalidBody.status).toBe(400);
    expect(invalidBody.body).toEqual({
      message: "Invalid body.",
      status: 400,
    });
    await mockServer.verifyZeroInteractions();
  });

  it("deletes each supplied file collection ID", async () => {
    await expectDeleteFileCollection(mockServer, "collection-1");
    await expectDeleteFileCollection(mockServer, "collection-2");

    const res = await app.request
      .delete("/api/file-collections")
      .set("Cookie", sessionCookie)
      .set("Content-Type", "text/plain")
      .send(JSON.stringify({ ids: ["collection-1", "collection-2"] }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 200 });
    await verifyDeleteFileCollection(mockServer, "collection-1");
    await verifyDeleteFileCollection(mockServer, "collection-2");
  });

  it("returns Vertex API failures from delete requests", async () => {
    await expectDeleteFileCollection(mockServer, "collection-1", {
      body: failureBody("404", "Collection not found."),
      statusCode: 404,
    });

    const res = await app.request
      .delete("/api/file-collections")
      .set("Cookie", sessionCookie)
      .set("Content-Type", "text/plain")
      .send(JSON.stringify({ ids: ["collection-1"] }));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      message: "Collection not found.",
      status: 404,
    });
    await verifyDeleteFileCollection(mockServer, "collection-1");
  });

  it("gets a file collection by ID", async () => {
    await mockServer.mockAnyResponse({
      httpRequest: { method: "GET", path: "/file-collections/collection-1" },
      httpResponse: jsonResponse({
        data: collectionData("collection-1"),
        links: {},
      }),
    });

    const res = await app.request
      .get("/api/file-collections/collection-1")
      .set("Cookie", sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: collectionData("collection-1"),
      status: 200,
    });
    await mockServer.verify(
      { method: "GET", path: "/file-collections/collection-1" },
      1,
      1
    );
  });

  it("returns Vertex API failures from get requests", async () => {
    await mockServer.mockAnyResponse({
      httpRequest: { method: "GET", path: "/file-collections/collection-1" },
      httpResponse: jsonResponse(failureBody("500", "Vertex is upset."), 500),
    });

    const res = await app.request
      .get("/api/file-collections/collection-1")
      .set("Cookie", sessionCookie);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      message: "Vertex is upset.",
      status: 500,
    });
  });

  it("rejects unsupported collection methods", async () => {
    const collectionRes = await app.request
      .post("/api/file-collections")
      .set("Cookie", sessionCookie);
    const collectionByIdRes = await app.request
      .delete("/api/file-collections/collection-1")
      .set("Cookie", sessionCookie);

    expect(collectionRes.status).toBe(405);
    expect(collectionRes.body).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
    expect(collectionByIdRes.status).toBe(405);
    expect(collectionByIdRes.body).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
    await mockServer.verifyZeroInteractions();
  });
});

async function expectFileCollectionList(
  mockServer: HttpMockServerHarness,
  queryStringParameters: Record<string, string[]>
): Promise<void> {
  await mockServer.mockAnyResponse({
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
  mockServer: HttpMockServerHarness,
  queryStringParameters: Record<string, string[]>
): Promise<void> {
  await mockServer.verify(
    { method: "GET", path: "/file-collections", queryStringParameters },
    1,
    1
  );
}

async function expectDeleteFileCollection(
  mockServer: HttpMockServerHarness,
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

async function verifyDeleteFileCollection(
  mockServer: HttpMockServerHarness,
  id: string
): Promise<void> {
  await mockServer.verify(
    { method: "DELETE", path: `/file-collections/${id}` },
    1,
    1
  );
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

function createSessionData(apiHost: string): Record<string, unknown> {
  return {
    [CredsKey]: { id: "client-id", secret: "client-secret" },
    [EnvKey]: "custom",
    [NetworkConfigKey]: {
      apiHost,
      name: "mock-server",
      renderingHost: apiHost,
      sceneTreeHost: apiHost,
      sceneViewHost: apiHost,
    },
    [TokenKey]: {
      expiration: Date.now() + 60 * 60 * 1000,
      token: {
        access_token: "test-token",
        account_id: "account-id",
        expires_in: 60 * 60,
        scopes: [],
        token_type: "Bearer",
      },
    },
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
