/**
 * @jest-environment node
 */
import { http, HttpResponse } from "msw";

import {
  type ApiRouteRequest,
  type ApiRouteResponse,
  createAuthenticatedVertexApiTestSession,
  invokeNextJsApiRouteHandler,
} from "../../../../test/api/nextJsApiRouteTest";
import { nodeMswServer } from "../../../../test/msw/server";
import { handlePropertyKeyPolicyKeys } from "../../../pages/api/property-key-policies/[id]/keys";

const vertexApiOrigin = "https://vertex-api.test";

describe("property key policy keys API route", () => {
  it("lists keys for the policy across pages", async () => {
    nodeMswServer.use(
      stubListKeys("policy-1", {
        "": [keyData("key-1", "MixedCaseKey")],
        "cursor-2": [keyData("key-2", "another_key")],
      })
    );

    const response = await callKeys("policy-1", { method: "GET" });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      data: [keyData("key-1", "MixedCaseKey"), keyData("key-2", "another_key")],
      status: 200,
    });
  });

  it("returns Vertex API failures from list requests", async () => {
    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/property-key-policies/policy-1/keys`, () =>
        HttpResponse.json(
          { errors: [{ status: "500", title: "Vertex is upset." }] },
          {
            status: 500,
            headers: { "content-type": "application/vnd.api+json" },
          }
        )
      )
    );

    const response = await callKeys("policy-1", { method: "GET" });

    expect(response.statusCode()).toBe(500);
    expect(response.body()).toEqual({
      message: "Vertex is upset.",
      status: 500,
    });
  });

  it("requires a policy ID", async () => {
    const response = await invokeNextJsApiRouteHandler(
      handlePropertyKeyPolicyKeys,
      {
        method: "GET",
        query: {},
        session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
      }
    );

    expect(response.statusCode()).toBe(400);
    expect(response.body()).toEqual({
      message: "Property Key Policy ID required.",
      status: 400,
    });
  });

  it("fails safely when upstream returns the same cursor repeatedly", async () => {
    // A repeated cursor must not lead to an infinite pagination loop.
    let callCount = 0;

    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/property-key-policies/policy-1/keys`, () => {
        callCount += 1;

        return HttpResponse.json(
          {
            data: [keyData(`key-${callCount}`, `key-${callCount}`)],
            links: {
              next: {
                href: `${vertexApiOrigin}/property-key-policies/policy-1/keys?page[cursor]=stuck-cursor`,
              },
            },
          },
          { headers: { "content-type": "application/vnd.api+json" } }
        );
      })
    );

    const response = await callKeys("policy-1", { method: "GET" });

    expect(response.statusCode()).toBe(500);
    expect(callCount).toBe(2);
    expect(response.body()).toEqual({
      message: "Unknown error from Vertex API.",
      status: 500,
    });
  });

  it("rejects unsupported methods", async () => {
    const response = await callKeys("policy-1", { method: "PATCH" });

    expect(response.statusCode()).toBe(405);
    expect(response.body()).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
  });
});

function callKeys(id: string, req: ApiRouteRequest): Promise<ApiRouteResponse> {
  return invokeNextJsApiRouteHandler(handlePropertyKeyPolicyKeys, {
    ...req,
    query: { ...req.query, id },
    session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
  });
}

function keyData(id: string, name: string) {
  return {
    attributes: { name },
    id,
    type: "property-key",
  };
}

function stubListKeys(
  policyId: string,
  pages: Record<string, ReturnType<typeof keyData>[]>
) {
  return http.get(
    `${vertexApiOrigin}/property-key-policies/${policyId}/keys`,
    ({ request }) => {
      const url = new URL(request.url);
      const cursor = url.searchParams.get("page[cursor]") ?? "";
      const data = pages[cursor];
      const cursors = Object.keys(pages);
      const currentPageIndex = cursors.indexOf(cursor);

      expect(url.searchParams.get("page[size]")).toBe("200");
      expect(data).toBeDefined();
      expect(currentPageIndex).toBeGreaterThanOrEqual(0);

      const nextCursor = cursors[currentPageIndex + 1];

      return HttpResponse.json(
        {
          data,
          links:
            nextCursor == null
              ? {}
              : {
                  next: {
                    href: `${vertexApiOrigin}/property-key-policies/${policyId}/keys?page[cursor]=${nextCursor}`,
                  },
                },
        },
        { headers: { "content-type": "application/vnd.api+json" } }
      );
    }
  );
}
