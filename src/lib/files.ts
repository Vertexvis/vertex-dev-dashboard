import {
  FileMetadataData,
  FileMetadataDataAttributes,
} from "@vertexvis/api-client-node";

import { GetFilesRes } from "../pages/api/files";
import { Paged } from "./paging";

export type File = Pick<FileMetadataData, "id"> & FileMetadataDataAttributes;

export function toFileData(res: GetFilesRes): Paged<File> {
  return {
    cursor: res.cursor ?? null,
    items: res.data.map((i) => ({ ...i.attributes, id: i.id })),
  };
}
