import { FileList } from "@vertexvis/api-client-node";

import { GetRes, Res } from "./api";
import { Paged, toPage } from "./paging";

export type File = FileList["data"][number]["attributes"] &
  Pick<FileList["data"][number], "id">;

export interface FileDownloadUrlRes extends Res {
  readonly url: string;
}

export const FileStatusComplete = "complete";

export function toFile(data: FileList["data"][number]): File {
  return { ...data.attributes, id: data.id };
}

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
