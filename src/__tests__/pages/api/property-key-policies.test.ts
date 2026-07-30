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
import { handlePropertyKeyPolicies } from "../../../pages/api/property-key-policies";

const vertexApiOrigin = "https://vertex-api.test";

describe("property-key-policies API route", () => {
  it("lists property key policies", async () => {
    nodeMswServer.use(
      stubListPropertyKeyPolicies({
        data: [
          policyData("policy-1", "allowlist", "Allow Names", "supplied-1"),
          policyData("policy-2", "denylist"),
        ],
        links: {
          next: {
            href: `${vertexApiOrigin}/property-key-policies?page[cursor]=next-page`,
          },
          self: {
            href: `${vertexApiOrigin}/property-key-policies?page[cursor]=self-page`,
          },
        },
      })
    );

    const response = await callPropertyKeyPolicies({ method: "GET" });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [
        policyData("policy-1", "allowlist", "Allow Names", "supplied-1"),
        policyData("policy-2", "denylist"),
      ],
      status: 200,
    });
  });

  it("returns an error response when the upstream call fails", async () => {
    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/property-key-policies`, () => {
        return HttpResponse.json(
          {
            errors: [{ status: "403", title: "Forbidden" }],
          },
          { status: 403 }
        );
      })
    );

    const response = await callPropertyKeyPolicies({ method: "GET" });

    expect(response.statusCode()).toBe(500);
  });

  it("returns method not allowed for non-GET methods", async () => {
    const response = await callPropertyKeyPolicies({ method: "POST" });

    expect(response.statusCode()).toBe(405);
    expect(response.body()).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
  });
});

function callPropertyKeyPolicies(
  req: ApiRouteRequest
): Promise<ApiRouteResponse> {
  return invokeNextJsApiRouteHandler(handlePropertyKeyPolicies, {
    ...req,
    session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
  });
}

function stubListPropertyKeyPolicies(body: {
  data: ReturnType<typeof policyData>[];
  links: Record<string, { href: string }>;
}) {
  return http.get(`${vertexApiOrigin}/property-key-policies`, () =>
    HttpResponse.json(body, {
      headers: { "content-type": "application/vnd.api+json" },
    })
  );
}

function policyData(
  id: string,
  mode: "allowlist" | "denylist",
  name?: string,
  suppliedId?: string
) {
  return {
    attributes: {
      createdAt: "2026-01-01T00:00:00Z",
      mode,
      ...(name != null ? { name } : {}),
      ...(suppliedId != null ? { suppliedId } : {}),
    },
    id,
    type: "property-key-policy",
  };
}
