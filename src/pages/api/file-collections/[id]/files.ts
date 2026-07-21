import {
  FileIdList,
  FileMetadataData,
  getPage,
  head,
  logError,
  VertexError,
} from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  BodyRequired,
  ErrorRes,
  GetRes,
  InvalidBody,
  isErrorFailure,
  MethodNotAllowed,
  Res,
  ServerError,
  toErrorRes,
} from "../../../../lib/api";
import { getFileCollectionsApi } from "../../../../lib/file-collections";
import { parsePositiveQueryInt } from "../../../../lib/query-params";
import { getClientFromSession, makeCall } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

export async function handleFileCollectionFiles(
  req: NextIronRequest,
  res: NextApiResponse<GetRes<FileMetadataData> | Res | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "POST") {
    const r = await add(req);
    return res.status(r.status).json(r);
  }

  if (req.method === "DELETE") {
    const r = await remove(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

interface FileMembershipReq {
  readonly fileIds: readonly string[];
}

async function add(req: NextIronRequest): Promise<ErrorRes | Res> {
  const id = getFileCollectionId(req);
  if (id == null)
    return { message: "File Collection ID required.", status: 400 };

  const body = parseFileMembershipReq(req.body);
  if (body == null) return req.body == null ? BodyRequired : InvalidBody;

  try {
    const c = getFileCollectionsApi(await getClientFromSession(req.session));
    const result = await makeCall(() =>
      c.addFileCollectionFiles({
        fileIdList: { data: [...body.fileIds] } satisfies FileIdList,
        id,
      })
    );
    return isErrorFailure(result)
      ? toErrorRes({ failure: result })
      : { status: 200 };
  } catch (error) {
    return toRouteError(error);
  }
}

async function remove(req: NextIronRequest): Promise<ErrorRes | Res> {
  const id = getFileCollectionId(req);
  if (id == null)
    return { message: "File Collection ID required.", status: 400 };

  const body = parseFileMembershipReq(req.body);
  if (body == null) return req.body == null ? BodyRequired : InvalidBody;

  try {
    const c = getFileCollectionsApi(await getClientFromSession(req.session));
    const result = await makeCall(() =>
      c.removeFileCollectionFiles({
        filterFileId: body.fileIds.join(","),
        id,
      })
    );
    return isErrorFailure(result)
      ? toErrorRes({ failure: result })
      : { status: 200 };
  } catch (error) {
    return toRouteError(error);
  }
}

export default withSession(handleFileCollectionFiles);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<FileMetadataData>> {
  try {
    const id = getFileCollectionId(req);
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
  } catch (error) {
    return toRouteError(error);
  }
}

function getFileCollectionId(req: NextIronRequest): string | undefined {
  const id = req.query.id;
  if (typeof id !== "string") return undefined;

  const normalized = id.trim();
  return normalized === "" ? undefined : normalized;
}

function parseFileMembershipReq(body: unknown): FileMembershipReq | undefined {
  if (body == null) return undefined;

  try {
    const parsed =
      typeof body === "string" ? (JSON.parse(body) as unknown) : body;
    if (typeof parsed !== "object" || parsed == null || Array.isArray(parsed))
      return undefined;

    const fileIds = (parsed as { fileIds?: unknown }).fileIds;
    if (
      !Array.isArray(fileIds) ||
      fileIds.length === 0 ||
      fileIds.some(
        (fileId) => typeof fileId !== "string" || fileId.trim() === ""
      )
    )
      return undefined;

    return { fileIds: [...new Set(fileIds.map((fileId) => fileId.trim()))] };
  } catch {
    return undefined;
  }
}

function toRouteError(error: unknown): ErrorRes {
  const e = error as VertexError;
  logError(e);
  return e.vertexError?.res
    ? toErrorRes({ failure: e.vertexError?.res })
    : ServerError;
}
