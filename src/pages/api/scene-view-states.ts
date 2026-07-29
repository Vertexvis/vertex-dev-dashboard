import {
  CreateSceneViewStateRequestDataAttributes,
  getPage,
  head,
  SceneViewRelationshipDataTypeEnum,
  SceneViewStateData,
} from "@vertexvis/api-client-node";

import { BodyRequired, ErrorRes, GetRes, Res } from "../../lib/api";
import { methodRouter } from "../../lib/api-handler";
import { getClientFromSession } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

export type CreateViewStateReq = Pick<
  CreateSceneViewStateRequestDataAttributes,
  "name"
> & {
  readonly viewId: string;
};

export type CreateViewStateRes = Pick<SceneViewStateData, "id"> & Res;

export default withSession(methodRouter({ GET: get, POST: create }));

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<SceneViewStateData>> {
  const c = await getClientFromSession(req.session);
  const vId = head(req.query.view);
  if (vId == null) {
    throw new Error("ID not set and is required");
  }

  const view = await c.sceneViews.getSceneView({ id: vId });
  const sceneId = view.data.data.relationships.scene.data.id;

  const { cursors, page } = await getPage(() =>
    c.sceneViewStates.getSceneViewStates({
      id: sceneId,
      pageSize: 50,
    })
  );
  return { cursors, data: page.data, status: 200 };
}

async function create(
  req: NextIronRequest
): Promise<ErrorRes | CreateViewStateRes> {
  if (!req.body) return BodyRequired;

  const b: CreateViewStateReq = JSON.parse(req.body);

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
