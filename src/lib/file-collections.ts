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

export type FileCollectionResource = FileCollectionList["data"][number];
export type FileCollectionAttributes = FileCollectionResource["attributes"];
export type FileCollectionPageRes = GetRes<FileCollectionResource>;
export type FileCollectionDetailRes = Res & {
  readonly data: FileCollectionResource;
};

export type FileCollection = FileCollectionAttributes &
  Pick<FileCollectionResource, "id">;

export interface FileCollectionExportAvailability {
  readonly disabledReason?: string;
  readonly enabled: boolean;
  readonly fileCount: number;
}

export type GetFileCollectionRes = Res & {
  readonly data: FileCollectionMetadataData;
  readonly export?: FileCollectionExportAvailability;
};

export interface FileCollectionFilters {
  readonly createdAtEnd?: string;
  readonly createdAtStart?: string;
}

/**
 * Temporary client-side stand-in for the File Collections API filter contract.
 *
 * The dashboard also sends these filters upstream, but the API has not
 * published the contract yet. Applying them here preserves the expected
 * behavior when the upstream service ignores those parameters.
 */
export function filterFileCollections(
  fileCollections: FileCollectionList["data"],
  filters: FileCollectionFilters
): FileCollectionList["data"] {
  return fileCollections.filter(({ attributes }) => {
    const createdAt =
      attributes.created == null ? undefined : new Date(attributes.created);
    const createdAtStart =
      filters.createdAtStart == null
        ? undefined
        : new Date(filters.createdAtStart);
    const createdAtEnd =
      filters.createdAtEnd == null ? undefined : new Date(filters.createdAtEnd);

    return (
      (createdAtStart == null ||
        (createdAt != null && createdAt >= createdAtStart)) &&
      (createdAtEnd == null || (createdAt != null && createdAt <= createdAtEnd))
    );
  });
}

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
