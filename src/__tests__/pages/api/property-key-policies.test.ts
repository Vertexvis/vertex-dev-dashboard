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
import { handlePropertyKeyPolicy } from "../../../pages/api/property-key-policies/[id]";

const vertexApiOrigin = "https://vertex-api.test";

describe("property key policies API routes", () => {
  it("passes supplied ID and paging filters to Vertex", async () => {
    nodeMswServer.use(
      stubListPolicies(
        policyList([policyData("policy-1")]),
        ({ searchParams }) => {
          expect(searchParams.get("page[cursor]")).toBe("cursor-1");
          expect(searchParams.get("page[size]")).toBe("50");
          expect(searchParams.get("filter[suppliedId][contains]")).toBe(
            "LIED-1",
          );
        },
      ),
    );

    const response = await callPolicies({
      method: "GET",
      query: {
        cursor: "cursor-1",
        pageSize: "50",
        suppliedId: "LIED-1",
      },
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [policyData("policy-1")],
      status: 200,
    });
  });

  it("does not forward name or created-at filters upstream", async () => {
    nodeMswServer.use(
      stubListPolicies(
        policyList([policyData("policy-1")]),
        ({ searchParams }) => {
          expect(searchParams.get("filter[name][contains]")).toBeNull();
          expect(searchParams.get("filter[createdAt][gte]")).toBeNull();
          expect(searchParams.get("filter[createdAt][lte]")).toBeNull();
        },
      ),
    );

    const response = await callPolicies({
      method: "GET",
      query: {
        createdAtEnd: "2026-06-11T23:59:59.999Z",
        createdAtStart: "2026-06-11T00:00:00.000Z",
        name: "POLICY",
      },
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [policyData("policy-1")],
      status: 200,
    });
  });

  it("uses the default page size when one is not supplied", async () => {
    nodeMswServer.use(
      stubListPolicies(
        { data: [policyData("policy-1")], links: {} },
        ({ searchParams }) => {
          expect(searchParams.get("page[size]")).toBe("10");
        },
      ),
    );

    const response = await callPolicies({ method: "GET" });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: {},
      data: [policyData("policy-1")],
      status: 200,
    });
  });

  it("creates a policy then upserts its entries verbatim", async () => {
    let createBody: unknown;
    let entriesBody: unknown;

    nodeMswServer.use(
      stubCreatePolicy("policy-1", async (request) => {
        createBody = await request.json();
      }),
      stubUpsertKeys("policy-1", undefined, async (request) => {
        entriesBody = await request.json();
      }),
    );

    const response = await callPolicies({
      body: JSON.stringify({
        keys: ["MixedCaseKey", "another_key", "UPPER"],
        mode: "allowlist",
        name: "My Policy",
        suppliedId: "supplied-1",
      }),
      method: "POST",
    });

    expect(response.statusCode()).toBe(201);
    expect(response.body()).toEqual({
      data: policyData("policy-1"),
      status: 201,
    });

    expect(createBody).toEqual({
      data: {
        attributes: {
          mode: "allowlist",
          name: "My Policy",
          suppliedId: "supplied-1",
        },
        type: "property-key-policy",
      },
    });
    // Keys submitted VERBATIM (mixed case preserved, no normalization).
    expect(entriesBody).toEqual({
      data: [
        { name: "MixedCaseKey" },
        { name: "another_key" },
        { name: "UPPER" },
      ],
    });
  });

  it("trims whitespace from name before sending it upstream", async () => {
    let createBody: unknown;

    nodeMswServer.use(
      stubCreatePolicy("policy-1", async (request) => {
        createBody = await request.json();
      }),
      stubUpsertKeys("policy-1"),
    );

    const response = await callPolicies({
      body: JSON.stringify({
        keys: ["key-1"],
        mode: "allowlist",
        name: "  My Policy  ",
      }),
      method: "POST",
    });

    expect(response.statusCode()).toBe(201);
    expect(createBody).toEqual({
      data: {
        attributes: { mode: "allowlist", name: "My Policy" },
        type: "property-key-policy",
      },
    });
  });

  it("omits suppliedId from the create body when not provided", async () => {
    let createBody: unknown;

    nodeMswServer.use(
      stubCreatePolicy("policy-1", async (request) => {
        createBody = await request.json();
      }),
      stubUpsertKeys("policy-1"),
    );

    const response = await callPolicies({
      body: JSON.stringify({
        keys: ["key-1"],
        mode: "denylist",
        name: "No Supplied",
      }),
      method: "POST",
    });

    expect(response.statusCode()).toBe(201);
    expect(createBody).toEqual({
      data: {
        attributes: { mode: "denylist", name: "No Supplied" },
        type: "property-key-policy",
      },
    });
  });

  it("keeps the created policy and surfaces the keys error when upsert fails", async () => {
    let deleteCalled = false;

    nodeMswServer.use(
      stubCreatePolicy("policy-1"),
      stubUpsertKeys("policy-1", {
        errors: [{ status: "422", title: "Keys could not be created." }],
      }),
      http.delete(`${vertexApiOrigin}/property-key-policies/policy-1`, () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const response = await callPolicies({
      body: JSON.stringify({
        keys: ["key-1"],
        mode: "allowlist",
        name: "Partial",
      }),
      method: "POST",
    });

    expect(response.statusCode()).toBe(201);
    expect(response.body()).toEqual({
      data: policyData("policy-1"),
      keysError: "Keys could not be created.",
      status: 201,
    });
    expect(deleteCalled).toBe(false);
  });

  it("returns Vertex API failures from create requests", async () => {
    nodeMswServer.use(
      stubCreatePolicy("policy-1", undefined, {
        errors: [{ status: "400", title: "Bad policy." }],
      }),
    );

    const response = await callPolicies({
      body: JSON.stringify({
        keys: ["key-1"],
        mode: "allowlist",
        name: "Bad",
      }),
      method: "POST",
    });

    expect(response.statusCode()).toBe(400);
    expect(response.body()).toEqual({ message: "Bad policy.", status: 400 });
  });

  it("validates create request bodies before contacting Vertex", async () => {
    const missingBody = await callPolicies({ method: "POST" });
    const missingName = await callPolicies({
      body: JSON.stringify({ keys: ["k"], mode: "allowlist" }),
      method: "POST",
    });
    const badMode = await callPolicies({
      body: JSON.stringify({ keys: ["k"], mode: "nope", name: "X" }),
      method: "POST",
    });
    const noKeys = await callPolicies({
      body: JSON.stringify({ keys: [], mode: "allowlist", name: "X" }),
      method: "POST",
    });
    const blankKey = await callPolicies({
      body: JSON.stringify({ keys: ["  "], mode: "allowlist", name: "X" }),
      method: "POST",
    });

    expect(missingBody.statusCode()).toBe(400);
    expect(missingBody.body()).toEqual({
      message: "Body required.",
      status: 400,
    });
    for (const invalid of [missingName, badMode, noKeys, blankKey]) {
      expect(invalid.statusCode()).toBe(400);
      expect(invalid.body()).toEqual({ message: "Invalid body.", status: 400 });
    }
  });

  it("validates delete request bodies before contacting Vertex", async () => {
    const missingBody = await callPolicies({ method: "DELETE" });
    const invalidBody = await callPolicies({
      body: JSON.stringify({}),
      method: "DELETE",
    });

    expect(missingBody.statusCode()).toBe(400);
    expect(missingBody.body()).toEqual({
      message: "Body required.",
      status: 400,
    });
    expect(invalidBody.statusCode()).toBe(400);
    expect(invalidBody.body()).toEqual({
      message: "Invalid body.",
      status: 400,
    });
  });

  it("rejects delete bodies whose ids are not an array of strings", async () => {
    const nonArrayIds = await callPolicies({
      body: JSON.stringify({ ids: "policy-1" }),
      method: "DELETE",
    });
    const emptyIds = await callPolicies({
      body: JSON.stringify({ ids: [] }),
      method: "DELETE",
    });
    const nonStringIds = await callPolicies({
      body: JSON.stringify({ ids: ["policy-1", 2] }),
      method: "DELETE",
    });

    for (const invalid of [nonArrayIds, emptyIds, nonStringIds]) {
      expect(invalid.statusCode()).toBe(400);
      expect(invalid.body()).toEqual({ message: "Invalid body.", status: 400 });
    }
  });

  it("deletes when the request body is already a parsed object", async () => {
    const deletedIds: string[] = [];

    nodeMswServer.use(stubDeletePolicy("policy-1", undefined, deletedIds));

    const response = await callPolicies({
      body: { ids: ["policy-1"] },
      method: "DELETE",
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({ deletedIds: ["policy-1"], status: 200 });
    expect(deletedIds).toEqual(["policy-1"]);
  });

  it("deletes each supplied policy ID", async () => {
    const deletedIds: string[] = [];

    nodeMswServer.use(
      stubDeletePolicy("policy-1", undefined, deletedIds),
      stubDeletePolicy("policy-2", undefined, deletedIds),
    );

    const response = await callPolicies({
      body: JSON.stringify({ ids: ["policy-1", "policy-2"] }),
      method: "DELETE",
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      deletedIds: ["policy-1", "policy-2"],
      status: 200,
    });
    expect(deletedIds).toEqual(["policy-1", "policy-2"]);
  });

  it("returns Vertex API failures from delete requests", async () => {
    nodeMswServer.use(
      stubDeletePolicy("policy-1", {
        errors: [{ status: "404", title: "Policy not found." }],
      }),
    );

    const response = await callPolicies({
      body: JSON.stringify({ ids: ["policy-1"] }),
      method: "DELETE",
    });

    expect(response.statusCode()).toBe(404);
    expect(response.body()).toEqual({
      message: "Policy not found.",
      status: 404,
    });
  });

  it("reports successful and failed IDs for a partial delete", async () => {
    nodeMswServer.use(
      stubDeletePolicy("policy-1"),
      stubDeletePolicy("policy-2", {
        errors: [{ status: "404", title: "Policy not found." }],
      }),
    );

    const response = await callPolicies({
      body: JSON.stringify({ ids: ["policy-1", "policy-2"] }),
      method: "DELETE",
    });

    expect(response.statusCode()).toBe(207);
    expect(response.body()).toEqual({
      deletedIds: ["policy-1"],
      failedIds: ["policy-2"],
      message: "Policy not found.",
      status: 207,
    });
  });

  it("gets a policy by ID", async () => {
    nodeMswServer.use(
      stubGetPolicy("policy-1", {
        data: policyData("policy-1"),
        links: {},
      }),
    );

    const response = await callPolicyById("policy-1", { method: "GET" });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      data: policyData("policy-1"),
      status: 200,
    });
  });

  it("returns Vertex API failures from get requests", async () => {
    nodeMswServer.use(
      stubGetPolicy("policy-1", failureBody("500", "Vertex is upset."), 500),
    );

    const response = await callPolicyById("policy-1", { method: "GET" });

    expect(response.statusCode()).toBe(500);
    expect(response.body()).toEqual({
      message: "Vertex is upset.",
      status: 500,
    });
  });

  it("rejects unsupported policy collection methods", async () => {
    const response = await callPolicies({ method: "PUT" });

    expect(response.statusCode()).toBe(405);
    expect(response.body()).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
  });

  it("rejects unsupported single policy methods", async () => {
    const response = await callPolicyById("policy-1", { method: "DELETE" });

    expect(response.statusCode()).toBe(405);
    expect(response.body()).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
  });
});

function callPolicies(req: ApiRouteRequest): Promise<ApiRouteResponse> {
  return callApi(handlePropertyKeyPolicies, req);
}

function callPolicyById(
  id: string,
  req: ApiRouteRequest,
): Promise<ApiRouteResponse> {
  return callApi(handlePropertyKeyPolicy, {
    ...req,
    query: { ...req.query, id },
  });
}

function callApi(
  handler: Parameters<typeof invokeNextJsApiRouteHandler>[0],
  req: ApiRouteRequest,
): Promise<ApiRouteResponse> {
  return invokeNextJsApiRouteHandler(handler, {
    ...req,
    session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
  });
}

function policyData(
  id: string,
  createdAt = "2026-06-10T15:30:00Z",
  name = "Policy One",
) {
  return {
    attributes: {
      createdAt,
      mode: "allowlist",
      name,
      suppliedId: "supplied-1",
    },
    id,
    type: "property-key-policy",
  };
}

function policyList(data: ReturnType<typeof policyData>[]) {
  return {
    data,
    links: {
      next: {
        href: `${vertexApiOrigin}/property-key-policies?page[cursor]=next-page`,
      },
      self: {
        href: `${vertexApiOrigin}/property-key-policies?page[cursor]=self-page`,
      },
    },
  };
}

function failureBody(status: string, title: string) {
  return { errors: [{ status, title }] };
}

function stubListPolicies(
  body: {
    data: ReturnType<typeof policyData>[];
    links: { next?: { href: string }; self?: { href: string } };
  },
  assertRequest?: (request: URL) => void,
) {
  return http.get(`${vertexApiOrigin}/property-key-policies`, ({ request }) => {
    assertRequest?.(new URL(request.url));

    return HttpResponse.json(body, {
      headers: { "content-type": "application/vnd.api+json" },
    });
  });
}

function stubGetPolicy(
  id: string,
  body:
    | ReturnType<typeof failureBody>
    | {
        data: ReturnType<typeof policyData>;
        links: Record<string, never>;
      },
  status = 200,
) {
  return http.get(`${vertexApiOrigin}/property-key-policies/${id}`, () => {
    return HttpResponse.json(body, {
      status,
      headers: { "content-type": "application/vnd.api+json" },
    });
  });
}

function stubCreatePolicy(
  id: string,
  assertRequest?: (request: Request) => Promise<void> | void,
  failure:
    | { errors: Array<{ status: string; title: string }> }
    | undefined = undefined,
) {
  return http.post(
    `${vertexApiOrigin}/property-key-policies`,
    async ({ request }) => {
      await assertRequest?.(request);

      if (failure != null) {
        return HttpResponse.json(failure, {
          status: parseInt(failure.errors[0].status, 10),
          headers: { "content-type": "application/vnd.api+json" },
        });
      }

      return HttpResponse.json(
        { data: policyData(id), links: {} },
        { headers: { "content-type": "application/vnd.api+json" } },
      );
    },
  );
}

function stubUpsertKeys(
  id: string,
  failure:
    | { errors: Array<{ status: string; title: string }> }
    | undefined = undefined,
  assertRequest?: (request: Request) => Promise<void> | void,
) {
  return http.post(
    `${vertexApiOrigin}/property-key-policies/${id}/keys`,
    async ({ request }) => {
      await assertRequest?.(request);

      if (failure != null) {
        return HttpResponse.json(failure, {
          status: parseInt(failure.errors[0].status, 10),
          headers: { "content-type": "application/vnd.api+json" },
        });
      }

      return new HttpResponse(null, { status: 204 });
    },
  );
}

function stubDeletePolicy(
  id: string,
  failure:
    | { errors: Array<{ status: string; title: string }> }
    | undefined = undefined,
  deletedIds?: string[],
) {
  return http.delete(`${vertexApiOrigin}/property-key-policies/${id}`, () => {
    deletedIds?.push(id);

    if (failure == null) {
      return new HttpResponse(null, { status: 204 });
    }

    return HttpResponse.json(failure, {
      status: parseInt(failure.errors[0].status, 10),
      headers: { "content-type": "application/vnd.api+json" },
    });
  });
}
