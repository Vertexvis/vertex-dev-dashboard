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
import { handleFileCollectionFiles } from "../../../pages/api/file-collections/[id]/files";

const vertexApiOrigin = "https://vertex-api.test";
const collectionFilesPath = "/file-collections/collection-1/files";

describe("file collection files list API route", () => {
  it("forwards paging and filter parameters upstream", async () => {
    nodeMswServer.use(
      stubListCollectionFiles(
        [fileData("file-1", "Alpha One.jt", "supplied-1")],
        ({ searchParams }) => {
          expect(searchParams.get("page[cursor]")).toBe("cursor-1");
          expect(searchParams.get("page[size]")).toBe("50");
          expect(searchParams.get("filter[name][contains]")).toBe("Alpha");
          expect(searchParams.get("filter[fileId][contains]")).toBe("file-1");
          expect(searchParams.get("filter[suppliedId][contains]")).toBe(
            "supplied-1"
          );
        }
      )
    );

    const response = await callCollectionFiles({
      method: "GET",
      query: {
        id: "collection-1",
        cursor: "cursor-1",
        fileId: "file-1",
        name: "Alpha",
        pageSize: "50",
        suppliedId: "supplied-1",
      },
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [fileData("file-1", "Alpha One.jt", "supplied-1")],
      status: 200,
    });
  });

  it("uses the default page size and omits filters when none are supplied", async () => {
    nodeMswServer.use(
      stubListCollectionFiles(
        [fileData("file-1", "Alpha One.jt", "supplied-1")],
        ({ searchParams }) => {
          expect(searchParams.get("page[size]")).toBe("10");
          expect([...searchParams.keys()]).toEqual(["page[size]"]);
        }
      )
    );

    const response = await callCollectionFiles({
      method: "GET",
      query: { id: "collection-1" },
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [fileData("file-1", "Alpha One.jt", "supplied-1")],
      status: 200,
    });
  });

  // Temporary stand-in behavior: while upstream filter support on this
  // relationship is unconfirmed, the route also filters the returned page.
  it.each([
    ["name", "two", ["file-2"]],
    ["fileId", "file-1", ["file-1"]],
    ["suppliedId", "SUPPLIED-2", ["file-2"]],
  ])(
    "applies the stand-in %s filter when upstream ignores it",
    async (filterName, filterValue, expectedIds) => {
      nodeMswServer.use(
        stubListCollectionFiles(
          [
            fileData("file-1", "Alpha One.jt", "supplied-1"),
            fileData("file-2", "Beta Two.jt", "supplied-2"),
          ],
          () => undefined
        )
      );

      const response = await callCollectionFiles({
        method: "GET",
        query: { id: "collection-1", [filterName]: filterValue },
      });

      expect(response.statusCode()).toBe(200);
      const body = response.body() as { data: { id: string }[] };
      expect(body.data.map((file) => file.id)).toEqual(expectedIds);
    }
  );
});

function callCollectionFiles(req: ApiRouteRequest): Promise<ApiRouteResponse> {
  return invokeNextJsApiRouteHandler(handleFileCollectionFiles, {
    ...req,
    session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
  });
}

function stubListCollectionFiles(
  data: ReturnType<typeof fileData>[],
  assertRequest: (request: URL) => void
) {
  return http.get(
    `${vertexApiOrigin}${collectionFilesPath}`,
    ({ request }) => {
      assertRequest(new URL(request.url));

      return HttpResponse.json(
        {
          data,
          links: {
            next: {
              href: `${vertexApiOrigin}${collectionFilesPath}?page[cursor]=next-page`,
            },
            self: {
              href: `${vertexApiOrigin}${collectionFilesPath}?page[cursor]=self-page`,
            },
          },
        },
        {
          headers: {
            "content-type": "application/vnd.api+json",
          },
        }
      );
    }
  );
}

function fileData(id: string, name: string, suppliedId: string) {
  return {
    attributes: {
      created: "2026-06-12T15:30:00Z",
      name,
      status: "complete",
      suppliedId,
      uploaded: "2026-06-12T15:31:00Z",
    },
    id,
    type: "file",
  };
}
