import {
  SceneData,
  SceneItemRelationshipDataTypeEnum,
  SceneRelationshipDataTypeEnum,
} from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  GetRes,
  InvalidBody,
  MethodNotAllowed,
  Res,
} from "../../lib/api";
import { getClientFromSession } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

export type MergeSceneReq = {
  readonly name?: string;
  readonly suppliedId?: string;
  readonly sceneIds: string[];
};

export type MergeSceneRes = Res & {
  readonly queuedItemIds: string[];
};

export default withSession(async function handle(
  req: NextIronRequest,
  res: NextApiResponse<GetRes<SceneData> | Res | ErrorRes>
): Promise<void> {
  if (req.method === "POST") {
    const r = await create(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
});

async function create(req: NextIronRequest): Promise<ErrorRes | MergeSceneRes> {
  const b: MergeSceneReq = JSON.parse(req.body);
  if (!req.body) return InvalidBody;

  const { suppliedId, name, sceneIds }: MergeSceneReq = b;

  const c = await getClientFromSession(req.session);
  const s = await c.scenes.createScene({
    createSceneRequest: {
      data: {
        type: "scene",
        attributes: {
          name,
          suppliedId,
          treeEnabled: true,
        },
      },
    },
  });


  const sceneId = s.data.data.id;

 await c.sceneItems.createSceneItem({
    id: sceneId,
    createSceneItemRequest: {
      data: {
        type: "scene-item",
        attributes: {
          name,
          suppliedId: suppliedId
        },
        relationships: {},
      },
    },
  });

  const items = await Promise.all(
    sceneIds.map((s) => {
      return c.sceneItems.createSceneItem({
        id: sceneId,
        createSceneItemRequest: {
          data: {
            type: "scene-item",
            attributes: {
              parent: suppliedId
            },
            relationships: {
              source: {
                data: {
                  type: SceneRelationshipDataTypeEnum.Scene,
                  id: s,
                },
              },
            },
          },
        },
      });
    })
  );

  return { status: 200, queuedItemIds: items.map((i) => i.data.data.id) };
}
