import {
  CreateFileRequestDataAttributes,
  FileMetadataData,
  getPage,
  head,
  logError,
} from "@vertexvis/api-client-node";
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

export default withSession(async function handle(
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
});

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<FileMetadataData>> {
  try {
    const c = await getClientFromSession(req.session);
    const ps = head(req.query.pageSize);
    const pc = head(req.query.cursor);
    const sId = head(req.query.suppliedId);

    const r = await getPage(() =>
      c.files.getFiles({
        pageCursor: pc,
        pageSize: ps ? parseInt(ps, 10) : 10,
        filterSuppliedId: sId,
      })
    );
    return { cursors: r.cursors, data: r.page.data, status: 200 };
  } catch (error) {
    logError(error);
    return error.vertexError?.res
      ? toErrorRes(error.vertexError?.res)
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
