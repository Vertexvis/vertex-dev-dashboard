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
import { handlePropertyKeyPolicyEntries } from "../../../pages/api/property-key-policies/[id]/entries";

const vertexApiOrigin = "https://vertex-api.test";

describe("property key policy entries API route", () => {
  it("lists entries filtered to the policy across pages", async () => {
    nodeMswServer.use(
      stubListEntries("policy-1", {
        "": [entryData("entry-1", "MixedCaseKey")],
        "cursor-2": [entryData("entry-2", "another_key")],
      })
    );

    const response = await callEntries("policy-1", { method: "GET" });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      data: [
        entryData("entry-1", "MixedCaseKey"),
        entryData("entry-2", "another_key"),
      ],
      status: 200,
    });
  });

  it("returns Vertex API failures from list requests", async () => {
    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/property-key-policy-entries`, () =>
        HttpResponse.json(
          { errors: [{ status: "500", title: "Vertex is upset." }] },
          {
            status: 500,
            headers: { "content-type": "application/vnd.api+json" },
          }
        )
      )
    );

    const response = await callEntries("policy-1", { method: "GET" });

    expect(response.statusCode()).toBe(500);
    expect(response.body()).toEqual({
      message: "Vertex is upset.",
      status: 500,
    });
  });

  it("requires a policy ID", async () => {
    const response = await invokeNextJsApiRouteHandler(
      handlePropertyKeyPolicyEntries,
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

  it("terminates when upstream returns the same cursor repeatedly", async () => {
    // Simulates a misbehaving upstream that always returns the same `next`
    // cursor. The handler should break out of the loop and return 200 with
    // whatever data was accumulated rather than looping forever.
    let callCount = 0;

    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/property-key-policy-entries`, () => {
        callCount += 1;

        return HttpResponse.json(
          {
            data: [entryData(`entry-${callCount}`, `key-${callCount}`)],
            links: {
              next: {
                href: `${vertexApiOrigin}/property-key-policy-entries?page[cursor]=stuck-cursor`,
              },
            },
          },
          { headers: { "content-type": "application/vnd.api+json" } }
        );
      })
    );

    const response = await callEntries("policy-1", { method: "GET" });

    expect(response.statusCode()).toBe(200);
    // The handler should have made exactly 1 upstream call: the first request
    // uses cursor=undefined, gets back next=stuck-cursor, then detects that
    // the next cursor differs from the current (undefined !== "stuck-cursor")
    // and sets cursor to "stuck-cursor". On the second call cursor="stuck-cursor"
    // and next="stuck-cursor" — equal — so the loop breaks after 2 calls total.
    expect(callCount).toBe(2);
    expect(response.body()).toEqual({
      data: [entryData("entry-1", "key-1"), entryData("entry-2", "key-2")],
      status: 200,
    });
  });

  it("rejects unsupported methods", async () => {
    const response = await callEntries("policy-1", { method: "DELETE" });

    expect(response.statusCode()).toBe(405);
    expect(response.body()).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
  });
});

function callEntries(
  id: string,
  req: ApiRouteRequest
): Promise<ApiRouteResponse> {
  return invokeNextJsApiRouteHandler(handlePropertyKeyPolicyEntries, {
    ...req,
    query: { ...req.query, id },
    session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
  });
}

function entryData(id: string, name: string) {
  return {
    attributes: { key: { name } },
    id,
    relationships: {
      propertyKeyPolicy: {
        data: { id: "policy-1", type: "property-key-policy" },
      },
    },
    type: "property-key-policy-entry",
  };
}

function stubListEntries(
  policyId: string,
  pages: Record<string, ReturnType<typeof entryData>[]>
) {
  return http.get(
    `${vertexApiOrigin}/property-key-policy-entries`,
    ({ request }) => {
      const url = new URL(request.url);
      const cursor = url.searchParams.get("page[cursor]") ?? "";
      const data = pages[cursor];
      const cursors = Object.keys(pages);
      const currentPageIndex = cursors.indexOf(cursor);

      expect(url.searchParams.get("filter[propertyKeyPolicy.id]")).toBe(
        policyId
      );
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
                    href: `${vertexApiOrigin}/property-key-policy-entries?page[cursor]=${nextCursor}`,
                  },
                },
        },
        { headers: { "content-type": "application/vnd.api+json" } }
      );
    }
  );
}
