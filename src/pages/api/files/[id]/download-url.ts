import { head } from "@vertexvis/api-client-node";

import { ErrorRes, InvalidBody, ServerError } from "../../../../lib/api";
import { methodRouter } from "../../../../lib/api-handler";
import { FileDownloadUrlRes } from "../../../../lib/files";
import { getClientFromSession } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

const DefaultDownloadExpirySeconds = 30;

export default withSession(methodRouter({ POST: create }));

async function create(
  req: NextIronRequest
): Promise<FileDownloadUrlRes | ErrorRes> {
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

  const { uri: url } = downloadRes.data.data.attributes;
  if (url == null) return ServerError;

  return { status: 200, url };
}
