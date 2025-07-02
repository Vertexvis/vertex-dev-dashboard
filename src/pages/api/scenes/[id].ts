import {
  head,
  logError,
  SceneData,
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
  res: NextApiResponse<SceneData | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(200).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
});

async function get(req: NextIronRequest): Promise<ErrorRes | SceneData> {
  try {
    const c = await getClientFromSession(req.session);
    const id = head(req.query.id);
    if (id == null) {
      throw new Error("ID not set and is required");
    }

    const item = await c.scenes.getScene({
      id,
      fieldsScene: "id,suppliedId,name,metadata,state,camera,worldOrientation,created,modified,sceneItemCount,treeEnabled",
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
