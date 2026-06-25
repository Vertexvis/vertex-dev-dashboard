import {
  FileMetadataData,
  FileMetadataDataAttributes,
} from "@vertexvis/api-client-node";

import { GetRes } from "./api";
import { Paged, toPage } from "./paging";

export type File = Pick<FileMetadataData, "id"> & FileMetadataDataAttributes;

const FileStatusLabels: Record<string, string> = {
  complete: "File Ready",
  error: "Error",
  pending: "Pending",
};

export function toFilePage(res: GetRes<FileMetadataData>): Paged<File> {
  return toPage<FileMetadataData, FileMetadataDataAttributes>(res);
}

export function toFileStatusDisplay(status?: string): string | undefined {
  return status == null ? undefined : FileStatusLabels[status] ?? status;
}
