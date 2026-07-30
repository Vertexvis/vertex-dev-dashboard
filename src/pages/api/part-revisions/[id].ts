import { head, PartRevisionData } from "@vertexvis/api-client-node";

import { ErrorRes, Res } from "../../../lib/api";
import { methodRouter } from "../../../lib/api-handler";
import { getClientFromSession } from "../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../lib/with-session";

export default withSession(methodRouter({ GET: get }));

async function get(
  req: NextIronRequest
): Promise<ErrorRes | (PartRevisionData & Res)> {
  const c = await getClientFromSession(req.session);
  const id = head(req.query.id);
  if (id == null) {
    throw new Error("ID not set and is required");
  }

  const item = await c.partRevisions.getPartRevision({
    id,
    fieldsPartRevision:
      "created,name,suppliedId,suppliedIterationId,metadata",
  });

  return { ...item.data.data, status: 200 };
}
