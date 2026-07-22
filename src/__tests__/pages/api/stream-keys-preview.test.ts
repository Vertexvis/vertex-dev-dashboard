/**
 * @jest-environment node
 */
import { http, HttpResponse } from "msw";

import {
  createAuthenticatedVertexApiTestSession,
  invokeNextJsApiRouteHandler,
} from "../../../../test/api/nextJsApiRouteTest";
import { installNodeMswServer } from "../../../../test/msw/installNodeMswServer";
import { nodeMswServer } from "../../../../test/msw/server";
import { handleStreamKeys } from "../../../pages/api/stream-keys";

const vertexApiOrigin = "https://vertex-api.test";

installNodeMswServer();

describe("scene preview stream-key route", () => {
  it("uses the authenticated session to create an in-memory scene key", async () => {
    nodeMswServer.use(
      http.post(
        `${vertexApiOrigin}/scenes/scene-1/stream-keys`,
        async ({ request }) => {
          expect(await request.json()).toEqual({
            data: {
              attributes: { expiry: 86400 },
              type: "stream-key",
            },
          });
          return HttpResponse.json(
            {
              data: {
                attributes: { key: "stream-secret" },
                id: "key-1",
                type: "stream-key",
              },
            },
            { headers: { "content-type": "application/vnd.api+json" } }
          );
        }
      )
    );

    const response = await invokeNextJsApiRouteHandler(handleStreamKeys, {
      body: JSON.stringify({ id: "scene-1" }),
      method: "POST",
      session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({ key: "stream-secret", status: 200 });
  });

  it("maps a stream-key permission failure without reaching a live service", async () => {
    nodeMswServer.use(
      http.post(`${vertexApiOrigin}/scenes/scene-1/stream-keys`, () =>
        HttpResponse.json(
          { errors: [{ status: "403", title: "Preview forbidden." }] },
          {
            headers: { "content-type": "application/vnd.api+json" },
            status: 403,
          }
        )
      )
    );

    const response = await invokeNextJsApiRouteHandler(handleStreamKeys, {
      body: JSON.stringify({ id: "scene-1" }),
      method: "POST",
      session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
    });

    expect(response.statusCode()).toBe(403);
    expect(response.body()).toEqual({
      message: "Preview forbidden.",
      status: 403,
    });
  });
});
