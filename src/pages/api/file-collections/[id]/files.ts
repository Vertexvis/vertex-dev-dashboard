import {
  FileIdList,
  FileMetadataData,
  getPage,
  head,
} from "@vertexvis/api-client-node";

import {
  BodyRequired,
  ErrorRes,
  GetRes,
  InvalidBody,
  isErrorFailure,
  Res,
  toErrorRes,
} from "../../../../lib/api";
import { methodRouter } from "../../../../lib/api-handler";
import { getFileCollectionsApi } from "../../../../lib/file-collections";
import { parsePositiveQueryInt } from "../../../../lib/query-params";
import { getClientFromSession, makeCall } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

export const handleFileCollectionFiles = methodRouter({
  GET: get,
  POST: add,
  DELETE: remove,
});

export default withSession(handleFileCollectionFiles);

interface FileMembershipReq {
  readonly fileIds: readonly string[];
}

async function add(req: NextIronRequest): Promise<ErrorRes | Res> {
  const id = getFileCollectionId(req);
  if (id == null)
    return { message: "File Collection ID required.", status: 400 };

  const body = parseFileMembershipReq(req.body);
  if (body == null) return req.body == null ? BodyRequired : InvalidBody;

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
}

async function remove(req: NextIronRequest): Promise<ErrorRes | Res> {
  const id = getFileCollectionId(req);
  if (id == null)
    return { message: "File Collection ID required.", status: 400 };

  const body = parseFileMembershipReq(req.body);
  if (body == null) return req.body == null ? BodyRequired : InvalidBody;

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
}

async function get(
  req: NextIronRequest
): Promise<ErrorRes | GetRes<FileMetadataData>> {
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
