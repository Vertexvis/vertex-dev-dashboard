/**
 * @jest-environment node
 */
import { rest } from "msw";
import request from "supertest";

import { installNodeMswServer } from "../../../../test/msw/installNodeMswServer";
import { nodeMswServer } from "../../../../test/msw/server";
import { createNextJsPagesApiTestApp } from "../../../../test/nextjs/createNextJsPagesApiTestApp";
import withSession, { CookieAttributes } from "../../../lib/with-session";
import { handleFileCollections } from "../../../pages/api/file-collections";
import { handleLogin } from "../../../pages/api/login";

jest.setTimeout(120_000);

const vertexApiOrigin = "https://vertex-api.test";

process.env.COOKIE_SECRET ||= "test-cookie-secret-that-is-long-enough";
CookieAttributes.password = process.env.COOKIE_SECRET;

const nextJsPagesApiApp = createNextJsPagesApiTestApp([
  { handler: withSession(handleLogin), pathname: "/api/login" },
  {
    handler: withSession(handleFileCollections),
    pathname: "/api/file-collections",
  },
]);

installNodeMswServer();

describe("file collection API routes", () => {
  beforeEach(() => {
    nodeMswServer.use(stubTokenExchange());
  });

  it("lists file collections through the pages API route", async () => {
    const outboundRequests: URL[] = [];

    nodeMswServer.use(
      stubListFileCollections((requestUrl) => {
        outboundRequests.push(requestUrl);

        return {
          data: [fileCollectionData("collection-1")],
          links: {
            next: {
              href: `${vertexApiOrigin}/file-collections?page[cursor]=next-page`,
            },
            self: {
              href: `${vertexApiOrigin}/file-collections?page[cursor]=self-page`,
            },
          },
        };
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
    expect(outboundRequests).toHaveLength(1);
    expect(outboundRequests[0].pathname).toBe("/file-collections");
    expect(outboundRequests[0].searchParams.get("filter[suppliedId]")).toBe(
      "supplied-1"
    );
    expect(outboundRequests[0].searchParams.get("page[cursor]")).toBe("cursor-1");
    expect(outboundRequests[0].searchParams.get("page[size]")).toBe("50");
  });

  it("validates delete request bodies before contacting Vertex", async () => {
    const agent = await createAuthenticatedApiAgent();
    const response = await agent.delete("/api/file-collections").expect(400);

    expect(response.body).toEqual({
      message: "Body required.",
      status: 400,
    });
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

  it("rejects unsupported collection methods through the route surface", async () => {
    const response = await request(nextJsPagesApiApp)
      .post("/api/file-collections")
      .expect(405);

    expect(response.body).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
  });
});

async function createAuthenticatedApiAgent() {
  const agent = request.agent(nextJsPagesApiApp);
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

function stubListFileCollections(
  onRequest: (requestUrl: URL) => {
    data: ReturnType<typeof fileCollectionData>[];
    links: { next: string; self: string };
  }
) {
  return rest.get(`${vertexApiOrigin}/file-collections`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set("content-type", "application/vnd.api+json"),
      ctx.json(onRequest(req.url))
    );
  });
}

function stubDeleteCollection(
  id: string,
  failure: { errors: Array<{ status: string; title: string }> }
) {
  return rest.delete(
    `${vertexApiOrigin}/file-collections/${id}`,
    (_req, res, ctx) => {
      return res(
        ctx.status(404),
        ctx.set("content-type", "application/vnd.api+json"),
        ctx.json(failure)
      );
    }
  );
}
