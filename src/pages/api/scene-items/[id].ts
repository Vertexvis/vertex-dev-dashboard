import { head, SceneItemData } from '@vertexvis/api-client-node';

import { ErrorRes, Res } from '../../../lib/api';
import { methodRouter } from '../../../lib/api-handler';
import { getClientFromSession } from '../../../lib/vertex-api';
import withSession, { NextIronRequest } from '../../../lib/with-session';

export default withSession(methodRouter({ GET: get }));

async function get(req: NextIronRequest): Promise<ErrorRes | (SceneItemData & Res)> {
  const c = await getClientFromSession(req.session);
  const id = head(req.query.id);
  if (id == null) {
    throw new Error('ID not set and is required');
  }

  const item = await c.sceneItems.getSceneItem({
    id,
    fieldsSceneItem: 'id,suppliedId,name,metadata',
  });

  return { ...item.data.data, status: 200 };
}
