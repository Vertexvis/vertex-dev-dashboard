import {
  FileCollectionList,
  FileCollectionMetadataData,
  FileCollectionsApi,
  FileMetadataData,
  getPage,
  VertexClient,
} from "@vertexvis/api-client-node";

import { GetRes, Res } from "./api";
import { isCompleteFileStatus } from "./files";
import { Paged, toPage } from "./paging";

export type FileCollection = FileCollectionList["data"][number]["attributes"] &
  Pick<FileCollectionList["data"][number], "id">;

export interface FileCollectionExportAvailability {
  readonly disabledReason?: string;
  readonly enabled: boolean;
  readonly fileCount: number;
}

export type GetFileCollectionRes = Res & {
  readonly data: FileCollectionMetadataData;
  readonly export?: FileCollectionExportAvailability;
};

export function toFileCollection(
  data: FileCollectionMetadataData
): FileCollection {
  return { ...data.attributes, id: data.id };
}

export function toFileCollectionPage(
  res: GetRes<FileCollectionList["data"][number]>
): Paged<FileCollection> {
  return toPage<
    FileCollectionList["data"][number],
    FileCollectionList["data"][number]["attributes"]
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
  let hasNextPage = true;

  while (hasNextPage) {
    // Each request depends on the cursor returned by the previous page.
    // eslint-disable-next-line no-await-in-loop
    const { cursors, page } = await getPage(() =>
      api.listFileCollectionFiles({
        id,
        pageCursor: cursor,
        pageSize: 200,
      })
    );

    files.push(...page.data);
    hasNextPage = cursors.next != null;
    cursor = cursors.next;
  }

  return files;
}

export function getFileCollectionExportAvailability(
  files: FileMetadataData[]
): FileCollectionExportAvailability {
  if (files.length === 0) {
    return {
      disabledReason: "File collection has no files to export.",
      enabled: false,
      fileCount: 0,
    };
  }

  const hasIncompleteFiles = files.some(
    (file) => !isCompleteFileStatus(file.attributes.status)
  );

  if (hasIncompleteFiles) {
    return {
      disabledReason:
        "File collection contains files that are not ready to export.",
      enabled: false,
      fileCount: files.length,
    };
  }

  return { enabled: true, fileCount: files.length };
}
