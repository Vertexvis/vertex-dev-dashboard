import { rest, RestHandler } from "msw";

import type { DeleteReq, ErrorRes, Res } from "../../../src/lib/api";
import type {
  FileCollectionPageRes,
  FileCollectionResource,
} from "../../../src/lib/file-collections";

interface FileCollectionsQueryMap {
  readonly byCursor?: Record<string, FileCollectionPageRes>;
  readonly bySuppliedId?: Record<string, FileCollectionPageRes>;
  readonly defaultPage: FileCollectionPageRes;
}

interface DeleteFileCollectionsOptions {
  readonly expectedIds?: readonly string[];
  readonly response?: Res & {
    readonly body: Record<string, unknown>;
  };
}

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
    data,
    status: 200,
  };
}

export function listFileCollections(
  options: FileCollectionsQueryMap
): RestHandler {
  return rest.get("*/api/file-collections", (req, res, ctx) => {
    const cursor = req.url.searchParams.get("cursor");
    const suppliedId = req.url.searchParams.get("suppliedId");

    if (cursor != null) {
      return res(
        ctx.json(
          options.byCursor?.[cursor] ??
            fileCollectionsPage({
              data: [],
              cursors: { self: cursor },
            })
        )
      );
    }

    if (suppliedId != null) {
      return res(
        ctx.json(
          options.bySuppliedId?.[suppliedId] ??
            fileCollectionsPage({
              data: [],
              cursors: { self: "filtered-page" },
            })
        )
      );
    }

    return res(ctx.json(options.defaultPage));
  });
}

export function deleteFileCollections(
  options: DeleteFileCollectionsOptions = {}
): RestHandler {
  const successResponse = options.response ?? {
    body: { status: 200 },
    status: 200,
  };

  return rest.delete("*/api/file-collections", async (req, res, ctx) => {
    const body = (await req.json()) as Partial<DeleteReq>;
    const ids = body.ids ?? [];

    if (
      options.expectedIds != null &&
      JSON.stringify(ids) !== JSON.stringify(options.expectedIds)
    ) {
      return res(
        ctx.status(400),
        ctx.json<ErrorRes>({
          message: "Unexpected file collection delete payload.",
          status: 400,
        })
      );
    }

    return res(
      ctx.status(successResponse.status),
      ctx.json(successResponse.body)
    );
  });
}
