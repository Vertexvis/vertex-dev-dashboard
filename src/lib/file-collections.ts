import {
  FileCollectionMetadataData,
  FileCollectionMetadataDataAttributes,
  FileCollectionsApi,
  FileMetadataData,
  getPage,
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

export async function fetchAllFileCollectionFiles(
  api: FileCollectionsApi,
  id: string
): Promise<FileMetadataData[]> {
  const files: FileMetadataData[] = [];
  let cursor: string | undefined;

  do {
    // eslint-disable-next-line no-await-in-loop
    const { cursors, page } = await getPage(() =>
      api.listFileCollectionFiles({
        id,
        pageCursor: cursor,
        pageSize: 200,
      })
    );

    files.push(...page.data);
    cursor = cursors.next;
  } while (cursor != null);

  return files;
}
