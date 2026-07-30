import { getPage, head, PartRevisionData } from "@vertexvis/api-client-node";

import { ErrorRes, GetRes } from "../../lib/api";
import { methodRouter } from "../../lib/api-handler";
import { parsePositiveQueryInt } from "../../lib/query-params";
import { getClientFromSession } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

export default withSession(methodRouter({ GET: get }));

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<PartRevisionData>> {
  const c = await getClientFromSession(req.session);
  const ps = head(req.query.pageSize);
  const pId = head(req.query.partId);

  if (pId == null) {
    throw new Error("Part ID not set");
  }
  const { cursors, page } = await getPage(() =>
    c.partRevisions.getPartRevisions({
      id: pId,
      pageSize: parsePositiveQueryInt(ps, 10),
    })
  );
  return { cursors, data: page.data, status: 200 };
}
