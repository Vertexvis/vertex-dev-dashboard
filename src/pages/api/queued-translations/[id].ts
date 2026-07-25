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
  QueuedTranslationJobRes,
  toQueuedTranslationJobRes,
} from "../../../lib/queued-jobs";
import { getClientFromSession, makeCall } from "../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../lib/with-session";

export async function handleQueuedTranslationJob(
  req: NextIronRequest,
  res: NextApiResponse<QueuedTranslationJobRes | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

export default withSession(handleQueuedTranslationJob);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | QueuedTranslationJobRes> {
  try {
    const id = head(req.query.id);
    if (id == null) {
      return { message: "Translation job ID required.", status: 400 };
    }

    const client = await getClientFromSession(req.session);
    const job = await makeCall(() =>
      client.translationInspections.getQueuedTranslationJob({ id })
    );
    if (isErrorFailure(job)) return toErrorRes({ failure: job });

    return toQueuedTranslationJobRes(job);
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}
