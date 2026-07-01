import {
  CreateFileJobRequest,
  CreateFileJobRequestDataTypeEnum,
  FileJobArchiveOperationTypeEnum,
  FileJobsApi,
  FileMetadataData,
  QueuedJob,
  SelectFileByIdTypeEnum,
  VertexClient,
} from "@vertexvis/api-client-node";

import { Res } from "./api";

export interface FileJobRes extends Res {
  readonly archiveFileId?: string;
  readonly data: QueuedJob["data"];
  readonly links?: QueuedJob["links"];
}

const CompletedFileStatuses = new Set(["completed", "complete", "ready"]);

export function getFileJobsApi(client: VertexClient): FileJobsApi {
  return new FileJobsApi(client.config, undefined, client.axiosInstance);
}

export function buildFileArchiveJobRequest(
  files: FileMetadataData[],
  archiveFileId: string
): CreateFileJobRequest {
  const fileIds = files.map((file) => file.id);

  return {
    data: {
      type: CreateFileJobRequestDataTypeEnum.FileJob,
      attributes: {
        operation: {
          type: FileJobArchiveOperationTypeEnum.FileArchiveOperation,
          fileId: archiveFileId,
          manifest: fileIds.map((id) => ({
            selector: { type: SelectFileByIdTypeEnum.FileById, id },
          })),
        },
      },
    },
  };
}

export function findIncompleteFiles(
  files: FileMetadataData[]
): FileMetadataData[] {
  return files.filter(
    (file) => !CompletedFileStatuses.has(normalizeFileStatus(file))
  );
}

export function toFileJobRes(
  job: QueuedJob,
  status = 200,
  archiveFileId?: string
): FileJobRes {
  return {
    ...(archiveFileId == null ? {} : { archiveFileId }),
    ...(job.links == null ? {} : { links: job.links }),
    data: job.data,
    status,
  };
}

function normalizeFileStatus(file: FileMetadataData): string {
  return file.attributes.status?.trim().toLocaleLowerCase() ?? "";
}
