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
import { handleFileJobs } from "../../../pages/api/file-jobs";
import { handleFileJob } from "../../../pages/api/file-jobs/[id]";

const vertexApiOrigin = "https://vertex-api.test";

describe("file jobs API routes", () => {
  it("creates an output file and archive job with every collection file ID", async () => {
    nodeMswServer.use(
      stubListFileCollectionFiles("collection-1", {
        "": [fileData("file-1", "complete"), fileData("file-2", " COMPLETE ")],
        "cursor-2": [fileData("file-3", "complete")],
      }),
      stubCreateFile("collection-1", "file-collection-collection-1.zip"),
      stubCreateFileJob(["file-1", "file-2", "file-3"])
    );

    const response = await callFileJobs({
      body: JSON.stringify({ fileCollectionId: "collection-1" }),
      method: "POST",
    });

    expect(response.statusCode()).toBe(201);
    expect(response.body()).toEqual({
      archiveFileId: "archive-file-1",
      data: queuedJobData("job-1", {
        links: { archive: { href: "https://zip" } },
      }),
      status: 201,
    });
  });

  it("uses an optional archive name when creating the output file", async () => {
    nodeMswServer.use(
      stubListFileCollectionFiles("collection-1", {
        "": [fileData("file-1", "complete")],
      }),
      stubCreateFile("collection-1", "Custom collection.zip"),
      stubCreateFileJob(["file-1"])
    );

    const response = await callFileJobs({
      body: JSON.stringify({
        archiveName: "Custom collection.zip",
        fileCollectionId: "collection-1",
      }),
      method: "POST",
    });

    expect(response.body()).toMatchObject({
      archiveFileId: "archive-file-1",
      status: 201,
    });
  });

  it("rejects zero-file collections before creating a job", async () => {
    nodeMswServer.use(stubListFileCollectionFiles("collection-1", { "": [] }));

    const response = await callFileJobs({
      body: JSON.stringify({ fileCollectionId: "collection-1" }),
      method: "POST",
    });

    expect(response.statusCode()).toBe(400);
    expect(response.body()).toEqual({
      message: "File collection has no files to export.",
      status: 400,
    });
  });

  it("rejects collections containing non-complete files", async () => {
    nodeMswServer.use(
      stubListFileCollectionFiles("collection-1", {
        "": [fileData("file-1", "completed"), fileData("file-2", "ready")],
      })
    );

    const response = await callFileJobs({
      body: JSON.stringify({ fileCollectionId: "collection-1" }),
      method: "POST",
    });

    expect(response.statusCode()).toBe(400);
    expect(response.body()).toEqual({
      message: "File collection contains files that are not ready to export.",
      status: 400,
    });
  });

  it("proxies file job reads", async () => {
    nodeMswServer.use(
      stubGetFileJob("job-1", {
        data: queuedJobData("job-1", {
          links: { download: { href: "https://zip" } },
        }),
      })
    );

    const response = await callFileJobById("job-1", { method: "GET" });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      data: queuedJobData("job-1", {
        links: { download: { href: "https://zip" } },
      }),
      status: 200,
    });
  });

  it("validates file job requests before contacting Vertex", async () => {
    const missingBody = await callFileJobs({ method: "POST" });
    const invalidBody = await callFileJobs({
      body: "{}",
      method: "POST",
    });
    const missingId = await callFileJobById(undefined, { method: "GET" });
    const unsupportedMethod = await callFileJobById("job-1", {
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
    expect(missingId.statusCode()).toBe(400);
    expect(missingId.body()).toEqual({
      message: "File Job ID required.",
      status: 400,
    });
    expect(unsupportedMethod.statusCode()).toBe(405);
    expect(unsupportedMethod.body()).toEqual({
      message: "Method not allowed.",
      status: 405,
    });
  });
});

function callFileJobs(req: ApiRouteRequest): Promise<ApiRouteResponse> {
  return callApi(handleFileJobs, req);
}

function callFileJobById(
  id: string | undefined,
  req: ApiRouteRequest
): Promise<ApiRouteResponse> {
  return callApi(handleFileJob, {
    ...req,
    query: id == null ? req.query : { ...req.query, id },
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

function stubListFileCollectionFiles(
  id: string,
  pages: Record<string, ReturnType<typeof fileData>[]>
) {
  return http.get(
    `${vertexApiOrigin}/file-collections/${id}/files`,
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

      return HttpResponse.json({
        data,
        links:
          nextCursor == null
            ? {}
            : {
                next: {
                  href: `${vertexApiOrigin}/file-collections/${id}/files?page[cursor]=${nextCursor}`,
                },
              },
      });
    }
  );
}

function stubCreateFile(fileCollectionId: string, name: string) {
  return http.post(`${vertexApiOrigin}/files`, async ({ request }) => {
    expect(await request.json()).toEqual({
      data: {
        attributes: {
          expiry: 86400,
          metadata: { fileCollectionId },
          name,
        },
        type: "file",
      },
    });

    return HttpResponse.json({ data: fileData("archive-file-1", "created") });
  });
}

function stubCreateFileJob(fileIds: string[]) {
  return http.post(`${vertexApiOrigin}/file-jobs`, async ({ request }) => {
    expect(await request.json()).toEqual({
      data: {
        attributes: {
          operation: {
            fileId: "archive-file-1",
            manifest: fileIds.map((id) => ({
              selector: { id, type: "file-by-id" },
            })),
            type: "file-archive-operation",
          },
        },
        type: "file-job",
      },
    });

    return HttpResponse.json({
      data: queuedJobData("job-1", {
        links: { archive: { href: "https://zip" } },
      }),
    });
  });
}

function stubGetFileJob(
  id: string,
  body: { data: ReturnType<typeof queuedJobData> }
) {
  return http.get(`${vertexApiOrigin}/file-jobs/${id}`, () => {
    return HttpResponse.json(body);
  });
}

function queuedJobData(
  id: string,
  dataOverrides: Record<string, unknown> = {}
) {
  return {
    attributes: {
      created: "2026-06-29T15:30:00Z",
      status: "running",
    },
    id,
    type: "queued-job",
    ...dataOverrides,
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
