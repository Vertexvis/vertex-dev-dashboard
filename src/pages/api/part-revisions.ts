import {
  getPage,
  head,
  logError,
  PartRevisionData,
  VertexError,
} from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  GetRes,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../lib/api";
import { getClientFromSession } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

export default withSession(async function handle(
  req: NextIronRequest,
  res: NextApiResponse<GetRes<PartRevisionData> | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
});

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<PartRevisionData>> {
  try {
    const c = await getClientFromSession(req.session);
    const ps = head(req.query.pageSize);
    const pId = head(req.query.partId);

    if (pId == null) {
      throw new Error("Part ID not set");
    }
    const { cursors, page } = await getPage(() =>
      c.partRevisions.getPartRevisions({
        id: pId,
        pageSize: ps ? parseInt(ps, 10) : 10,
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
