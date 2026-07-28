import { FileMetadataData, getPage, head } from "@vertexvis/api-client-node";

import { ErrorRes, GetRes } from "../../../../lib/api";
import { methodRouter } from "../../../../lib/api-handler";
import { getFileCollectionsApi } from "../../../../lib/file-collections";
import { parsePositiveQueryInt } from "../../../../lib/query-params";
import { getClientFromSession } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

export const handleFileCollectionFiles = methodRouter({ GET: get });

export default withSession(handleFileCollectionFiles);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<FileMetadataData>> {
  const id = head(req.query.id);
  if (id == null)
    return { message: "File Collection ID required.", status: 400 };

  const pageSize = head(req.query.pageSize);
  const cursor = head(req.query.cursor);
  const c = getFileCollectionsApi(await getClientFromSession(req.session));
  const { cursors, page } = await getPage(() =>
    c.listFileCollectionFiles({
      id,
      pageCursor: cursor,
      pageSize: parsePositiveQueryInt(pageSize, 10),
    })
  );

  return { cursors, data: page.data, status: 200 };
}
