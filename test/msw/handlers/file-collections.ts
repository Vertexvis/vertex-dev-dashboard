import type {
  FileCollectionPageRes,
  FileCollectionResource,
} from "../../../src/lib/file-collections";

export function fileCollection(overrides: {
  readonly created?: string;
  readonly id: string;
  readonly name: string;
  readonly suppliedId?: string;
}): FileCollectionResource {
  return {
    attributes: {
      created: overrides.created ?? "2026-06-10T15:30:00Z",
      name: overrides.name,
      suppliedId: overrides.suppliedId,
    },
    id: overrides.id,
    type: "file-collection",
  };
}

export function fileCollectionsPage({
  cursors = { self: "page-1" },
  data,
}: {
  readonly cursors?: {
    readonly next?: string;
    readonly self?: string;
  };
  readonly data: readonly FileCollectionResource[];
}): FileCollectionPageRes {
  return {
    cursors,
    data: [...data],
    status: 200,
  };
}
