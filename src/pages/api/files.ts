import {
  CreateFileRequestDataAttributes,
  FileList,
  FileMetadataData,
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
import { getClientFromSession, makeCall } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

type CreateFileReq = CreateFileRequestDataAttributes;

export type CreateFileRes = Res & Pick<FileMetadataData, "id">;

export async function handleFiles(
  req: NextIronRequest,
  res: NextApiResponse<GetRes<FileMetadataData> | Res | ErrorRes>
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
): Promise<ErrorRes | GetRes<FileMetadataData>> {
  try {
    const c = await getClientFromSession(req.session);
    const ps = head(req.query.pageSize);
    const pc = head(req.query.cursor);
    const name = head(req.query.name);
    const fileId = head(req.query.fileId);
    const sId = head(req.query.suppliedId);
    const createdAtStart = head(req.query.createdAtStart);
    const createdAtEnd = head(req.query.createdAtEnd);

    const { cursors, page } = await getPage(() =>
      c.axiosInstance.get<FileList>(`${c.config.basePath}/files`, {
        headers: {
          Accept: "application/vnd.api+json",
          Authorization: `Bearer ${c.token.access_token}`,
        },
        params: {
          "filter[name][contains]": name,
          "filter[fileId]": fileId,
          "filter[suppliedId][contains]": sId,
          "filter[createdAtStart][gte]": createdAtStart,
          "filter[createdAtEnd][lte]": createdAtEnd,
          "page[cursor]": pc,
          "page[size]": ps ? parseInt(ps, 10) : 10,
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
