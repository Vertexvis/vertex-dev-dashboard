import { getPage, head, logError, PartData } from "@vertexvis/api-client-node";
import { NextApiRequest, NextApiResponse } from "next";

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
import { getClient, makeCall } from "../../lib/vertex-api";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse<GetRes<PartData> | Res | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "DELETE") {
    const r = await del(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

async function get(req: NextApiRequest): Promise<ErrorRes | GetRes<PartData>> {
  try {
    const c = await getClient();
    const ps = head(req.query.pageSize);
    const pc = head(req.query.cursor);
    const sId = head(req.query.suppliedId);

    const r = await getPage(() =>
      c.parts.getParts({
        pageCursor: pc,
        pageSize: ps ? parseInt(ps, 10) : 10,
        filterSuppliedId: sId,
      })
    );
    return { cursor: r.cursor, data: r.page.data, status: 200 };
  } catch (error) {
    logError(error);
    return error.vertexError?.res
      ? toErrorRes(error.vertexError?.res)
      : ServerError;
  }
}

async function del(req: NextApiRequest): Promise<ErrorRes | Res> {
  if (!req.body) return BodyRequired;

  const b: DeleteReq = JSON.parse(req.body);
  if (!b.ids) return InvalidBody;

  await Promise.all(
    b.ids.map((id) => makeCall((c) => c.parts.deletePart({ id })))
  );
  return { status: 200 };
}
