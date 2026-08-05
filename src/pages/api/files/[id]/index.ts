import { FileMetadata, head, logError, VertexError } from '@vertexvis/api-client-node';
import { NextApiResponse } from 'next';

import { ErrorRes, MethodNotAllowed, ServerError, toErrorRes } from '../../../../lib/api';
import { getClientFromSession } from '../../../../lib/vertex-api';
import withSession, { NextIronRequest } from '../../../../lib/with-session';

type FileData = FileMetadata['data'];

export async function handleFileById(
  req: NextIronRequest,
  res: NextApiResponse<FileData | ErrorRes>
): Promise<void> {
  if (req.method === 'GET') {
    const r = await get(req);
    return res.status('status' in r ? r.status : 200).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

export default withSession(handleFileById);

async function get(req: NextIronRequest): Promise<ErrorRes | FileData> {
  try {
    const client = await getClientFromSession(req.session);
    const id = head(req.query.id);
    if (id == null) return { message: 'File ID required.', status: 400 };

    const item = await client.files.getFile({ id });
    return item.data.data;
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res ? toErrorRes({ failure: e.vertexError?.res }) : ServerError;
  }
}
