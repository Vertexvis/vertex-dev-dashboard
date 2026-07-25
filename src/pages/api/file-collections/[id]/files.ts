import {
  FileIdList,
  FileList,
  FileMetadataData,
  getPage,
  logError,
  VertexError,
} from "@vertexvis/api-client-node";
import type { AxiosResponse } from "axios";
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
import {
  type ListQuerySpec,
  parseListQuery,
  toVertexListParams,
} from "../../../../lib/api/query";
import {
  filterFileCollectionFiles,
  getFileCollectionsApi,
} from "../../../../lib/file-collections";
import { getClientFromSession, makeCall } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

const collectionFilesListQuery: ListQuerySpec = {
  defaultPageSize: 10,
  filters: [
    { operation: "contains", requestName: "name", vertexField: "name" },
    { operation: "contains", requestName: "fileId", vertexField: "fileId" },
    {
      operation: "contains",
      requestName: "suppliedId",
      vertexField: "suppliedId",
    },
  ],
};

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

    const query = parseListQuery(req, collectionFilesListQuery);
    if ("message" in query) return query;

    // The generated SDK request type does not accept filters on this
    // relationship yet, so mirror the raw Files list call and forward the
    // filter parameters upstream.
    const client = await getClientFromSession(req.session);
    const params = toVertexListParams(query, collectionFilesListQuery);
    const { cursors, page } = await getPage(
      () =>
        client.axiosInstance.get(
          `${client.config.basePath}/file-collections/${encodeURIComponent(
            id
          )}/files?${params.toString()}`,
          {
            headers: {
              Accept: "application/vnd.api+json",
              Authorization: `Bearer ${client.token.access_token}`,
            },
          }
        ) as Promise<AxiosResponse<FileList>>
    );

    // Temporary stand-in: also filter the returned page locally until the
    // service is confirmed to honor filter parameters on this relationship.
    const data = filterFileCollectionFiles(page.data, {
      fileId: query.filters.fileId?.contains,
      name: query.filters.name?.contains,
      suppliedId: query.filters.suppliedId?.contains,
    });

    return { cursors, data, status: 200 };
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
