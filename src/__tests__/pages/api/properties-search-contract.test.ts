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
import { handlePropertyEntries } from "../../../pages/api/property-entries";
import { handlePropertyKeyPolicies } from "../../../pages/api/property-key-policies";
import { handleSearchSessionsDetail } from "../../../pages/api/search-sessions/[id]";

const vertexApiOrigin = "https://vertex-api.test";

installNodeMswServer();

describe("Properties and Search API routes", () => {
  it("scopes property-entry requests with both required filters", async () => {
    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/property-entries`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("filter[resourceId]")).toBe("item-1");
        expect(url.searchParams.get("filter[resourceType]")).toBe("scene-item");
        expect(url.searchParams.get("page[cursor]")).toBe("cursor-1");
        expect(url.searchParams.get("page[size]")).toBe("100");
        return jsonResponse({
          data: [propertyEntry("entry-1")],
          links: links("/property-entries"),
        });
      })
    );

    const response = await call(handlePropertyEntries, "GET", {
      cursor: "cursor-1",
      pageSize: "100",
      resourceId: "item-1",
      resourceType: "scene-item",
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toMatchObject({
      data: [propertyEntry("entry-1")],
      status: 200,
    });
  });

  it("rejects missing or repeated property-entry target filters", async () => {
    const missing = await call(handlePropertyEntries, "GET", {
      resourceId: "item-1",
    });
    const repeated = await call(handlePropertyEntries, "GET", {
      resourceId: ["item-1", "item-2"],
      resourceType: "scene-item",
    });

    expect(missing.body()).toEqual({
      message: "Resource type is required.",
      status: 400,
    });
    expect(repeated.body()).toEqual({
      message: "Invalid resourceId.",
      status: 400,
    });
  });

  it("uses the configured server-side policy adapter without exposing credentials", async () => {
    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/property-key-policies`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("page[cursor]")).toBe("cursor-1");
        expect(url.searchParams.get("page[size]")).toBe("25");
        expect(url.searchParams.get("filter[suppliedId]")).toBeNull();
        expect(request.headers.get("authorization")).toBe(
          "Bearer test-access-token"
        );
        return jsonResponse({
          data: [policy("policy-1")],
          links: links("/property-key-policies"),
        });
      })
    );

    const response = await call(handlePropertyKeyPolicies, "GET", {
      cursor: "cursor-1",
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toMatchObject({
      data: [policy("policy-1")],
      status: 200,
    });
  });

  it("loads a search session by explicit ID and preserves upstream 403", async () => {
    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/search-sessions/session-1`, () =>
        jsonResponse(failure("403", "Search sessions are unavailable."), 403)
      )
    );

    const response = await call(handleSearchSessionsDetail, "GET", {
      id: "session-1",
    });

    expect(response.statusCode()).toBe(403);
    expect(response.body()).toEqual({
      message: "Search sessions are unavailable.",
      status: 403,
    });
  });
});

function call(
  handler: Parameters<typeof invokeNextJsApiRouteHandler>[0],
  method: "GET",
  query: Record<string, string | string[]>
): Promise<ApiRouteResponse> {
  return invokeNextJsApiRouteHandler(handler, {
    method,
    query,
    session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
  });
}

function propertyEntry(id: string): Record<string, unknown> {
  return {
    attributes: {
      key: { name: "material" },
      value: { type: "string", value: "steel" },
    },
    id,
    type: "property-entry",
  };
}

function policy(id: string): Record<string, unknown> {
  return {
    attributes: {
      mode: "allowlist",
      name: "Engineering",
      suppliedId: "engineering",
    },
    id,
    type: "property-key-policy",
  };
}

function links(path: string): Record<string, unknown> {
  return {
    next: { href: `${vertexApiOrigin}${path}?page[cursor]=next-page` },
    self: { href: `${vertexApiOrigin}${path}?page[cursor]=self-page` },
  };
}

function failure(status: string, title: string): Record<string, unknown> {
  return { errors: [{ status, title }] };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return HttpResponse.json(body, {
    headers: { "content-type": "application/vnd.api+json" },
    status,
  });
}
