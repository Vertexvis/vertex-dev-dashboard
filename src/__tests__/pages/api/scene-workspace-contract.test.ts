/**
 * @jest-environment node
 */
import { http, HttpResponse } from "msw";

import {
  type ApiRouteResponse,
  createAuthenticatedVertexApiTestSession,
  invokeNextJsApiRouteHandler,
} from "../../../../test/api/nextJsApiRouteTest";
import { installNodeMswServer } from "../../../../test/msw/installNodeMswServer";
import { nodeMswServer } from "../../../../test/msw/server";
import { handleSceneWorkspaceItems } from "../../../lib/resources/scene-workspace/scene-workspace-items.hooks";
import { handleSceneWorkspaceViews } from "../../../lib/resources/scene-workspace/scene-workspace-views.hooks";

const vertexApiOrigin = "https://vertex-api.test";

installNodeMswServer();

describe("scene workspace API routes", () => {
  it("serializes scene-item paging and supplied ID filtering through the SDK", async () => {
    nodeMswServer.use(
      http.get(
        `${vertexApiOrigin}/scenes/scene-1/scene-items`,
        ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get("filter[suppliedId]")).toBe("assembly-1");
          expect(url.searchParams.get("page[cursor]")).toBe("cursor-1");
          expect(url.searchParams.get("page[size]")).toBe("100");
          return jsonResponse({
            data: [sceneItem("item-1")],
            links: links("/scenes/scene-1/scene-items"),
          });
        }
      )
    );

    const response = await callRoute(handleSceneWorkspaceItems, {
      cursor: "cursor-1",
      pageSize: "100",
      sceneId: "scene-1",
      suppliedId: "assembly-1",
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [sceneItem("item-1")],
      status: 200,
    });
  });

  it("maps an upstream scene-item failure to the stable error envelope", async () => {
    nodeMswServer.use(
      http.get(
        `${vertexApiOrigin}/scenes/scene-1/scene-items`,
        ({ request }) => {
          expect(new URL(request.url).searchParams.get("page[size]")).toBe(
            "25"
          );
          return jsonResponse(failure("403", "Scene access denied."), 403);
        }
      )
    );

    const response = await callRoute(handleSceneWorkspaceItems, {
      sceneId: "scene-1",
    });

    expect(response.statusCode()).toBe(403);
    expect(response.body()).toEqual({
      message: "Scene access denied.",
      status: 403,
    });
  });

  it("serializes scene-view paging through the SDK", async () => {
    nodeMswServer.use(
      http.get(
        `${vertexApiOrigin}/scenes/scene-1/scene-views`,
        ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get("page[cursor]")).toBe("cursor-1");
          expect(url.searchParams.get("page[size]")).toBe("100");
          return jsonResponse({
            data: [sceneView("view-1")],
            links: links("/scenes/scene-1/scene-views"),
          });
        }
      )
    );

    const response = await callRoute(handleSceneWorkspaceViews, {
      cursor: "cursor-1",
      pageSize: "100",
      sceneId: "scene-1",
    });

    expect(response.statusCode()).toBe(200);
    expect(response.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [sceneView("view-1")],
      status: 200,
    });
  });

  it("maps an upstream scene-view failure to the stable error envelope", async () => {
    nodeMswServer.use(
      http.get(
        `${vertexApiOrigin}/scenes/scene-1/scene-views`,
        ({ request }) => {
          expect(new URL(request.url).searchParams.get("page[size]")).toBe(
            "25"
          );
          return jsonResponse(failure("500", "View service failed."), 500);
        }
      )
    );

    const response = await callRoute(handleSceneWorkspaceViews, {
      sceneId: "scene-1",
    });

    expect(response.statusCode()).toBe(500);
    expect(response.body()).toEqual({
      message: "View service failed.",
      status: 500,
    });
  });
});

function callRoute(
  handler: Parameters<typeof invokeNextJsApiRouteHandler>[0],
  query: Record<string, string>
): Promise<ApiRouteResponse> {
  return invokeNextJsApiRouteHandler(handler, {
    method: "GET",
    query,
    session: createAuthenticatedVertexApiTestSession(vertexApiOrigin),
  });
}

function sceneItem(id: string): Record<string, unknown> {
  return {
    attributes: { name: "Assembly item", suppliedId: "assembly-1" },
    id,
    type: "scene-item",
  };
}

function sceneView(id: string): Record<string, unknown> {
  return {
    attributes: {
      camera: { lookAt: {}, position: {}, up: {} },
      created: "2026-07-21T12:00:00Z",
    },
    id,
    relationships: { scene: { data: { id: "scene-1", type: "scene" } } },
    type: "scene-view",
  };
}

function links(path: string): Record<string, unknown> {
  return {
    next: { href: `${vertexApiOrigin}${path}?page[cursor]=next-page` },
    self: { href: `${vertexApiOrigin}${path}?page[cursor]=self-page` },
  };
}

function failure(status: string, title: string): Record<string, unknown> {
  return { errors: [{ status, title }] };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return HttpResponse.json(body, {
    headers: { "content-type": "application/vnd.api+json" },
    status,
  });
}
