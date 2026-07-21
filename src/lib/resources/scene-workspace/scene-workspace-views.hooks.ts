import { getPage, SceneViewData } from "@vertexvis/api-client-node";

import { ErrorRes, GetRes } from "../../api/contracts";
import { requiredQueryValue } from "../../api/query";
import { createVertexRoute, type VertexRouteSpec } from "../../api/route";
import { NextIronRequest } from "../../with-session";

interface SceneWorkspaceViewsQuery {
  readonly cursor?: string;
  readonly pageSize: number;
  readonly sceneId: string;
}

type SceneWorkspaceViewsResult = GetRes<SceneViewData> | ErrorRes;

function parseSceneWorkspaceViewsQuery(
  req: NextIronRequest
): SceneWorkspaceViewsQuery | ErrorRes {
  const sceneId = requiredQueryValue(req, "sceneId", "Scene ID");
  if (typeof sceneId !== "string") return sceneId;
  if (Array.isArray(req.query.sceneId)) {
    return { message: "Invalid sceneId.", status: 400 };
  }

  const rawPageSize = req.query.pageSize;
  if (Array.isArray(rawPageSize)) {
    return { message: "Invalid pageSize.", status: 400 };
  }
  const pageSize = rawPageSize == null ? 25 : Number.parseInt(rawPageSize, 10);
  if (
    !Number.isFinite(pageSize) ||
    (rawPageSize != null && (!/^\d+$/.test(rawPageSize) || pageSize < 1))
  ) {
    return { message: "Invalid pageSize.", status: 400 };
  }

  const cursor = req.query.cursor;
  if (Array.isArray(cursor)) return { message: "Invalid cursor.", status: 400 };
  return { cursor, pageSize: Math.min(pageSize, 100), sceneId };
}

export const sceneWorkspaceViewsCollectionRouteSpec: VertexRouteSpec<
  undefined,
  SceneWorkspaceViewsQuery,
  SceneWorkspaceViewsResult
> = {
  operations: {
    GET: {
      execute: async ({ client, query }) => {
        const { cursors, page } = await getPage(() =>
          client.sceneViews.getSceneViews({
            id: query.sceneId,
            pageCursor: query.cursor,
            pageSize: query.pageSize,
          })
        );
        return { cursors, data: page.data, status: 200 };
      },
      query: parseSceneWorkspaceViewsQuery,
    },
  },
};

export const handleSceneWorkspaceViews = createVertexRoute(
  sceneWorkspaceViewsCollectionRouteSpec
);
