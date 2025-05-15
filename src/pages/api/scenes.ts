import {
  CreateSceneRequestDataAttributes,
  getPage,
  head,
  logError,
  PartDataRelationshipsPartRevisionsTypeEnum,
  QueuedJobData,
  SceneData,
  ScenesApiUpdateSceneRequest,
  UpdateSceneRequestDataAttributes,
  UpdateSceneRequestDataAttributesStateEnum,
  VertexError,
} from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  BodyRequired,
  DeleteReq,
  ErrorRes,
  GetRes,
  InvalidBody,
  MethodNotAllowed,
  Res,
  ServerError,
  toErrorRes,
} from "../../lib/api";
import { getClientFromSession, makeCall } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

export type CreateSceneReq = Pick<
  CreateSceneRequestDataAttributes,
  "suppliedId" | "name"
> & {
  readonly revisionId: string;
};

export type CreateSceneRes = Pick<QueuedJobData, "id"> & Res;

export type UpdateSceneReq = Pick<ScenesApiUpdateSceneRequest, "id"> &
  Pick<
    UpdateSceneRequestDataAttributes,
    "name" | "suppliedId" | "camera" | "metadata"
  >;

export default withSession(async function handle(
  req: NextIronRequest,
  res: NextApiResponse<GetRes<SceneData> | Res | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "DELETE") {
    const r = await del(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "PATCH") {
    const r = await upd(req);
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
): Promise<ErrorRes | GetRes<SceneData>> {
  try {
    const c = await getClientFromSession(req.session);
    const ps = head(req.query.pageSize);
    const pc = head(req.query.cursor);
    const sId = head(req.query.suppliedId);
    const n = head(req.query.name);

    const { cursors, page } = await getPage(() =>
      c.scenes.getScenes({
        pageCursor: pc,
        pageSize: ps ? parseInt(ps, 10) : 10,
        filterSuppliedId: sId,
        filterName: n,
        fieldsScene: "metadata,state,camera,worldOrientation,name,suppliedId,created,modified",
      })
    );
    return { cursors, data: page.data, status: 200 };
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}

async function del(req: NextIronRequest): Promise<ErrorRes | Res> {
  if (!req.body) return BodyRequired;

  const b: DeleteReq = JSON.parse(req.body);
  if (!b.ids) return InvalidBody;

  const c = await getClientFromSession(req.session);
  await Promise.all(
    b.ids.map((id) => makeCall(() => c.scenes.deleteScene({ id })))
  );
  return { status: 200 };
}

async function upd(req: NextIronRequest): Promise<ErrorRes | Res> {
  if (!req.body) return BodyRequired;

  const { id, name, suppliedId, camera, metadata }: UpdateSceneReq = JSON.parse(
    req.body
  );
  const c = await getClientFromSession(req.session);
  await makeCall(() =>
    c.scenes.updateScene({
      id,
      updateSceneRequest: {
        data: {
          attributes: { name, suppliedId, camera, metadata },
          type: "scene",
        },
      },
    })
  );
  return { status: 200 };
}

async function create(
  req: NextIronRequest
): Promise<ErrorRes | CreateSceneRes> {
  const b: CreateSceneReq = JSON.parse(req.body);
  if (!req.body) return InvalidBody;

  const { suppliedId, name, revisionId }: CreateSceneReq = b;

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

  const res = await c.sceneItems.createSceneItem({
    id: sceneId,
    createSceneItemRequest: {
      data: {
        type: "scene-item",
        attributes: {},
        relationships: {
          source: {
            data: {
              type: PartDataRelationshipsPartRevisionsTypeEnum.PartRevision,
              id: revisionId,
            },
          },
        },
      },
    },
  });

  await makeCall(() =>
    c.scenes.updateScene({
      id: sceneId,
      updateSceneRequest: {
        data: {
          attributes: {
            state: UpdateSceneRequestDataAttributesStateEnum.Commit,
          },
          type: "scene",
        },
      },
    })
  );

  return { status: 200, id: res.data.data.id };
}
