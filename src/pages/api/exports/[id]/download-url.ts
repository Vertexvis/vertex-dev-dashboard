import { isFailure } from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import { ErrorRes, MethodNotAllowed, toErrorRes } from "../../../../lib/api";
import { ExportDownloadUrlRes, parseOpaqueId } from "../../../../lib/artifacts";
import { getClientFromSession, makeCall } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

export async function handleExportDownloadUrl(
  req: NextIronRequest,
  res: NextApiResponse<ExportDownloadUrlRes | ErrorRes>
): Promise<void> {
  if (req.method !== "POST") {
    res.status(MethodNotAllowed.status).json(MethodNotAllowed);
    return;
  }
  const id = Array.isArray(req.query.id)
    ? undefined
    : parseOpaqueId(req.query.id);
  if (id == null) {
    res.status(400).json({ message: "Export ID is required.", status: 400 });
    return;
  }
  const client = await getClientFromSession(req.session);
  const result = await makeCall(() => client.exports.getExport({ id }));
  if (isFailure(result)) {
    const error = toErrorRes({ failure: result });
    res.status(error.status).json(error);
    return;
  }
  const url = result.data.attributes.downloadUrl;
  if (typeof url !== "string" || url.trim() === "") {
    res
      .status(502)
      .json({ message: "Export download is unavailable.", status: 502 });
    return;
  }
  // This is the sole response that carries the short-lived URL.
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ status: 200, url });
}

export default withSession(handleExportDownloadUrl);
