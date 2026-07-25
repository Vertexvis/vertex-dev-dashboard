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

const FileCollectionSortFields = ["created", "name"] as const;
type FileCollectionSortField = (typeof FileCollectionSortFields)[number];

interface FileCollectionSort {
  readonly field: FileCollectionSortField;
  readonly order: "asc" | "desc";
}

/**
 * Temporary client-side stand-in for the File Collections API sort contract.
 *
 * The dashboard forwards the selected sort upstream, but applies supported
 * sorts here until the service honors the new query parameter.
 */
export function sortFileCollections(
  fileCollections: FileCollectionList["data"],
  sort?: string
): FileCollectionList["data"] {
  const parsedSort = parseFileCollectionSort(sort);
  if (parsedSort == null) return fileCollections;

  return [...fileCollections].sort((left, right) => {
    const comparison = (left.attributes[parsedSort.field] ?? "").localeCompare(
      right.attributes[parsedSort.field] ?? ""
    );

    return parsedSort.order === "asc" ? comparison : -comparison;
  });
}

function parseFileCollectionSort(
  sort?: string
): FileCollectionSort | undefined {
  if (sort == null) return undefined;

  const order = sort.startsWith("-") ? "desc" : "asc";
  const field = order === "desc" ? sort.slice(1) : sort;
  if (!isFileCollectionSortField(field)) return undefined;

  return { field, order };
}

function isFileCollectionSortField(
  field: string
): field is FileCollectionSortField {
  return FileCollectionSortFields.includes(field as FileCollectionSortField);
}

export interface FileCollectionFileFilters {
  readonly fileId?: string;
  readonly name?: string;
  readonly suppliedId?: string;
}

/**
 * Temporary client-side stand-in for the File Collection files filter
 * contract.
 *
 * The dashboard forwards `filter[name|fileId|suppliedId][contains]` upstream,
 * but applies the filters to the returned page here until the service is
 * confirmed to honor them on this relationship. Matching is a
 * case-insensitive contains check, mirroring the Files page filters.
 */
export function filterFileCollectionFiles(
  files: FileMetadataData[],
  { fileId, name, suppliedId }: FileCollectionFileFilters
): FileMetadataData[] {
  if (fileId == null && name == null && suppliedId == null) return files;

  return files.filter(
    (file) =>
      containsMatch(file.id, fileId) &&
      containsMatch(file.attributes.name, name) &&
      containsMatch(file.attributes.suppliedId, suppliedId)
  );
}

function containsMatch(value: string | undefined, filter?: string): boolean {
  if (filter == null || filter === "") return true;

  return (value ?? "").toLowerCase().includes(filter.toLowerCase());
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
