import { head, logError, VertexError } from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  MethodNotAllowed,
  Res,
  ServerError,
  toErrorRes,
} from "../../../../lib/api";
import {
  fetchAllFileCollectionFiles,
  getFileCollectionsApi,
} from "../../../../lib/file-collections";
import { findIncompleteFiles } from "../../../../lib/file-jobs";
import { getClientFromSession } from "../../../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../../../lib/with-session";

export interface FileCollectionExportReadinessRes extends Res {
  readonly fileCount: number;
  readonly message?: string;
  readonly ready: boolean;
}

export async function handleFileCollectionExportReadiness(
  req: NextIronRequest,
  res: NextApiResponse<FileCollectionExportReadinessRes | ErrorRes>
): Promise<void> {
  if (req.method === "GET") {
    const r = await get(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

export default withSession(handleFileCollectionExportReadiness);

async function get(
  req: NextIronRequest
): Promise<ErrorRes | FileCollectionExportReadinessRes> {
  try {
    const id = head(req.query.id);
    if (id == null)
      return { message: "File Collection ID required.", status: 400 };

    const api = getFileCollectionsApi(await getClientFromSession(req.session));
    const files = await fetchAllFileCollectionFiles(api, id);

    if (files.length === 0) {
      return {
        fileCount: 0,
        message: "File collection has no files to export.",
        ready: false,
        status: 200,
      };
    }

    if (findIncompleteFiles(files).length > 0) {
      return {
        fileCount: files.length,
        message: "File collection contains files that are not ready to export.",
        ready: false,
        status: 200,
      };
    }

    return { fileCount: files.length, ready: true, status: 200 };
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}
