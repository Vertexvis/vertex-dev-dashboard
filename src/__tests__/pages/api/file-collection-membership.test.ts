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
import { installNodeMswServer } from "../../../../test/msw/installNodeMswServer";
import { nodeMswServer } from "../../../../test/msw/server";
import { handleFileCollectionFiles } from "../../../pages/api/file-collections/[id]/files";

const vertexApiOrigin = "https://vertex-api.test";

installNodeMswServer();

describe("file collection membership API route", () => {
  it("serializes typed file membership adds upstream", async () => {
    nodeMswServer.use(
      http.post(
        `${vertexApiOrigin}/file-collections/collection-1/files`,
        async ({ request }) => {
          expect(await request.json()).toEqual({ data: ["file-1", "file-2"] });
          return jsonResponse({ data: collectionData("collection-1") });
        }
      )
    );

    const response = await callRoute({
      body: JSON.stringify({ fileIds: ["file-1", "file-2"] }),
      method: "POST",
      query: { id: "collection-1" },
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({ status: 200 });
  });

  it("serializes relationship removal as the documented filter query", async () => {
    nodeMswServer.use(
      http.delete(
        `${vertexApiOrigin}/file-collections/collection-1/files`,
        ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get("filter[fileId]")).toBe("file-1,file-2");
          return new HttpResponse(null, { status: 204 });
        }
      )
    );

    const response = await callRoute({
      body: JSON.stringify({ fileIds: ["file-1", "file-2"] }),
      method: "DELETE",
      query: { id: "collection-1" },
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({ status: 200 });
  });

  it("maps typed relationship failures without returning success", async () => {
    nodeMswServer.use(
      http.post(`${vertexApiOrigin}/file-collections/collection-1/files`, () =>
        jsonResponse(
          { errors: [{ status: "409", title: "File is already a member." }] },
          409
        )
      )
    );

    const response = await callRoute({
      body: JSON.stringify({ fileIds: ["file-1"] }),
      method: "POST",
      query: { id: "collection-1" },
    });

    expect(response.statusCode()).toBe(409);
    expect(response.body()).toEqual({
      message: "File is already a member.",
      status: 409,
    });
  });

  it("rejects an invalid parent ID without an upstream request", async () => {
    const upstreamRequests: string[] = [];
    nodeMswServer.use(
      http.all(`${vertexApiOrigin}/*`, ({ request }) => {
        upstreamRequests.push(request.url);
        return new HttpResponse(null, { status: 500 });
      })
    );

    const response = await callRoute({
      body: JSON.stringify({ fileIds: ["file-1"] }),
      method: "POST",
      query: { id: "   " },
    });

    expect(response.statusCode()).toBe(400);
    expect(upstreamRequests).toEqual([]);
  });
});

function callRoute(request: ApiRouteRequest): Promise<ApiRouteResponse> {
  return invokeNextJsApiRouteHandler(handleFileCollectionFiles, {
    ...request,
    session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
  });
}

function collectionData(id: string): Record<string, unknown> {
  return {
    attributes: { created: "2026-07-21T12:00:00Z", name: "Fixture" },
    id,
    type: "file-collection",
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return HttpResponse.json(body, {
    headers: { "content-type": "application/vnd.api+json" },
    status,
  });
}
