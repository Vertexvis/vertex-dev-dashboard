import { head } from "@vertexvis/api-client-node";

import { ErrorRes, isErrorFailure, toErrorRes } from "../../../lib/api";
import { methodRouter } from "../../../lib/api-handler";
import {
  FileJobRes,
  getFileJobsApi,
  toFileJobRes,
} from "../../../lib/file-jobs";
import { getClientFromSession, makeCall } from "../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../lib/with-session";

export const handleFileJob = methodRouter({ GET: get });

export default withSession(handleFileJob);

async function get(req: NextIronRequest): Promise<ErrorRes | FileJobRes> {
  const id = head(req.query.id);
  if (id == null) return { message: "File Job ID required.", status: 400 };

  const client = await getClientFromSession(req.session);
  const job = await makeCall(() => getFileJobsApi(client).getFileJob({ id }));
  if (isErrorFailure(job)) return toErrorRes({ failure: job });

  return toFileJobRes(job);
}
