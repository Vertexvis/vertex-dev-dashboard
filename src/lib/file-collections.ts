import {
  FileCollectionList,
  FileCollectionMetadataData,
  FileCollectionsApi,
  VertexClient,
} from "@vertexvis/api-client-node";

import type { GetRes, Res } from "./api";
import { Paged, toPage } from "./paging";

export type FileCollectionResource = FileCollectionList["data"][number];
export type FileCollectionAttributes = FileCollectionResource["attributes"];
export type FileCollectionPageRes = GetRes<FileCollectionResource>;
export type FileCollectionDetailRes = Res & {
  readonly data: FileCollectionResource;
};

export type FileCollection = FileCollectionAttributes &
  Pick<FileCollectionResource, "id">;

export function toFileCollection(
  data: FileCollectionMetadataData
): FileCollection {
  return { ...data.attributes, id: data.id };
}

export function toFileCollectionPage(
  res: FileCollectionPageRes
): Paged<FileCollection> {
  return toPage<FileCollectionResource, FileCollectionAttributes>(res);
}

export function getFileCollectionsApi(
  client: VertexClient
): FileCollectionsApi {
  return new FileCollectionsApi(client.config, undefined, client.axiosInstance);
}
