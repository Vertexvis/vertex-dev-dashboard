import {
  getPage,
  head,
  logError,
  QueuedJobData,
} from "@vertexvis/api-client-node";
import { NextApiRequest, NextApiResponse } from "next";

import {
  ErrorRes,
  GetRes,
  MethodNotAllowed,
  Res,
  ServerError,
  toErrorRes,
} from "../../lib/api";
import { getClient } from "../../lib/vertex-api";

export interface GetQueuedTranslationsRes extends Res {
  readonly cursor?: string;
  readonly data: QueuedJobData[];
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse<GetRes<QueuedJobData> | Res | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

async function get(
  req: NextApiRequest
): Promise<ErrorRes | GetRes<QueuedJobData>> {
  try {
    const c = await getClient();
    const ps = head(req.query.pageSize);
    const pc = head(req.query.cursor);
    const status = head(req.query.status);

    const r = await getPage(() =>
      c.translationInspections.getQueuedTranslations({
        pageCursor: pc,
        pageSize: ps ? parseInt(ps, 10) : 10,
        filterStatus: status,
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
