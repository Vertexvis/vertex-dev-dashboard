import {
  getPage,
  head,
  logError,
  SceneData,
  ScenesApiUpdateSceneRequest,
  UpdateSceneRequestDataAttributes,
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

export type UpdateSceneReq = Pick<ScenesApiUpdateSceneRequest, "id"> &
  Pick<UpdateSceneRequestDataAttributes, "name" | "suppliedId">;

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

    const { cursors, page } = await getPage(() =>
      c.scenes.getScenes({
        pageCursor: pc,
        pageSize: ps ? parseInt(ps, 10) : 10,
        filterSuppliedId: sId,
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

  const { id, name, suppliedId }: UpdateSceneReq = JSON.parse(req.body);
  const c = await getClientFromSession(req.session);
  await makeCall(() =>
    c.scenes.updateScene({
      id,
      updateSceneRequest: {
        data: { attributes: { name, suppliedId }, type: "scene" },
      },
    })
  );
  return { status: 200 };
}
