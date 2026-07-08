import {
  FileCollectionMetadataData,
  getPage,
  head,
  logError,
  VertexError,
} from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  GetRes,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../../../lib/api";
import { getClientFromSession } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

export async function handleFileCollectionsByFile(
  req: NextIronRequest,
  res: NextApiResponse<GetRes<FileCollectionMetadataData> | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

export default withSession(handleFileCollectionsByFile);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<FileCollectionMetadataData>> {
  try {
    const id = head(req.query.id);
    if (id == null) return { message: "File ID required.", status: 400 };

    const client = await getClientFromSession(req.session);
    const pageSize = head(req.query.pageSize);
    const cursor = head(req.query.cursor);

    const { cursors, page } = await getPage(() =>
      client.files.listFileCollectionsForFile({
        id,
        pageCursor: cursor,
        pageSize: pageSize ? parseInt(pageSize, 10) : 10,
      })
    );

    return { cursors, data: page.data, status: 200 };
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}
