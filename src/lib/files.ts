import { FileList, FileMetadata } from "@vertexvis/api-client-node";

import { GetRes, Res } from "./api";
import { Paged, toPage } from "./paging";

type FileData = FileList["data"][number] | FileMetadata["data"];

export type File = FileData["attributes"] & Pick<FileData, "id">;

export function toFile(data: FileData): File {
  return { ...data.attributes, id: data.id };
}

export interface FileDownloadUrlRes extends Res {
  readonly url: string;
}

export const FileStatusComplete = "complete";

export function normalizeFileStatus(status?: string): string | undefined {
  return status?.trim().toLowerCase();
}

export function isCompleteFileStatus(status?: string): boolean {
  return normalizeFileStatus(status) === FileStatusComplete;
}

export function toFilePage(res: GetRes<FileList["data"][number]>): Paged<File> {
  return toPage<
    FileList["data"][number],
    FileList["data"][number]["attributes"]
  >(res);
}
