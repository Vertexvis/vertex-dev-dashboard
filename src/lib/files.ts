import {
  FileMetadataData,
  FileMetadataDataAttributes,
} from "@vertexvis/api-client-node";

import { GetRes } from "./api";
import { Paged, toPage } from "./paging";

export type File = Pick<FileMetadataData, "id"> & FileMetadataDataAttributes;

export function toFilePage(res: GetRes<FileMetadataData>): Paged<File> {
  return toPage<FileMetadataData, FileMetadataDataAttributes>(res);
}
