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
import { handleFiles } from "../../../pages/api/files";

const vertexApiOrigin = "https://vertex-api.test";

installNodeMswServer();

describe("files API route", () => {
  it("lists files with sort query parameters", async () => {
    nodeMswServer.use(
      stubListFiles(
        {
          data: [fileData("file-1")],
          links: {
            next: {
              href: `${vertexApiOrigin}/files?page[cursor]=next-page`,
            },
            self: {
              href: `${vertexApiOrigin}/files?page[cursor]=self-page`,
            },
          },
        },
        ({ searchParams }) => {
          expect(searchParams.get("page[cursor]")).toBe("cursor-1");
          expect(searchParams.get("page[size]")).toBe("50");
          expect(searchParams.get("sort")).toBe("-created");
        }
      )
    );

    const response = await callFiles({
      method: "GET",
      query: { cursor: "cursor-1", pageSize: "50", sort: "-created" },
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [fileData("file-1")],
      status: 200,
    });
  });
});

function callFiles(req: ApiRouteRequest): Promise<ApiRouteResponse> {
  return invokeNextJsApiRouteHandler(handleFiles, {
    ...req,
    session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
  });
}

function stubListFiles(
  body: {
    data: ReturnType<typeof fileData>[];
    links: {
      next: { href: string };
      self: { href: string };
    };
  },
  assertRequest: (request: URL) => void
) {
  return http.get(`${vertexApiOrigin}/files`, ({ request }) => {
    assertRequest(new URL(request.url));

    return HttpResponse.json(body, {
      headers: {
        "content-type": "application/vnd.api+json",
      },
    });
  });
}

function fileData(id: string) {
  return {
    attributes: {
      created: "2026-06-10T15:30:00Z",
      name: "alpha.jt",
      status: "completed",
      suppliedId: "supplied-1",
      uploaded: "2026-06-10T15:45:00Z",
    },
    id,
    type: "file",
  };
}
