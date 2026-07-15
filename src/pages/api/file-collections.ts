import {
  FileCollectionList,
  FileCollectionMetadataData,
  FilterExpression,
  getPage,
  head,
  logError,
  VertexError,
} from "@vertexvis/api-client-node";
import { AxiosResponse } from "axios";
import { NextApiResponse } from "next";

import {
  BodyRequired,
  DeleteReq,
  ErrorRes,
  GetRes,
  InvalidBody,
  isErrorFailure,
  MethodNotAllowed,
  Res,
  ServerError,
  toErrorRes,
} from "../../lib/api";
import { getFileCollectionsApi } from "../../lib/file-collections";
import { setFilterExpression } from "../../lib/query-filters";
import { parsePositiveQueryInt } from "../../lib/query-params";
import { getClientFromSession, makeCall } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

export async function handleFileCollections(
  req: NextIronRequest,
  res: NextApiResponse<GetRes<FileCollectionMetadataData> | Res | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "DELETE") {
    const r = await del(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

export default withSession(handleFileCollections);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<FileCollectionMetadataData>> {
  try {
    const client = await getClientFromSession(req.session);
    const ps = head(req.query.pageSize);
    const pc = head(req.query.cursor);
    const name = head(req.query.name);
    const suppliedId = head(req.query.suppliedId);

    const query = new URLSearchParams();
    if (pc != null) query.set("page[cursor]", pc);
    query.set("page[size]", parsePositiveQueryInt(ps, 10).toString());
    setFilterExpression(
      query,
      "name",
      name != null ? ({ contains: name } satisfies FilterExpression) : undefined
    );
    setFilterExpression(
      query,
      "suppliedId",
      suppliedId != null
        ? ({ contains: suppliedId } satisfies FilterExpression)
        : undefined
    );

    const { cursors, page } = await getPage(
      (): Promise<AxiosResponse<FileCollectionList>> =>
        client.axiosInstance.get<FileCollectionList>(
          `${client.config.basePath}/file-collections?${query.toString()}`,
          {
            headers: {
              Accept: "application/vnd.api+json",
              Authorization: `Bearer ${client.token.access_token}`,
            },
          }
        )
    );
    return {
      cursors,
      data: page.data,
      status: 200,
    };
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}

async function del(req: NextIronRequest): Promise<ErrorRes | Res> {
  if (!req.body) return BodyRequired;

  const b: DeleteReq = JSON.parse(req.body);
  if (!b.ids) return InvalidBody;

  try {
    const c = getFileCollectionsApi(await getClientFromSession(req.session));
    const results = await Promise.all(
      b.ids.map((id) => makeCall(() => c.deleteFileCollection({ id })))
    );
    const failure = results.find(isErrorFailure);
    if (failure != null) return toErrorRes({ failure });

    return { status: 200 };
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}
