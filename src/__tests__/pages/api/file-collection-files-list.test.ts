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
  it("forwards paging parameters upstream and passes cursors through when unfiltered", async () => {
    const requests: URL[] = [];
    nodeMswServer.use(
      stubCollectionFilesPages(
        {
          "cursor-1": {
            data: [fileData("file-1", "Alpha One.jt", "supplied-1")],
            nextCursor: "next-page",
          },
        },
        requests
      )
    );

    const response = await callCollectionFiles({
      method: "GET",
      query: { id: "collection-1", cursor: "cursor-1", pageSize: "50" },
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get("page[cursor]")).toBe("cursor-1");
    expect(requests[0].searchParams.get("page[size]")).toBe("50");
    expect([...requests[0].searchParams.keys()]).toEqual([
      "page[cursor]",
      "page[size]",
    ]);
    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [fileData("file-1", "Alpha One.jt", "supplied-1")],
      status: 200,
    });
  });

  it("uses the default page size and omits filters when none are supplied", async () => {
    const requests: URL[] = [];
    nodeMswServer.use(
      stubCollectionFilesPages(
        {
          "": {
            data: [fileData("file-1", "Alpha One.jt", "supplied-1")],
            nextCursor: "next-page",
          },
        },
        requests
      )
    );

    const response = await callCollectionFiles({
      method: "GET",
      query: { id: "collection-1" },
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.get("page[size]")).toBe("10");
    expect([...requests[0].searchParams.keys()]).toEqual(["page[size]"]);
    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [fileData("file-1", "Alpha One.jt", "supplied-1")],
      status: 200,
    });
  });

  it("scans with forwarded filter parameters and drops the request cursor when filtered", async () => {
    const requests: URL[] = [];
    nodeMswServer.use(
      stubCollectionFilesPages(
        {
          "": { data: [fileData("file-1", "Alpha One.jt", "supplied-1")] },
        },
        requests
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

    expect(requests).toHaveLength(1);
    // The scan starts from the beginning of the collection at its own page
    // size; the request's cursor applies to the unfiltered listing only.
    expect(requests[0].searchParams.get("page[cursor]")).toBeNull();
    expect(requests[0].searchParams.get("page[size]")).toBe("100");
    // Filter params are still forwarded so the route self-heals once the
    // service honors them.
    expect(requests[0].searchParams.get("filter[name][contains]")).toBe(
      "Alpha"
    );
    expect(requests[0].searchParams.get("filter[fileId][contains]")).toBe(
      "file-1"
    );
    expect(requests[0].searchParams.get("filter[suppliedId][contains]")).toBe(
      "supplied-1"
    );
    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: { next: undefined, self: undefined },
      data: [fileData("file-1", "Alpha One.jt", "supplied-1")],
      status: 200,
    });
  });

  it("returns matches from later pages when filtered", async () => {
    const requests: URL[] = [];
    nodeMswServer.use(
      stubCollectionFilesPages(
        {
          "": {
            data: [
              fileData("file-1", "Alpha One.jt", "supplied-1"),
              fileData("file-2", "Beta Two.jt", "supplied-2"),
            ],
            nextCursor: "scan-1",
          },
          "scan-1": {
            data: [fileData("file-150", "Gamma 150.jt", "supplied-150")],
          },
        },
        requests
      )
    );

    const response = await callCollectionFiles({
      method: "GET",
      query: { id: "collection-1", name: "gamma" },
    });

    expect(requests).toHaveLength(2);
    expect(requests[1].searchParams.get("page[cursor]")).toBe("scan-1");
    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: { next: undefined, self: undefined },
      data: [fileData("file-150", "Gamma 150.jt", "supplied-150")],
      status: 200,
    });
  });

  it("stops the filtered scan at the page cap, warns, and returns what was gathered", async () => {
    const warn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    try {
      const pages: Record<string, StubPage> = {};
      for (let index = 0; index < 10; index++) {
        pages[index === 0 ? "" : `scan-${index}`] = {
          data: [
            fileData(`file-${index}`, `Match ${index}.jt`, `supplied-${index}`),
          ],
          nextCursor: `scan-${index + 1}`,
        };
      }
      const requests: URL[] = [];
      nodeMswServer.use(stubCollectionFilesPages(pages, requests));

      const response = await callCollectionFiles({
        method: "GET",
        query: { id: "collection-1", name: "match" },
      });

      expect(requests).toHaveLength(10);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("safety cap"));
      expect(response.statusCode()).toBe(200);
      const body = response.body() as {
        cursors: { next?: string };
        data: { id: string }[];
      };
      expect(body.cursors.next).toBeUndefined();
      expect(body.data.map((file) => file.id)).toEqual(
        Array.from({ length: 10 }, (_, index) => `file-${index}`)
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("terminates the filtered scan when upstream repeats a cursor", async () => {
    const requests: URL[] = [];
    nodeMswServer.use(
      stubCollectionFilesPages(
        {
          "": {
            data: [fileData("file-1", "Alpha One.jt", "supplied-1")],
            nextCursor: "loop",
          },
          loop: {
            data: [fileData("file-1", "Alpha One.jt", "supplied-1")],
            nextCursor: "loop",
          },
        },
        requests
      )
    );

    const response = await callCollectionFiles({
      method: "GET",
      query: { id: "collection-1", name: "alpha" },
    });

    // First fetch yields cursor "loop"; the second fetch returns "loop"
    // again, so the scan stops instead of spinning to the page cap.
    expect(requests).toHaveLength(2);
    expect(response.statusCode()).toBe(200);
    const body = response.body() as { data: { id: string }[] };
    expect(body.data.map((file) => file.id)).toEqual(["file-1"]);
  });

  it("caps filtered results at the requested page size without a next cursor", async () => {
    nodeMswServer.use(
      stubCollectionFilesPages({
        "": {
          data: [
            fileData("file-1", "Match One.jt", "supplied-1"),
            fileData("file-2", "Match Two.jt", "supplied-2"),
            fileData("file-3", "Match Three.jt", "supplied-3"),
          ],
        },
      })
    );

    const response = await callCollectionFiles({
      method: "GET",
      query: { id: "collection-1", name: "match", pageSize: "2" },
    });

    expect(response.statusCode()).toBe(200);
    const body = response.body() as {
      cursors: { next?: string };
      data: { id: string }[];
    };
    expect(body.cursors.next).toBeUndefined();
    expect(body.data.map((file) => file.id)).toEqual(["file-1", "file-2"]);
  });

  // Stand-in behavior: upstream ignores these filters on this relationship,
  // so the route filters the scanned files itself.
  it.each([
    ["name", "two", ["file-2"]],
    ["fileId", "file-1", ["file-1"]],
    ["suppliedId", "SUPPLIED-2", ["file-2"]],
  ])(
    "applies the stand-in %s filter when upstream ignores it",
    async (filterName, filterValue, expectedIds) => {
      nodeMswServer.use(
        stubCollectionFilesPages({
          "": {
            data: [
              fileData("file-1", "Alpha One.jt", "supplied-1"),
              fileData("file-2", "Beta Two.jt", "supplied-2"),
            ],
          },
        })
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

interface StubPage {
  readonly data: ReturnType<typeof fileData>[];
  readonly nextCursor?: string;
}

// Serves pages keyed by the `page[cursor]` request parameter ("" for the
// first page). Pages without a `nextCursor` omit the `next` link.
function stubCollectionFilesPages(
  pagesByCursor: Record<string, StubPage>,
  requests?: URL[]
) {
  return http.get(`${vertexApiOrigin}${collectionFilesPath}`, ({ request }) => {
    const url = new URL(request.url);
    requests?.push(url);

    const page = pagesByCursor[url.searchParams.get("page[cursor]") ?? ""];
    if (page == null) {
      return HttpResponse.json(
        { errors: [{ status: "404" }] },
        { status: 404 }
      );
    }

    return HttpResponse.json(
      {
        data: page.data,
        links: {
          ...(page.nextCursor == null
            ? {}
            : {
                next: {
                  href: `${vertexApiOrigin}${collectionFilesPath}?page[cursor]=${page.nextCursor}`,
                },
              }),
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
  });
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
