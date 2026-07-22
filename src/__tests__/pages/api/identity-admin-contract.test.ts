/**
 * @jest-environment node
 */
import { http, HttpResponse } from "msw";

import {
  type ApiRouteResponse,
  createAuthenticatedVertexApiTestSession,
  invokeNextJsApiRouteHandler,
} from "../../../../test/api/nextJsApiRouteTest";
import { installNodeMswServer } from "../../../../test/msw/installNodeMswServer";
import { nodeMswServer } from "../../../../test/msw/server";
import { handleIdentityAdminUsers } from "../../../pages/api/identity-admin/users";
import { handleIdentityAdminUserGroups } from "../../../pages/api/identity-admin/users/[id]/groups";
import { handleIdentityAdminWebhooks } from "../../../pages/api/identity-admin/webhook-subscriptions";

const vertexApiOrigin = "https://vertex-api.test";

installNodeMswServer();

describe("Identity and Administration API routes", () => {
  it("lists users with the documented IDP filter and page bounds", async () => {
    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/users`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("filter[idpId]")).toBe("idp-1");
        expect(url.searchParams.get("page[cursor]")).toBe("cursor-1");
        expect(url.searchParams.get("page[size]")).toBe("100");
        return jsonResponse({
          data: [user("user-1")],
          links: links("/users"),
        });
      })
    );

    const response = await call(handleIdentityAdminUsers, {
      cursor: "cursor-1",
      filterIdpId: "idp-1",
      pageSize: "999",
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toMatchObject({
      data: [user("user-1")],
      status: 200,
    });
  });

  it("rejects repeated scalar values before an upstream call", async () => {
    const response = await call(handleIdentityAdminUsers, {
      filterIdpId: ["idp-1", "idp-2"],
    });

    expect(response.body()).toEqual({
      message: "Invalid filterIdpId.",
      status: 400,
    });
  });

  it("returns a user's canonical group memberships without using the void group-detail SDK method", async () => {
    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/users/user-1/user-groups`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("page[size]")).toBe("25");
        return jsonResponse({
          data: [
            {
              attributes: { name: "Engineering" },
              id: "group-1",
              type: "user-group",
            },
          ],
          links: links("/users/user-1/user-groups"),
        });
      })
    );

    const response = await call(handleIdentityAdminUserGroups, {
      id: "user-1",
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toMatchObject({
      data: [{ attributes: { name: "Engineering" }, id: "group-1" }],
      status: 200,
    });
  });

  it("redacts webhook secrets and endpoint paths from the browser response", async () => {
    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/webhook-subscriptions`, () =>
        jsonResponse({
          data: [
            {
              attributes: {
                created: "2026-01-01T00:00:00Z",
                secret: "must-not-reach-browser",
                status: "active",
                topics: ["scene.created"],
                url: "https://name:password@subscriber.example/hook?token=secret",
              },
              id: "webhook-1",
              type: "webhook-subscription",
            },
          ],
          links: links("/webhook-subscriptions"),
        })
      )
    );

    const response = await call(handleIdentityAdminWebhooks, {});
    const serialized = JSON.stringify(response.body());

    expect(response.statusCode()).toBe(200);
    expect(serialized).toContain("https://subscriber.example/…");
    expect(serialized).not.toContain("must-not-reach-browser");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("token=secret");
  });
});

function call(
  handler: Parameters<typeof invokeNextJsApiRouteHandler>[0],
  query: Record<string, string | string[]>
): Promise<ApiRouteResponse> {
  return invokeNextJsApiRouteHandler(handler, {
    method: "GET",
    query,
    session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
  });
}

function user(id: string): Record<string, unknown> {
  return {
    attributes: {
      createdAt: "2026-01-01T00:00:00Z",
      email: "admin@example.test",
      fullName: "Admin User",
      idpId: "idp-1",
    },
    id,
    type: "user",
  };
}

function links(path: string): Record<string, unknown> {
  return { self: { href: `${vertexApiOrigin}${path}` } };
}

function jsonResponse(body: Record<string, unknown>): HttpResponse {
  return HttpResponse.json(body, {
    headers: { "content-type": "application/vnd.api+json" },
  });
}
