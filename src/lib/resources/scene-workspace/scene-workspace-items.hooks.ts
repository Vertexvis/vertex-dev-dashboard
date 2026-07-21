import { getPage, SceneItemData } from "@vertexvis/api-client-node";

import { ErrorRes, GetRes } from "../../api/contracts";
import { requiredQueryValue } from "../../api/query";
import { createVertexRoute, type VertexRouteSpec } from "../../api/route";
import { NextIronRequest } from "../../with-session";

interface SceneWorkspaceItemsQuery {
  readonly cursor?: string;
  readonly pageSize: number;
  readonly sceneId: string;
  readonly suppliedId?: string;
}

type SceneWorkspaceItemsResult = GetRes<SceneItemData> | ErrorRes;

function scalarQueryValue(
  req: NextIronRequest,
  name: string
): string | undefined | ErrorRes {
  const value = req.query[name];
  if (Array.isArray(value)) {
    return { message: `Invalid ${name}.`, status: 400 };
  }
  return value;
}

function parsePageSize(req: NextIronRequest): number | ErrorRes {
  const pageSize = scalarQueryValue(req, "pageSize");
  if (typeof pageSize !== "string") {
    return pageSize ?? 25;
  }
  if (!/^\d+$/.test(pageSize) || Number.parseInt(pageSize, 10) < 1) {
    return { message: "Invalid pageSize.", status: 400 };
  }
  return Math.min(Number.parseInt(pageSize, 10), 100);
}

function parseSceneWorkspaceItemsQuery(
  req: NextIronRequest
): SceneWorkspaceItemsQuery | ErrorRes {
  const sceneId = requiredQueryValue(req, "sceneId", "Scene ID");
  if (typeof sceneId !== "string") return sceneId;
  if (Array.isArray(req.query.sceneId)) {
    return { message: "Invalid sceneId.", status: 400 };
  }

  const pageSize = parsePageSize(req);
  if (typeof pageSize !== "number") return pageSize;
  const cursor = scalarQueryValue(req, "cursor");
  if (typeof cursor !== "string" && cursor != null) return cursor;
  const suppliedId = scalarQueryValue(req, "suppliedId");
  if (typeof suppliedId !== "string" && suppliedId != null) return suppliedId;

  return {
    cursor,
    pageSize,
    sceneId,
    suppliedId: suppliedId?.trim() || undefined,
  };
}

export const sceneWorkspaceItemsCollectionRouteSpec: VertexRouteSpec<
  undefined,
  SceneWorkspaceItemsQuery,
  SceneWorkspaceItemsResult
> = {
  operations: {
    GET: {
      execute: async ({ client, query }) => {
        const { cursors, page } = await getPage(() =>
          client.sceneItems.getSceneItems({
            filterSuppliedId: query.suppliedId,
            id: query.sceneId,
            pageCursor: query.cursor,
            pageSize: query.pageSize,
          })
        );
        return { cursors, data: page.data, status: 200 };
      },
      query: parseSceneWorkspaceItemsQuery,
    },
  },
};

export const handleSceneWorkspaceItems = createVertexRoute(
  sceneWorkspaceItemsCollectionRouteSpec
);
