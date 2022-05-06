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
    const fetchAll = head(req.query.fetchAll);
    const status = head(req.query.status);

    if (fetchAll) {
      const result: QueuedJobData[] = await fetchAllTranslations(c, status, []);

      return {
        cursors: {
          next: undefined,
          self: undefined,
        },
        data: result,
        status: 200,
      };
    }

    const { cursors, page } = await getPage(() =>
      c.translationInspections.getQueuedTranslations({
        pageCursor: pc,
        pageSize: ps ? parseInt(ps, 10) : 200,
        filterStatus: status,
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

async function fetchAllTranslations(
  c: VertexClient,
  status: string,
  currentTranslations: QueuedJobData[],
  cursor?: string
): Promise<QueuedJobData[]> {
  let queuedJobData: QueuedJobData[] = currentTranslations;
  const { cursors, page } = await getPage(() =>
    c.translationInspections.getQueuedTranslations({
      pageCursor: cursor ?? undefined,
      pageSize: 200,
      filterStatus: status,
    })
  );

  queuedJobData = queuedJobData.concat(page.data);
  if (cursors.next != null) {
    const nextPage = await fetchAllTranslations(
      c,
      status,
      queuedJobData,
      cursors.next
    );
    queuedJobData = queuedJobData.concat(nextPage);
  }
  return page.data;
}
