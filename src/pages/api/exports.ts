import { NextApiResponse } from "next";

import { ErrorRes, MethodNotAllowed } from "../../lib/api";
import { QueuedExportRes } from "../../lib/artifacts";
import withSession, { NextIronRequest } from "../../lib/with-session";

/**
 * Export format/config is an opaque string in both the current public API
 * reference and pinned SDK. Keep the mutation disabled until an authoritative
 * profile is approved rather than emitting a guessed request.
 */
export function handleExports(
  req: NextIronRequest,
  res: NextApiResponse<QueuedExportRes | ErrorRes>
): Promise<void> {
  if (req.method !== "POST") {
    res.status(MethodNotAllowed.status).json(MethodNotAllowed);
    return Promise.resolve();
  }
  res.status(503).json({
    message:
      "Export creation is unavailable until an approved format profile is configured.",
    status: 503,
  });
  return Promise.resolve();
}

export default withSession(handleExports);
