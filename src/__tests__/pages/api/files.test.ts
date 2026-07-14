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

describe("files API route", () => {
  beforeAll(async () => {
    nextJsApiTestServer = await createNextJsApiTestServer();
  });

  afterAll(async () => {
    await nextJsApiTestServer?.close();
  });

  beforeEach(() => {
    nodeMswServer.use(stubTokenExchange());
  });

  it("lists files with sort query parameters", async () => {
    nodeMswServer.use(
      stubListFiles(
        {
          data: [fileData("file-1")],
          links: {
            next: {
              href: `${vertexApiOrigin}/files?page[cursor]=next-page`,
            },
            self: {
              href: `${vertexApiOrigin}/files?page[cursor]=self-page`,
            },
          },
        },
        ({ searchParams }) => {
          expect(searchParams.get("page[cursor]")).toBe("cursor-1");
          expect(searchParams.get("page[size]")).toBe("50");
          expect(searchParams.get("sort")).toBe("-created");
        }
      )
    );

    const agent = await createAuthenticatedApiAgent();
    const response = await agent
      .get("/api/files")
      .query({ cursor: "cursor-1", pageSize: "50", sort: "-created" })
      .expect(200);

    expect(response.body).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [fileData("file-1")],
      status: 200,
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
    get: (url: string) =>
      request(nextJsApiTestServer.server).get(url).set("Cookie", sessionCookie),
  };
}

function getSessionCookie(response: request.Response): string {
  const cookie = response.headers["set-cookie"]?.[0];
  expect(cookie).toBeDefined();
  return cookie.split(";", 1)[0];
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

function stubListFiles(
  body: {
    data: ReturnType<typeof fileData>[];
    links: {
      next: { href: string };
      self: { href: string };
    };
  },
  assertRequest: (request: URL) => void
) {
  return http.get(`${vertexApiOrigin}/files`, ({ request }) => {
    assertRequest(new URL(request.url));

    return HttpResponse.json(body, {
      headers: {
        "content-type": "application/vnd.api+json",
      },
    });
  });
}

function fileData(id: string) {
  return {
    attributes: {
      created: "2026-06-10T15:30:00Z",
      name: "alpha.jt",
      status: "completed",
      suppliedId: "supplied-1",
      uploaded: "2026-06-10T15:45:00Z",
    },
    id,
    type: "file",
  };
}
