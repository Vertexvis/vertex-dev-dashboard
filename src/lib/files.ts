import { FileList } from "@vertexvis/api-client-node";

import { GetRes, Res } from "./api";
import { Paged, toPage } from "./paging";

export type File = FileList["data"][number]["attributes"] &
  Pick<FileList["data"][number], "id">;

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

/**
 * Whether a file can have a part created from it.
 *
 * For now this only gates on the file being fully uploaded/processed. An
 * extension allowlist (translatable file types) will be added here later, once
 * the supported-extension list is available — keep that a one-function change.
 */
export function isPartEligibleFile(file: File): boolean {
  return isCompleteFileStatus(file.status);
}

export function toFilePage(res: GetRes<FileList["data"][number]>): Paged<File> {
  return toPage<
    FileList["data"][number],
    FileList["data"][number]["attributes"]
  >(res);
}
