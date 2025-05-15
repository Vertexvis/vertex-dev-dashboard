import {
  getPage,
  head,
  logError,
  QueuedJobData,
  VertexClient,
  VertexError,
} from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  GetRes,
  MethodNotAllowed,
  Res,
  ServerError,
  toErrorRes,
} from "../../lib/api";
import { getClientFromSession } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

export default withSession(async function handle(
  req: NextIronRequest,
  res: NextApiResponse<GetRes<QueuedJobData> | Res | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
});

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<QueuedJobData>> {
  try {
    const c = await getClientFromSession(req.session);
    const ps = head(req.query.pageSize);
    const pc = head(req.query.cursor);
    const fetchAll = (head(req.query.fetchAll) ?? 'false') === 'true';
    const status = head(req.query.status);

    if (status == null) {
      throw new Error("Status not set and is required");
    }

    if (fetchAll) {
      const result: QueuedJobData[] = await fetchAllTranslations(c, status);

      return {
        cursors: {
          next: undefined,
          self: undefined,
        },
        data: result,
        status: 200,
      };
    } else {
      const { cursors, page } = await getPage(() =>
        c.translationInspections.getQueuedTranslationJobs({
          pageCursor: pc,
          pageSize: ps ? parseInt(ps, 10) : 200,
          filterStatus: status,
        })
      );
      return { cursors, data: page.data, status: 200 };
    }

  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}

export const fetchAllTranslations = async (
  c: VertexClient,
  status: string,
): Promise<QueuedJobData[]> => {
  const queuedJobData: QueuedJobData[][] = [];
  let cursor: string | undefined;
  const promises: Array<Promise<unknown>> = [];
  let itemsRemain = true;
  while (itemsRemain) {
    const resPromise = getPage(() =>
      c.translationInspections.getQueuedTranslationJobs({
        pageCursor: cursor ?? undefined,
        pageSize: 200,
        filterStatus: status,
      })
    );
    promises.push(resPromise);
    // eslint-disable-next-line no-await-in-loop
    const { cursors, page } = await resPromise;
    cursor = cursors.next;
    if (cursor === undefined) {
      itemsRemain = false;
    }
    queuedJobData.push(page.data);
  }
  await Promise.all(promises);
  return queuedJobData.flat();
};