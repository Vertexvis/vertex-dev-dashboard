import {
  getPage,
  head,
  QueuedJobData,
  VertexClient,
} from "@vertexvis/api-client-node";

import { ErrorRes, GetRes } from "../../lib/api";
import { methodRouter } from "../../lib/api-handler";
import { parsePositiveQueryInt } from "../../lib/query-params";
import { getClientFromSession } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

export default withSession(methodRouter({ GET: get }));

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<QueuedJobData>> {
  const c = await getClientFromSession(req.session);
  const ps = head(req.query.pageSize);
  const pc = head(req.query.cursor);
  const fetchAll = (head(req.query.fetchAll) ?? "false") === "true";
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
        pageSize: parsePositiveQueryInt(ps, 200),
        filterStatus: status,
      })
    );
    return { cursors, data: page.data, status: 200 };
  }
}

export const fetchAllTranslations = async (
  c: VertexClient,
  status: string
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
