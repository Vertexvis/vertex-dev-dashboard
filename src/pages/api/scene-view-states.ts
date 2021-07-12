import {
  CreateSceneViewStateRequestDataAttributes,
  getPage,
  head,
  logError,
  SceneViewRelationshipDataTypeEnum,
  SceneViewStateData,
} from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  BodyRequired,
  ErrorRes,
  GetRes,
  MethodNotAllowed,
  Res,
  ServerError,
  toErrorRes,
} from "../../lib/api";
import { getClientFromSession } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

export type CreateViewStateReq = Pick<
  CreateSceneViewStateRequestDataAttributes,
  "name"
> & {
  readonly viewId: string;
};

export type CreateViewStateRes = Pick<SceneViewStateData, "id"> & Res;

export default withSession(async function handle(
  req: NextIronRequest,
  res: NextApiResponse<GetRes<SceneViewStateData> | Res | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "POST") {
    const r = await create(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
});

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<SceneViewStateData>> {
  try {
    const c = await getClientFromSession(req.session);
    const vId = head(req.query.view);
    const view = await c.sceneViews.getSceneView({ id: vId });
    const sceneId = view.data.data.relationships.scene.data.id;

    const { cursors, page } = await getPage(() =>
      c.sceneViewStates.getSceneViewStates({
        id: sceneId,
        pageSize: 50,
      })
    );
    return { cursors, data: page.data, status: 200 };
  } catch (error) {
    logError(error);
    return error.vertexError?.res
      ? toErrorRes(error.vertexError?.res)
      : ServerError;
  }
}

async function create(
  req: NextIronRequest
): Promise<ErrorRes | CreateViewStateRes> {
  const b: CreateViewStateReq = JSON.parse(req.body);
  if (!req.body) return BodyRequired;

  const c = await getClientFromSession(req.session);
  const view = await c.sceneViews.getSceneView({ id: b.viewId });
  const sceneId = view.data.data.relationships.scene.data.id;
  const res = await c.sceneViewStates.createSceneViewState({
    id: sceneId,
    createSceneViewStateRequest: {
      data: {
        type: "scene-view-state",
        attributes: {
          name: b.name,
        },
        relationships: {
          source: {
            data: {
              type: SceneViewRelationshipDataTypeEnum.SceneView,
              id: b.viewId,
            },
          },
        },
      },
    },
  });

  return { status: 200, id: res.data.data.id };
}
