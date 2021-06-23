import {
  FileMetadataData,
  FileMetadataDataAttributes,
} from "@vertexvis/api-client-node";

import { GetFilesRes } from "../pages/api/files";

export type File = Pick<FileMetadataData, "id"> & FileMetadataDataAttributes;

export interface Paged<T> {
  cursor: string | null; // Must use null for proper NextJS serialization
  items: T[];
}

export function toFileData(res: GetFilesRes): Paged<File> {
  return {
    cursor: res.cursor ?? null,
    items: res.data.map((i) => ({ ...i.attributes, id: i.id })),
  };
}
