import { isFailure } from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import { ErrorRes, MethodNotAllowed, toErrorRes } from "../../../lib/api";
import { ExportRes, parseOpaqueId, toExportRes } from "../../../lib/artifacts";
import { getClientFromSession, makeCall } from "../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../lib/with-session";

export async function handleExport(
  req: NextIronRequest,
  res: NextApiResponse<ExportRes | ErrorRes>
): Promise<void> {
  if (req.method !== "GET") {
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
  const result = await makeCall(() =>
    getClientFromSession(req.session).then((client) =>
      client.exports.getExport({ id })
    )
  );
  if (isFailure(result)) {
    const error = toErrorRes({ failure: result });
    res.status(error.status).json(error);
    return;
  }
  // Deliberately redacts attributes.downloadUrl from all normal data paths.
  res.status(200).json(toExportRes(result.data));
}

export default withSession(handleExport);
