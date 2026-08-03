import {
  FileCollectionList,
  FileCollectionMetadataData,
  FilterExpression,
  getPage,
  head,
} from '@vertexvis/api-client-node';
import { AxiosResponse } from 'axios';

import {
  BodyRequired,
  DeleteReq,
  ErrorRes,
  GetRes,
  InvalidBody,
  isErrorFailure,
  Res,
  toErrorRes,
} from '../../lib/api';
import { methodRouter } from '../../lib/api-handler';
import { getFileCollectionsApi, sortFileCollections } from '../../lib/file-collections';
import { setFilterExpression } from '../../lib/query-filters';
import { parsePositiveQueryInt } from '../../lib/query-params';
import { getClientFromSession, makeCall } from '../../lib/vertex-api';
import withSession, { NextIronRequest } from '../../lib/with-session';

export const handleFileCollections = methodRouter({ GET: get, DELETE: del });

export default withSession(handleFileCollections);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<FileCollectionMetadataData>> {
  const client = await getClientFromSession(req.session);
  const ps = head(req.query.pageSize);
  const pc = head(req.query.cursor);
  const name = head(req.query.name);
  const suppliedId = head(req.query.suppliedId);
  const createdAtStart = head(req.query.createdAtStart);
  const createdAtEnd = head(req.query.createdAtEnd);
  const sort = head(req.query.sort);

  const query = new URLSearchParams();
  if (pc != null) query.set('page[cursor]', pc);
  query.set('page[size]', parsePositiveQueryInt(ps, 10).toString());
  setFilterExpression(
    query,
    'name',
    name != null ? ({ contains: name } satisfies FilterExpression) : undefined
  );
  setFilterExpression(
    query,
    'suppliedId',
    suppliedId != null ? ({ contains: suppliedId } satisfies FilterExpression) : undefined
  );
  if (sort != null) query.set('sort', sort);
  setFilterExpression(
    query,
    'createdAt',
    createdAtStart != null || createdAtEnd != null
      ? ({
          ...(createdAtStart != null ? { gte: createdAtStart } : {}),
          ...(createdAtEnd != null ? { lte: createdAtEnd } : {}),
        } satisfies FilterExpression)
      : undefined
  );

  // TODO: Use FileCollectionsApi.listFileCollections once the SDK supports
  // createdAt filter expressions.
  const { cursors, page } = await getPage(
    (): Promise<AxiosResponse<FileCollectionList>> =>
      client.axiosInstance.get<FileCollectionList>(
        `${client.config.basePath}/file-collections?${query.toString()}`,
        {
          headers: {
            Accept: 'application/vnd.api+json',
            Authorization: `Bearer ${client.token.access_token}`,
          },
        }
      )
  );
  return {
    cursors,
    data: sortFileCollections(page.data, sort),
    status: 200,
  };
}

async function del(req: NextIronRequest): Promise<ErrorRes | Res> {
  if (!req.body) return BodyRequired;

  const b: DeleteReq = JSON.parse(req.body);
  if (!b.ids) return InvalidBody;

  const c = getFileCollectionsApi(await getClientFromSession(req.session));
  const results = await Promise.all(
    b.ids.map((id) => makeCall(() => c.deleteFileCollection({ id })))
  );
  const failure = results.find(isErrorFailure);
  if (failure != null) return toErrorRes({ failure });

  return { status: 200 };
}
