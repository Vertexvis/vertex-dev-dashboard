import {
  FileCollectionMetadataData,
  FileCollectionMetadataDataAttributes,
  FileCollectionsApi,
  VertexClient,
} from "@vertexvis/api-client-node";

import { GetRes } from "./api";
import { Paged, toPage } from "./paging";

export type FileCollection = Pick<FileCollectionMetadataData, "id"> &
  FileCollectionMetadataDataAttributes;

export function toFileCollection(
  data: FileCollectionMetadataData
): FileCollection {
  return { ...data.attributes, id: data.id };
}

export function toFileCollectionPage(
  res: GetRes<FileCollectionMetadataData>
): Paged<FileCollection> {
  return toPage<
    FileCollectionMetadataData,
    FileCollectionMetadataDataAttributes
  >(res);
}

export function getFileCollectionsApi(
  client: VertexClient
): FileCollectionsApi {
  return new FileCollectionsApi(client.config, undefined, client.axiosInstance);
}
