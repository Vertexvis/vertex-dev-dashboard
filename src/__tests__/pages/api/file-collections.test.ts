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
import { handleFileCollections } from "../../../pages/api/file-collections";
import { handleFileCollection } from "../../../pages/api/file-collections/[id]";

const vertexApiOrigin = "https://vertex-api.test";

installNodeMswServer();

describe("file collection API routes", () => {
  it("passes name and supplied ID filters to Vertex", async () => {
    nodeMswServer.use(
      stubListFileCollections(
        {
          data: [fileCollectionData("collection-1")],
          links: {
            next: {
              href: `${vertexApiOrigin}/file-collections?page[cursor]=next-page`,
            },
            self: {
              href: `${vertexApiOrigin}/file-collections?page[cursor]=self-page`,
            },
          },
        },
        ({ searchParams }) => {
          expect(searchParams.get("page[cursor]")).toBe("cursor-1");
          expect(searchParams.get("page[size]")).toBe("50");
          expect(searchParams.get("filter[name][contains]")).toBe("COLLECT");
          expect(searchParams.get("filter[suppliedId][contains]")).toBe(
            "LIED-1"
          );
        }
      )
    );

    const response = await callFileCollections({
      method: "GET",
      query: {
        cursor: "cursor-1",
        name: "COLLECT",
        pageSize: "50",
        suppliedId: "LIED-1",
      },
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [fileCollectionData("collection-1")],
      status: 200,
    });
  });

  it("returns the collection page supplied by the service without local filtering", async () => {
    nodeMswServer.use(
      stubListFileCollections(
        {
          data: [fileCollectionData("collection-1")],
          links: {
            next: {
              href: `${vertexApiOrigin}/file-collections?page[cursor]=next-page`,
            },
            self: {
              href: `${vertexApiOrigin}/file-collections?page[cursor]=self-page`,
            },
          },
        },
        ({ searchParams }) => {
          expect(searchParams.get("filter[name][contains]")).toBe("missing");
          expect(searchParams.get("page[size]")).toBe("10");
        }
      )
    );

    const response = await callFileCollections({
      method: "GET",
      query: { name: "missing" },
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [fileCollectionData("collection-1")],
      status: 200,
    });
  });

  it("uses the default page size when one is not supplied", async () => {
    nodeMswServer.use(
      stubListFileCollections(
        {
          data: [fileCollectionData("collection-1")],
          links: {},
        },
        ({ searchParams }) => {
          expect(searchParams.get("page[size]")).toBe("10");
        }
      )
    );

    const response = await callFileCollections({ method: "GET" });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: {},
      data: [fileCollectionData("collection-1")],
      status: 200,
    });
  });

  it("validates delete request bodies before contacting Vertex", async () => {
    const missingBodyResponse = await callFileCollections({ method: "DELETE" });
    const invalidBodyResponse = await callFileCollections({
      body: JSON.stringify({}),
      method: "DELETE",
    });

    expect(missingBodyResponse.statusCode()).toBe(400);
    expect(missingBodyResponse.body()).toEqual({
      message: "Body required.",
      status: 400,
    });
    expect(invalidBodyResponse.statusCode()).toBe(400);
    expect(invalidBodyResponse.body()).toEqual({
      message: "Invalid body.",
      status: 400,
    });
  });

  it("deletes each supplied file collection ID", async () => {
    const deletedIds: string[] = [];

    nodeMswServer.use(
      stubDeleteCollection("collection-1", undefined, deletedIds),
      stubDeleteCollection("collection-2", undefined, deletedIds)
    );

    const response = await callFileCollections({
      body: JSON.stringify({ ids: ["collection-1", "collection-2"] }),
      method: "DELETE",
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({ status: 200 });
    expect(deletedIds).toEqual(["collection-1", "collection-2"]);
  });

  it("returns Vertex API failures from delete requests", async () => {
    nodeMswServer.use(
      stubDeleteCollection("collection-1", {
        errors: [{ status: "404", title: "Collection not found." }],
      })
    );

    const response = await callFileCollections({
      body: JSON.stringify({ ids: ["collection-1"] }),
      method: "DELETE",
    });

    expect(response.statusCode()).toBe(404);
    expect(response.body()).toEqual({
      message: "Collection not found.",
      status: 404,
    });
  });

  it("gets a file collection by ID", async () => {
    nodeMswServer.use(
      stubGetFileCollection("collection-1", {
        data: fileCollectionData("collection-1"),
        links: {},
      })
    );

    const response = await callFileCollectionById("collection-1", {
      method: "GET",
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      data: fileCollectionData("collection-1"),
      status: 200,
    });
  });

  it("includes export availability when requested", async () => {
    nodeMswServer.use(
      stubGetFileCollection("collection-1", {
        data: fileCollectionData("collection-1"),
        links: {},
      }),
      stubListFileCollectionFiles(
        "collection-1",
        {
          data: [fileData("file-1", "complete")],
          links: {},
        },
        ({ searchParams }) => {
          expect(searchParams.get("page[size]")).toBe("200");
        }
      )
    );

    const response = await callFileCollectionById("collection-1", {
      method: "GET",
      query: { includeExportAvailability: "true" },
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      data: fileCollectionData("collection-1"),
      export: { enabled: true, fileCount: 1 },
      status: 200,
    });
  });

  it("returns Vertex API failures from get requests", async () => {
    nodeMswServer.use(
      stubGetFileCollection(
        "collection-1",
        failureBody("500", "Vertex is upset."),
        500
      )
    );

    const response = await callFileCollectionById("collection-1", {
      method: "GET",
    });

    expect(response.statusCode()).toBe(500);
    expect(response.body()).toEqual({
      message: "Vertex is upset.",
      status: 500,
    });
  });

  it("rejects unsupported collection methods", async () => {
    const response = await callFileCollections({ method: "POST" });

    expect(response.statusCode()).toBe(405);
    expect(response.body()).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
  });

  it("rejects unsupported file collection methods", async () => {
    const response = await callFileCollectionById("collection-1", {
      method: "DELETE",
    });

    expect(response.statusCode()).toBe(405);
    expect(response.body()).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
  });
});

function callFileCollections(req: ApiRouteRequest): Promise<ApiRouteResponse> {
  return callApi(handleFileCollections, req);
}

function callFileCollectionById(
  id: string,
  req: ApiRouteRequest
): Promise<ApiRouteResponse> {
  return callApi(handleFileCollection, {
    ...req,
    query: { ...req.query, id },
  });
}

function callApi(
  handler: Parameters<typeof invokeNextJsApiRouteHandler>[0],
  req: ApiRouteRequest
): Promise<ApiRouteResponse> {
  return invokeNextJsApiRouteHandler(handler, {
    ...req,
    session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
  });
}

function fileCollectionData(id: string) {
  return {
    attributes: {
      created: "2026-06-10T15:30:00Z",
      name: "Collection One",
      suppliedId: "supplied-1",
    },
    id,
    type: "file-collection",
  };
}

function fileData(id: string, status: string) {
  return {
    attributes: {
      created: "2026-06-12T15:30:00Z",
      name: `${id}.jt`,
      status,
      suppliedId: `${id}-supplied`,
      uploaded: "2026-06-12T15:31:00Z",
    },
    id,
    type: "file",
  };
}

function failureBody(status: string, title: string) {
  return {
    errors: [{ status, title }],
  };
}

function stubListFileCollections(
  body: {
    data: ReturnType<typeof fileCollectionData>[];
    links: {
      next?: { href: string };
      self?: { href: string };
    };
  },
  assertRequest?: (request: URL) => void
) {
  return http.get(`${vertexApiOrigin}/file-collections`, ({ request }) => {
    const url = new URL(request.url);
    assertRequest?.(url);

    return HttpResponse.json(body, {
      headers: {
        "content-type": "application/vnd.api+json",
      },
    });
  });
}

function stubDeleteCollection(
  id: string,
  failure:
    | { errors: Array<{ status: string; title: string }> }
    | undefined = undefined,
  deletedIds?: string[]
) {
  return http.delete(`${vertexApiOrigin}/file-collections/${id}`, () => {
    deletedIds?.push(id);

    if (failure == null) {
      return new HttpResponse(null, { status: 204 });
    }

    return HttpResponse.json(failure, {
      status: parseInt(failure.errors[0].status, 10),
      headers: {
        "content-type": "application/vnd.api+json",
      },
    });
  });
}

function stubGetFileCollection(
  id: string,
  body:
    | ReturnType<typeof failureBody>
    | {
        data: ReturnType<typeof fileCollectionData>;
        links: Record<string, never>;
      },
  status = 200
) {
  return http.get(`${vertexApiOrigin}/file-collections/${id}`, () => {
    return HttpResponse.json(body, {
      status,
      headers: {
        "content-type": "application/vnd.api+json",
      },
    });
  });
}

function stubListFileCollectionFiles(
  id: string,
  body: { data: ReturnType<typeof fileData>[]; links: Record<string, never> },
  assertRequest?: (request: URL) => void
) {
  return http.get(
    `${vertexApiOrigin}/file-collections/${id}/files`,
    ({ request }) => {
      assertRequest?.(new URL(request.url));

      return HttpResponse.json(body, {
        headers: {
          "content-type": "application/vnd.api+json",
        },
      });
    }
  );
}
