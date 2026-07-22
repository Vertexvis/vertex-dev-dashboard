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
import { handleDocuments } from "../../../pages/api/documents";
import { handleDocumentsDetail } from "../../../pages/api/documents/[id]";

const vertexApiOrigin = "https://vertex-api.test";

installNodeMswServer();

describe("Documents API routes", () => {
  it("serializes the documented list cursor, size, and supplied-ID filter", async () => {
    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/documents`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("filter[suppliedId]")).toBe("doc-a,doc-b");
        expect(url.searchParams.get("page[cursor]")).toBe("cursor-1");
        expect(url.searchParams.get("page[size]")).toBe("25");
        return jsonResponse({
          data: [documentData("document-1", "doc-a")],
          links: {
            next: {
              href: `${vertexApiOrigin}/documents?page[cursor]=cursor-2`,
            },
            self: {
              href: `${vertexApiOrigin}/documents?page[cursor]=cursor-1`,
            },
          },
        });
      })
    );

    const response = await callCollection({
      method: "GET",
      query: { cursor: "cursor-1", pageSize: "25", suppliedId: "doc-a,doc-b" },
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: { next: "cursor-2", self: "cursor-1" },
      data: [documentData("document-1", "doc-a")],
      status: 200,
    });
  });

  it("checks completed Files then serializes a JSON:API document create", async () => {
    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/files/file-1`, () =>
        jsonResponse({
          data: {
            attributes: { status: "complete" },
            id: "file-1",
            type: "file",
          },
        })
      ),
      http.post(`${vertexApiOrigin}/documents`, async ({ request }) => {
        expect(await request.json()).toEqual({
          data: {
            attributes: { fileId: "file-1", suppliedId: "doc-a" },
            type: "document",
          },
        });
        return jsonResponse({ data: documentData("document-1", "doc-a") }, 201);
      })
    );

    const response = await callCollection({
      body: JSON.stringify({ fileId: "file-1", suppliedId: "doc-a" }),
      method: "POST",
    });

    expect(response.statusCode()).toBe(201);
    expect(response.body()).toEqual({
      ...documentData("document-1", "doc-a"),
      status: 201,
    });
  });

  it("returns typed document detail through the generated detail route", async () => {
    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/documents/document-1`, () =>
        jsonResponse({ data: documentData("document-1", "doc-a") })
      )
    );

    const response = await callDetail({
      method: "GET",
      query: { id: "document-1" },
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      ...documentData("document-1", "doc-a"),
      status: 200,
    });
  });

  it("maps Preview list and detail failures without claiming success", async () => {
    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/documents`, () =>
        jsonResponse(
          {
            errors: [
              { status: "403", title: "Document Preview is unavailable." },
            ],
          },
          403
        )
      )
    );
    const list = await callCollection({ method: "GET" });
    expect(list.statusCode()).toBe(403);
    expect(list.body()).toEqual({
      message: "Document Preview is unavailable.",
      status: 403,
    });

    nodeMswServer.use(
      http.get(`${vertexApiOrigin}/documents/missing-document`, () =>
        jsonResponse(
          { errors: [{ status: "404", title: "Document was not found." }] },
          404
        )
      )
    );
    const detail = await callDetail({
      method: "GET",
      query: { id: "missing-document" },
    });
    expect(detail.statusCode()).toBe(404);
    expect(detail.body()).toEqual({
      message: "Document was not found.",
      status: 404,
    });
  });
});

function callCollection(request: ApiRouteRequest): Promise<ApiRouteResponse> {
  return call(handleDocuments, request);
}

function callDetail(request: ApiRouteRequest): Promise<ApiRouteResponse> {
  return call(handleDocumentsDetail, request);
}

function call(
  handler: Parameters<typeof invokeNextJsApiRouteHandler>[0],
  request: ApiRouteRequest
): Promise<ApiRouteResponse> {
  return invokeNextJsApiRouteHandler(handler, {
    ...request,
    session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
  });
}

function documentData(
  id: string,
  suppliedId?: string
): Record<string, unknown> {
  return {
    attributes: {
      createdAt: "2026-07-21T12:00:00Z",
      documentType: "PDF",
      fileId: "file-1",
      ...(suppliedId == null ? {} : { suppliedId }),
    },
    id,
    type: "document",
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return HttpResponse.json(body, {
    headers: { "content-type": "application/vnd.api+json" },
    status,
  });
}
