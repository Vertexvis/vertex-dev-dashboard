import { head, logError, VertexError } from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  isErrorFailure,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../../lib/api";
import {
  FileJobRes,
  getFileJobsApi,
  toFileJobRes,
} from "../../../lib/file-jobs";
import { getClientFromSession, makeCall } from "../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../lib/with-session";

export async function handleFileJob(
  req: NextIronRequest,
  res: NextApiResponse<FileJobRes | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

export default withSession(handleFileJob);

async function get(req: NextIronRequest): Promise<ErrorRes | FileJobRes> {
  try {
    const id = head(req.query.id);
    if (id == null) return { message: "File Job ID required.", status: 400 };

    const client = await getClientFromSession(req.session);
    const job = await makeCall(() => getFileJobsApi(client).getFileJob({ id }));
    if (isErrorFailure(job)) return toErrorRes({ failure: job });

    return toFileJobRes(job);
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}
