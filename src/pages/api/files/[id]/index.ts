import {
  FileMetadata,
  head,
  logError,
  VertexError,
} from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../../../lib/api";
import { getClientFromSession } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

type FileData = FileMetadata["data"];

export async function handleFileById(
  req: NextIronRequest,
  res: NextApiResponse<FileData | ErrorRes>
): Promise<void> {
  if (req.method !== "GET") {
    return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
  }

  try {
    const client = await getClientFromSession(req.session);
    const id = head(req.query.id);
    if (id == null) {
      return res
        .status(400)
        .json({ message: "File ID is required.", status: 400 });
    }

    const response = await client.files.getFile({ id });
    return res.status(200).json(response.data.data);
  } catch (error) {
    const vertexError = error as VertexError;
    logError(vertexError);
    const response = vertexError.vertexError?.res
      ? toErrorRes({ failure: vertexError.vertexError.res })
      : ServerError;
    return res.status(response.status).json(response);
  }
}

export default withSession(handleFileById);
