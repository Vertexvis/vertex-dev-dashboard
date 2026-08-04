import { FileCollectionMetadataData, getPage, head } from '@vertexvis/api-client-node';

import { ErrorRes, GetRes } from '../../../../lib/api';
import { methodRouter } from '../../../../lib/api-handler';
import { parsePositiveQueryInt } from '../../../../lib/query-params';
import { getClientFromSession } from '../../../../lib/vertex-api';
import withSession, { NextIronRequest } from '../../../../lib/with-session';

export const handleFileCollectionsByFile = methodRouter({ GET: get });

export default withSession(handleFileCollectionsByFile);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<FileCollectionMetadataData>> {
  const id = head(req.query.id);
  if (id == null) return { message: 'File ID required.', status: 400 };

  const client = await getClientFromSession(req.session);
  const pageSize = head(req.query.pageSize);
  const cursor = head(req.query.cursor);

  const { cursors, page } = await getPage(() =>
    client.files.listFileCollectionsForFile({
      id,
      pageCursor: cursor,
      pageSize: parsePositiveQueryInt(pageSize, 10),
    })
  );

  return { cursors, data: page.data, status: 200 };
}
