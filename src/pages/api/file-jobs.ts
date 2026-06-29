import { logError, VertexError } from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  BodyRequired,
  ErrorRes,
  InvalidBody,
  isErrorFailure,
  MethodNotAllowed,
  ServerError,
  toErrorRes,
} from "../../lib/api";
import {
  fetchAllFileCollectionFiles,
  getFileCollectionsApi,
} from "../../lib/file-collections";
import {
  buildFileArchiveJobRequest,
  FileJobRes,
  findIncompleteFiles,
  getFileJobsApi,
  toFileJobRes,
} from "../../lib/file-jobs";
import { getClientFromSession, makeCall } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

interface CreateFileJobReq {
  readonly archiveName?: string;
  readonly fileCollectionId: string;
}

interface RawCreateFileJobReq {
  readonly archiveName?: string;
  readonly fileCollectionId?: string;
}

export async function handleFileJobs(
  req: NextIronRequest,
  res: NextApiResponse<FileJobRes | ErrorRes>
): Promise<void> {
  if (req.method === "POST") {
    const r = await create(req);
    return res.status(r.status).json(r);
  }

  return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
}

export default withSession(handleFileJobs);

async function create(req: NextIronRequest): Promise<ErrorRes | FileJobRes> {
  try {
    if (!req.body) return BodyRequired;

    const body = parseCreateFileJobReq(req.body);
    if (body == null) return InvalidBody;

    const client = await getClientFromSession(req.session);
    const { fileCollectionId } = body;
    const files = await fetchAllFileCollectionFiles(
      getFileCollectionsApi(client),
      fileCollectionId
    );

    if (files.length === 0) {
      return {
        message: "File collection has no files to export.",
        status: 400,
      };
    }

    const incompleteFiles = findIncompleteFiles(files);
    if (incompleteFiles.length > 0) {
      return {
        message: "File collection contains files that are not ready to export.",
        status: 400,
      };
    }

    const archiveFile = await makeCall(() =>
      client.files.createFile({
        createFileRequest: {
          data: {
            type: "file",
            attributes: {
              metadata: { fileCollectionId },
              name:
                body.archiveName ?? buildDefaultArchiveName(fileCollectionId),
            },
          },
        },
      })
    );
    if (isErrorFailure(archiveFile))
      return toErrorRes({ failure: archiveFile });

    const job = await makeCall(() =>
      getFileJobsApi(client).createFileJob({
        createFileJobRequest: buildFileArchiveJobRequest(
          files,
          archiveFile.data.id
        ),
      })
    );
    if (isErrorFailure(job)) return toErrorRes({ failure: job });

    return toFileJobRes(job, 201, archiveFile.data.id);
  } catch (error) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError?.res })
      : ServerError;
  }
}

function parseCreateFileJobReq(body: unknown): CreateFileJobReq | undefined {
  try {
    const parsed =
      typeof body === "string"
        ? (JSON.parse(body) as RawCreateFileJobReq)
        : (body as RawCreateFileJobReq);
    if (typeof parsed.fileCollectionId !== "string") return undefined;

    const fileCollectionId = parsed.fileCollectionId.trim();
    if (fileCollectionId === "") return undefined;

    if (parsed.archiveName != null) {
      if (typeof parsed.archiveName !== "string") return undefined;

      const archiveName = parsed.archiveName.trim();
      if (archiveName === "") return undefined;

      return { archiveName, fileCollectionId };
    }

    return { fileCollectionId };
  } catch {
    return undefined;
  }
}

function buildDefaultArchiveName(fileCollectionId: string): string {
  return `file-collection-${fileCollectionId.replace(
    /[^a-z0-9._-]/gi,
    "-"
  )}.zip`;
}
