import { head, logError, VertexError } from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  InvalidBody,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../../../lib/api";
import { FileDownloadUrlRes } from "../../../../lib/files";
import { getClientFromSession } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

const DefaultDownloadExpirySeconds = 30;

export default withSession(async function handle(
  req: NextIronRequest,
  res: NextApiResponse<FileDownloadUrlRes | ErrorRes>
): Promise<void> {
  if (req.method === "POST") {
    const r = await create(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
});

async function create(
  req: NextIronRequest
): Promise<FileDownloadUrlRes | ErrorRes> {
  try {
    const id = head(req.query.id);
    if (id == null) return InvalidBody;

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
    if (url == null) return ServerError;

    return { status: 200, url };
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError.res })
      : ServerError;
  }
}
