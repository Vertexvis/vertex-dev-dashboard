import { head, logError, VertexError } from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  InvalidBody,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../../../lib/api";
import { getClientFromSession } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

const DefaultDownloadExpirySeconds = 30;

export default withSession(handleFileDownload);

export async function handleFileDownload(
  req: NextIronRequest,
  res: NextApiResponse<ErrorRes>
): Promise<void> {
  if (req.method !== "GET") {
    return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
  }

  try {
    const id = head(req.query.id);
    if (id == null) return res.status(InvalidBody.status).json(InvalidBody);

    const client = await getClientFromSession(req.session);
    const downloadRes = await client.files.createDownloadUrl({
      id,
      createDownloadRequest: {
        data: {
          type: "download-url",
          attributes: { expiry: DefaultDownloadExpirySeconds },
        },
      },
    });
    const url =
      downloadRes.data.data.attributes.uri ??
      downloadRes.data.data.attributes.downloadUrl;
    if (url == null) return res.status(ServerError.status).json(ServerError);

    res.redirect(302, url);
    return;
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    const response = e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError.res })
      : ServerError;
    return res.status(response.status).json(response);
  }
}
