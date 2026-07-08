import {
  CreateFileRequestDataAttributes,
  FileList,
  FileMetadata,
  FilesApiGetFilesRequest,
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
  MethodNotAllowed,
  Res,
  ServerError,
  toErrorRes,
} from "../../lib/api";
import { setFilterExpression } from "../../lib/query-filters";
import { getClientFromSession, makeCall } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

type CreateFileReq = CreateFileRequestDataAttributes;
type FileData = FileMetadata["data"];

export type CreateFileRes = Res & Pick<FileData, "id">;

export async function handleFiles(
  req: NextIronRequest,
  res: NextApiResponse<GetRes<FileData> | Res | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "DELETE") {
    const r = await del(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "POST") {
    const r = await create(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

export default withSession(handleFiles);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<FileData>> {
  try {
    const c = await getClientFromSession(req.session);
    const ps = head(req.query.pageSize);
    const pc = head(req.query.cursor);
    const name = head(req.query.name);
    const fileId = head(req.query.fileId);
    const sId = head(req.query.suppliedId);
    const createdAtStart = head(req.query.createdAtStart);
    const createdAtEnd = head(req.query.createdAtEnd);
    const sort = head(req.query.sort);

    const params: FilesApiGetFilesRequest = {
      filterCreatedAt:
        createdAtStart != null || createdAtEnd != null
          ? ({
              ...(createdAtStart != null ? { gte: createdAtStart } : {}),
              ...(createdAtEnd != null ? { lte: createdAtEnd } : {}),
            } satisfies FilterExpression)
          : undefined,
      filterFileId:
        fileId != null
          ? ({ contains: fileId } satisfies FilterExpression)
          : undefined,
      filterName:
        name != null ? ({ contains: name } satisfies FilterExpression) : undefined,
      filterSuppliedId:
        sId != null ? ({ contains: sId } satisfies FilterExpression) : undefined,
      pageCursor: pc,
      pageSize: ps ? parseInt(ps, 10) : 10,
      sort,
    };

    const query = new URLSearchParams();
    if (params.pageCursor != null) query.set("page[cursor]", params.pageCursor);
    if (params.pageSize != null) query.set("page[size]", params.pageSize.toString());
    if (params.sort != null) query.set("sort", params.sort);
    setFilterExpression(query, "name", params.filterName);
    setFilterExpression(query, "fileId", params.filterFileId);
    if (typeof params.filterSuppliedId === "string") {
      query.set("filter[suppliedId]", params.filterSuppliedId);
    } else {
      setFilterExpression(query, "suppliedId", params.filterSuppliedId);
    }
    setFilterExpression(query, "createdAt", params.filterCreatedAt);

    const { cursors, page } = await getPage(() =>
      c.axiosInstance.get(`${c.config.basePath}/files?${query.toString()}`, {
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${c.token.access_token}`,
        },
      }) as Promise<AxiosResponse<FileList>>
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

async function del(req: NextIronRequest): Promise<ErrorRes | Res> {
  if (!req.body) return BodyRequired;

  const b: DeleteReq = JSON.parse(req.body);
  if (!b.ids) return InvalidBody;

  const c = await getClientFromSession(req.session);
  await Promise.all(
    b.ids.map((id) => makeCall(() => c.files.deleteFile({ id })))
  );
  return { status: 200 };
}

async function create(req: NextIronRequest): Promise<ErrorRes | CreateFileRes> {
  if (!req.body) return BodyRequired;

  const b: CreateFileReq = JSON.parse(req.body);
  const c = await getClientFromSession(req.session);
  const res = await c.files.createFile({
    createFileRequest: { data: { type: "file", attributes: b } },
  });

  return { status: 200, id: res.data.data.id };
}
