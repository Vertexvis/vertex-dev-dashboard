import { inferParserType, parseAsString } from "nuqs";

import { makeSortParser, parseAsPageIndex } from "./nuqs-table-state";
import { SortState } from "./sorting";

export const DefaultFileSort: SortState = {
  field: "created",
  order: "desc",
};

export const parseAsFileSort = makeSortParser({
  "-created": { field: "created", order: "desc" },
  "-name": { field: "name", order: "desc" },
  created: { field: "created", order: "asc" },
  name: { field: "name", order: "asc" },
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
