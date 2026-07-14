/**
 * @jest-environment node
 */
import { http, HttpResponse } from "msw";
import request from "supertest";

import { installNodeMswServer } from "../../../../test/msw/installNodeMswServer";
import { nodeMswServer } from "../../../../test/msw/server";
import {
  createNextJsApiTestServer,
  NextJsApiTestServer,
} from "../../../../test/nextjs/createNextJsApiTestServer";
import { CookieAttributes } from "../../../lib/with-session";

jest.setTimeout(120_000);

const vertexApiOrigin = "https://vertex-api.test";

installNodeMswServer();

process.env.COOKIE_SECRET ||= "test-cookie-secret-that-is-long-enough";
CookieAttributes.password = process.env.COOKIE_SECRET;

let nextJsApiTestServer: NextJsApiTestServer;

describe("file collection API routes", () => {
  beforeAll(async () => {
    nextJsApiTestServer = await createNextJsApiTestServer();
  });

  afterAll(async () => {
    await nextJsApiTestServer?.close();
  });

  beforeEach(() => {
    nodeMswServer.use(stubTokenExchange());
  });

  it("lists file collections through the route surface", async () => {
    nodeMswServer.use(
      stubListFileCollections(
        {
          data: [fileCollectionData("collection-1")],
          links: {
            next: {
              href: `${vertexApiOrigin}/file-collections?page[cursor]=next-page`,
            },
            self: {
              href: `${vertexApiOrigin}/file-collections?page[cursor]=self-page`,
            },
          },
        },
        ({ searchParams }) => {
          expect(searchParams.get("page[cursor]")).toBe("cursor-1");
          expect(searchParams.get("page[size]")).toBe("50");
          expect(searchParams.get("filter[suppliedId]")).toBe("supplied-1");
        }
      )
    );

    const agent = await createAuthenticatedApiAgent();
    const response = await agent
      .get("/api/file-collections")
      .query({ cursor: "cursor-1", pageSize: "50", suppliedId: "supplied-1" })
      .expect(200);

    expect(response.body).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [fileCollectionData("collection-1")],
      status: 200,
    });
  });

  it("validates delete request bodies before contacting Vertex", async () => {
    const agent = await createAuthenticatedApiAgent();

    const missingBodyResponse = await agent
      .delete("/api/file-collections")
      .expect(400);

    const invalidBodyResponse = await agent
      .delete("/api/file-collections")
      .set("Content-Type", "text/plain;charset=UTF-8")
      .send(JSON.stringify({}))
      .expect(400);

    expect(missingBodyResponse.body).toEqual({
      message: "Body required.",
      status: 400,
    });
    expect(invalidBodyResponse.body).toEqual({
      message: "Invalid body.",
      status: 400,
    });
  });

  it("deletes each supplied file collection ID", async () => {
    const deletedIds: string[] = [];

    nodeMswServer.use(
      stubDeleteCollection("collection-1", undefined, deletedIds),
      stubDeleteCollection("collection-2", undefined, deletedIds)
    );

    const agent = await createAuthenticatedApiAgent();
    const response = await agent
      .delete("/api/file-collections")
      .set("Content-Type", "text/plain;charset=UTF-8")
      .send(JSON.stringify({ ids: ["collection-1", "collection-2"] }))
      .expect(200);

    expect(response.body).toEqual({ status: 200 });
    expect(deletedIds).toEqual(["collection-1", "collection-2"]);
  });

  it("returns Vertex API failures from delete requests", async () => {
    nodeMswServer.use(
      stubDeleteCollection("collection-1", {
        errors: [{ status: "404", title: "Collection not found." }],
      })
    );

    const agent = await createAuthenticatedApiAgent();
    const response = await agent
      .delete("/api/file-collections")
      .set("Content-Type", "text/plain;charset=UTF-8")
      .send(JSON.stringify({ ids: ["collection-1"] }))
      .expect(404);

    expect(response.body).toEqual({
      message: "Collection not found.",
      status: 404,
    });
  });

  it("gets a file collection by ID", async () => {
    nodeMswServer.use(
      stubGetFileCollection("collection-1", {
        data: fileCollectionData("collection-1"),
        links: {},
      })
    );

    const agent = await createAuthenticatedApiAgent();
    const response = await agent
      .get("/api/file-collections/collection-1")
      .expect(200);

    expect(response.body).toEqual({
      data: fileCollectionData("collection-1"),
      status: 200,
    });
  });

  it("includes export availability when requested", async () => {
    nodeMswServer.use(
      stubGetFileCollection("collection-1", {
        data: fileCollectionData("collection-1"),
        links: {},
      }),
      stubListFileCollectionFiles(
        "collection-1",
        {
          data: [fileData("file-1", "complete")],
          links: {},
        },
        ({ searchParams }) => {
          expect(searchParams.get("page[size]")).toBe("200");
        }
      )
    );

    const agent = await createAuthenticatedApiAgent();
    const response = await agent
      .get("/api/file-collections/collection-1")
      .query({ includeExportAvailability: "true" })
      .expect(200);

    expect(response.body).toEqual({
      data: fileCollectionData("collection-1"),
      export: { enabled: true, fileCount: 1 },
      status: 200,
    });
  });

  it("returns Vertex API failures from get requests", async () => {
    nodeMswServer.use(
      stubGetFileCollection("collection-1", failureBody("500", "Vertex is upset."), 500)
    );

    const agent = await createAuthenticatedApiAgent();
    const response = await agent
      .get("/api/file-collections/collection-1")
      .expect(500);

    expect(response.body).toEqual({
      message: "Vertex is upset.",
      status: 500,
    });
  });

  it("rejects unsupported collection methods through the route surface", async () => {
    const response = await request(nextJsApiTestServer.server)
      .post("/api/file-collections")
      .expect(405);

    expect(response.body).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
  });

  it("rejects unsupported file collection methods through the route surface", async () => {
    const response = await request(nextJsApiTestServer.server)
      .delete("/api/file-collections/collection-1")
      .expect(405);

    expect(response.body).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
  });
});

async function createAuthenticatedApiAgent() {
  const response = await request(nextJsApiTestServer.server)
    .post("/api/login")
    .set("Content-Type", "text/plain;charset=UTF-8")
    .send(
      JSON.stringify({
        env: "custom",
        id: "test-client-id",
        networkConfig: {
          apiHost: vertexApiOrigin,
          name: "test",
          renderingHost: "https://example.test",
          sceneTreeHost: "https://example.test",
          sceneViewHost: "https://example.test",
        },
        secret: "test-client-secret",
      })
    )
    .expect(200);

  expect(response.body).toEqual({ status: 200 });

  return createAuthenticatedApiRequest(getSessionCookie(response));
}

function createAuthenticatedApiRequest(sessionCookie: string) {
  return {
    delete: (url: string) =>
      request(nextJsApiTestServer.server).delete(url).set("Cookie", sessionCookie),
    get: (url: string) =>
      request(nextJsApiTestServer.server).get(url).set("Cookie", sessionCookie),
  };
}

function getSessionCookie(response: request.Response): string {
  const cookie = response.headers["set-cookie"]?.[0];
  expect(cookie).toBeDefined();
  return cookie.split(";", 1)[0];
}

function fileCollectionData(id: string) {
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

function fileData(id: string, status: string) {
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

function failureBody(status: string, title: string) {
  return {
    errors: [{ status, title }],
  };
}

function stubTokenExchange() {
  return http.post(`${vertexApiOrigin}/oauth2/token`, () => {
    return HttpResponse.json({
      access_token: "test-access-token",
      expires_in: 3600,
      token_type: "Bearer",
    });
  });
}

function stubListFileCollections(body: {
  data: ReturnType<typeof fileCollectionData>[];
  links: {
    next: { href: string };
    self: { href: string };
  };
}, assertRequest?: (request: URL) => void) {
  return http.get(`${vertexApiOrigin}/file-collections`, ({ request }) => {
    const url = new URL(request.url);
    assertRequest?.(url);

    return HttpResponse.json(body, {
      headers: {
        "content-type": "application/vnd.api+json",
      },
    });
  });
}

function stubDeleteCollection(
  id: string,
  failure: { errors: Array<{ status: string; title: string }> } | undefined = undefined,
  deletedIds?: string[]
) {
  return http.delete(
    `${vertexApiOrigin}/file-collections/${id}`,
    () => {
      deletedIds?.push(id);

      if (failure == null) {
        return new HttpResponse(null, { status: 204 });
      }

      return HttpResponse.json(failure, {
        status: parseInt(failure.errors[0].status, 10),
        headers: {
          "content-type": "application/vnd.api+json",
        },
      });
    }
  );
}

function stubGetFileCollection(
  id: string,
  body:
    | ReturnType<typeof failureBody>
    | {
        data: ReturnType<typeof fileCollectionData>;
        links: Record<string, never>;
      },
  status = 200
) {
  return http.get(`${vertexApiOrigin}/file-collections/${id}`, () => {
    return HttpResponse.json(body, {
      status,
      headers: {
        "content-type": "application/vnd.api+json",
      },
    });
  });
}

function stubListFileCollectionFiles(
  id: string,
  body: { data: ReturnType<typeof fileData>[]; links: Record<string, never> },
  assertRequest?: (request: URL) => void
) {
  return http.get(
    `${vertexApiOrigin}/file-collections/${id}/files`,
    ({ request }) => {
      assertRequest?.(new URL(request.url));

      return HttpResponse.json(body, {
        headers: {
          "content-type": "application/vnd.api+json",
        },
      });
    }
  );
}
