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
  getFileCollectionExportAvailability,
  getFileCollectionsApi,
} from "../../lib/file-collections";
import {
  buildFileArchiveJobRequest,
  FileJobRes,
  getFileJobsApi,
  toFileJobRes,
} from "../../lib/file-jobs";
import { getClientFromSession, makeCall } from "../../lib/vertex-api";
import withSession, { NextIronRequest } from "../../lib/with-session";

const DefaultArchiveFileExpirySeconds = 24 * 60 * 60;

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

    const exportAvailability = getFileCollectionExportAvailability(files);
    if (!exportAvailability.enabled) {
      return {
        message:
          exportAvailability.disabledReason ??
          "File collection is not exportable.",
        status: 400,
      };
    }

    const archiveFile = await makeCall(() =>
      client.files.createFile({
        createFileRequest: {
          data: {
            type: "file",
            attributes: {
              expiry: DefaultArchiveFileExpirySeconds,
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

    const fileCollectionId = requireStringParam(parsed.fileCollectionId);
    const archiveName = parseOptionalStringParam(parsed.archiveName);

    return archiveName == null
      ? { fileCollectionId }
      : { archiveName, fileCollectionId };
  } catch {
    return undefined;
  }
}

function parseOptionalStringParam(value: unknown): string | undefined {
  return value == null ? undefined : requireStringParam(value);
}

function requireStringParam(value: unknown): string {
  if (typeof value !== "string") throw new Error("Expected string param.");

  const trimmed = value.trim();
  if (trimmed === "") throw new Error("Expected non-empty string param.");

  return trimmed;
}

function buildDefaultArchiveName(fileCollectionId: string): string {
  const safeFileCollectionId = fileCollectionId.replace(/[^a-z0-9._-]/gi, "-");
  return `file-collection-${safeFileCollectionId}.zip`;
}
