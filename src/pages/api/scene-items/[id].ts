import {
  head,
  logError,
  SceneItemData,
  VertexError,
} from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../../lib/api";
import { getClientFromSession } from "../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../lib/with-session";

export default withSession(async function handle(
  req: NextIronRequest,
  res: NextApiResponse<SceneItemData | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(200).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
});

async function get(req: NextIronRequest): Promise<ErrorRes | SceneItemData> {
  try {
    const c = await getClientFromSession(req.session);
    const id = head(req.query.id);
    const item = await c.sceneItems.getSceneItem({
      id,
      fieldsSceneItem: "id,suppliedId,name,metadata",
    });

    return item.data.data;
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}
