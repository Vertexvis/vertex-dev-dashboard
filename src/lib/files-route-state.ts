import { defineRouteState, query, RouteState } from "./route-state";
import { SortState, toSortParam } from "./sorting";

export const DefaultFileSort: SortState = {
  field: "created",
  order: "desc",
};

function parseFileSort(value?: string): SortState {
  switch (value) {
    case "name":
      return { field: "name", order: "asc" };
    case "-name":
      return { field: "name", order: "desc" };
    case "created":
      return { field: "created", order: "asc" };
    case "-created":
    default:
      return DefaultFileSort;
  }
}

export const filesRouteStateDefinition = defineRouteState({
  selectedFileId: query.string("fileId"),
  table: {
    filters: {
      createdAtEnd: query.string("fileCreatedAtEnd"),
      createdAtStart: query.string("fileCreatedAtStart"),
      fileId: query.string("fileFilterId"),
      name: query.string("fileName"),
      suppliedId: query.string("fileSuppliedId"),
    },
    paging: {
      cursor: query.string("fileCursor"),
      page: query.integer("filePage", { defaultValue: 0 }),
    },
    sort: query.custom<SortState>("fileSort", {
      parse: parseFileSort,
      serialize: (value) => {
        const serialized = toSortParam(value);
        return serialized === toSortParam(DefaultFileSort)
          ? undefined
          : serialized;
      },
    }),
  },
});

export type FilesRouteState = RouteState<typeof filesRouteStateDefinition>;
export type FileTableRouteState = FilesRouteState["table"];
