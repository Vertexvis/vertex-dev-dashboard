import {
  FileCollectionList,
  FileCollectionsApi,
  VertexClient,
} from "@vertexvis/api-client-node";

import { GetRes } from "./api";
import { Paged, toPage } from "./paging";

export type FileCollection = FileCollectionList["data"][number]["attributes"] &
  Pick<FileCollectionList["data"][number], "id">;

export function toFileCollection(
  data: FileCollectionMetadataData
): FileCollection {
  return { ...data.attributes, id: data.id };
}

export function toFileCollectionPage(
  res: GetRes<FileCollectionList["data"][number]>
): Paged<FileCollection> {
  return toPage<FileCollectionList["data"][number], FileCollection>(res);
}

export function getFileCollectionsApi(
  client: VertexClient
): FileCollectionsApi {
  return new FileCollectionsApi(client.config, undefined, client.axiosInstance);
}
