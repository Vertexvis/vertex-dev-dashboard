/**
 * @jest-environment node
 */
import { rest } from "msw";
import request from "supertest";

import { installNodeMswServer } from "../../../../test/msw/installNodeMswServer";
import { nodeMswServer } from "../../../../test/msw/server";
import { createNextJsApiRouteTestApp } from "../../../../test/nextjs/createNextJsApiRouteTestApp";
import withSession, { CookieAttributes } from "../../../lib/with-session";
import { handleFileCollections } from "../../../pages/api/file-collections";
import { handleFileCollection } from "../../../pages/api/file-collections/[id]";
import { handleLogin } from "../../../pages/api/login";

jest.setTimeout(120_000);

const vertexApiOrigin = "https://vertex-api.test";

process.env.COOKIE_SECRET ||= "test-cookie-secret-that-is-long-enough";
CookieAttributes.password = process.env.COOKIE_SECRET;

const nextJsApiRouteTestApp = createNextJsApiRouteTestApp([
  { handler: withSession(handleLogin), pathname: "/api/login" },
  {
    handler: withSession(handleFileCollections),
    pathname: "/api/file-collections",
  },
  {
    handler: withSession(handleFileCollection),
    pathname: "/api/file-collections/[id]",
  },
]);

installNodeMswServer();

describe("file collection API routes", () => {
  beforeEach(() => {
    nodeMswServer.use(stubTokenExchange());
  });

  it("lists file collections through the route surface", async () => {
    nodeMswServer.use(
      stubListFileCollections({
        data: [fileCollectionData("collection-1")],
        links: {
          next: {
            href: `${vertexApiOrigin}/file-collections?page[cursor]=next-page`,
          },
          self: {
            href: `${vertexApiOrigin}/file-collections?page[cursor]=self-page`,
          },
        },
      })
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
    nodeMswServer.use(
      stubDeleteCollection("collection-1"),
      stubDeleteCollection("collection-2")
    );

    const agent = await createAuthenticatedApiAgent();
    const response = await agent
      .delete("/api/file-collections")
      .set("Content-Type", "text/plain;charset=UTF-8")
      .send(JSON.stringify({ ids: ["collection-1", "collection-2"] }))
      .expect(200);

    expect(response.body).toEqual({ status: 200 });
  });

  it("returns Vertex API failures from delete requests", async () => {
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    nodeMswServer.use(
      stubDeleteCollection("collection-1", {
        errors: [{ status: "404", title: "Collection not found." }],
      })
    );

    try {
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
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
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
      stubListFileCollectionFiles("collection-1", {
        data: [fileData("file-1", "complete")],
        links: {},
      })
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
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    nodeMswServer.use(
      stubGetFileCollection("collection-1", failureBody("500", "Vertex is upset."), 500)
    );

    try {
      const agent = await createAuthenticatedApiAgent();
      const response = await agent
        .get("/api/file-collections/collection-1")
        .expect(500);

      expect(response.body).toEqual({
        message: "Vertex is upset.",
        status: 500,
      });
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("rejects unsupported collection methods through the route surface", async () => {
    const response = await request(nextJsApiRouteTestApp)
      .post("/api/file-collections")
      .expect(405);

    expect(response.body).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
  });

  it("rejects unsupported file collection methods through the route surface", async () => {
    const response = await request(nextJsApiRouteTestApp)
      .delete("/api/file-collections/collection-1")
      .expect(405);

    expect(response.body).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
  });
});

async function createAuthenticatedApiAgent() {
  const agent = request.agent(nextJsApiRouteTestApp);
  const response = await agent
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
  return agent;
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
  return rest.post(`${vertexApiOrigin}/oauth2/token`, (_req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        access_token: "test-access-token",
        expires_in: 3600,
        token_type: "Bearer",
      })
    );
  });
}

function stubListFileCollections(body: {
  data: ReturnType<typeof fileCollectionData>[];
  links: {
    next: { href: string };
    self: { href: string };
  };
}) {
  return rest.get(`${vertexApiOrigin}/file-collections`, (_req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set("content-type", "application/vnd.api+json"),
      ctx.json(body)
    );
  });
}

function stubDeleteCollection(
  id: string,
  failure: { errors: Array<{ status: string; title: string }> } | undefined = undefined
) {
  return rest.delete(
    `${vertexApiOrigin}/file-collections/${id}`,
    (_req, res, ctx) => {
      if (failure == null) {
        return res(ctx.status(204));
      }

      return res(
        ctx.status(parseInt(failure.errors[0].status, 10)),
        ctx.set("content-type", "application/vnd.api+json"),
        ctx.json(failure)
      );
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
  return rest.get(`${vertexApiOrigin}/file-collections/${id}`, (_req, res, ctx) => {
    return res(
      ctx.status(status),
      ctx.set("content-type", "application/vnd.api+json"),
      ctx.json(body)
    );
  });
}

function stubListFileCollectionFiles(
  id: string,
  body: { data: ReturnType<typeof fileData>[]; links: Record<string, never> }
) {
  return rest.get(
    `${vertexApiOrigin}/file-collections/${id}/files`,
    (_req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.set("content-type", "application/vnd.api+json"),
        ctx.json(body)
      );
    }
  );
}
