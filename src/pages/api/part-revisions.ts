import { head, logError, PartRevisionData } from "@vertexvis/api-client-node";
import { NextApiRequest, NextApiResponse } from "next";

import {
  ErrorRes,
  GetRes,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../lib/api";
import { getClient } from "../../lib/vertex-api";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse<GetRes<PartRevisionData> | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

async function get(
  req: NextApiRequest
): Promise<ErrorRes | GetRes<PartRevisionData>> {
  try {
    const c = await getClient();
    const ps = head(req.query.pageSize);
    const pId = head(req.query.partId);

    const r = await c.partRevisions.getPartRevisions({
      id: pId,
      pageSize: ps ? parseInt(ps, 10) : 10,
    });

    return { data: r.data.data, status: 200 };
  } catch (error) {
    logError(error);
    return error.vertexError?.res
      ? toErrorRes(error.vertexError?.res)
      : ServerError;
  }
}
