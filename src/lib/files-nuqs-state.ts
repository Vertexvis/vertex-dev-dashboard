import { createParser, inferParserType, parseAsInteger, parseAsString } from "nuqs";

import { SortState, toSortParam } from "./sorting";

export const DefaultFileSort: SortState = {
  field: "created",
  order: "desc",
};

const FileSortValues: Record<string, SortState> = {
  "-created": { field: "created", order: "desc" },
  "-name": { field: "name", order: "desc" },
  created: { field: "created", order: "asc" },
  name: { field: "name", order: "asc" },
};

/**
 * Sort is stored in the URL as the API sort parameter, e.g. `-created`.
 * Unknown values parse to `null`, which nuqs replaces with the default.
 */
export const parseAsFileSort = createParser<SortState>({
  eq: (a, b) => a.field === b.field && a.order === b.order,
  parse: (value) => FileSortValues[value] ?? null,
  serialize: toSortParam,
});

/** Page index must be a non-negative integer; anything else falls back. */
export const parseAsPageIndex = createParser<number>({
  parse: (value) => {
    const parsed = parseAsInteger.parse(value);
    return parsed == null || parsed < 0 ? null : parsed;
  },
  serialize: (value) => parseAsInteger.serialize(value),
});

export const fileTableParsers = {
  createdAtEnd: parseAsString,
  createdAtStart: parseAsString,
  cursor: parseAsString,
  filterId: parseAsString,
  name: parseAsString,
  page: parseAsPageIndex.withDefault(0),
  sort: parseAsFileSort.withDefault(DefaultFileSort),
  suppliedId: parseAsString,
};

export const fileTableUrlKeys = {
  createdAtEnd: "fileCreatedAtEnd",
  createdAtStart: "fileCreatedAtStart",
  cursor: "fileCursor",
  filterId: "fileFilterId",
  name: "fileName",
  page: "filePage",
  sort: "fileSort",
  suppliedId: "fileSuppliedId",
};

export type FileTableState = inferParserType<typeof fileTableParsers>;
