import { head, logError, VertexError } from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../../lib/api";
import {
  QueuedTranslationJobRes,
  toQueuedTranslationJobRes,
} from "../../../lib/queued-jobs";
import { getClientFromSession } from "../../../lib/vertex-api";
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

    // Call the SDK directly and let the catch below map thrown VertexErrors,
    // matching the sibling queued-translations list route. (makeCall never
    // throws, which left that mapping dead when combined with it.)
    const client = await getClientFromSession(req.session);
    const job = await client.translationInspections.getQueuedTranslationJob({
      id,
    });

    return toQueuedTranslationJobRes(job.data);
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}
