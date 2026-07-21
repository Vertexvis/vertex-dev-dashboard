// developer-owned: typed lifecycle hooks for the Preview Documents API.
import { DocumentData, getPage, isFailure } from "@vertexvis/api-client-node";

import { toErrorRes } from "../../api";
import { ErrorRes, GetRes, Res } from "../../api/contracts";
import { requiredPathParam, type VertexRouteSpec } from "../../api/route";
import { isCompleteFileStatus } from "../../files";
import { NextIronRequest } from "../../with-session";

interface DocumentsQuery {
  readonly cursor?: string;
  readonly pageSize: number;
  readonly suppliedId?: string;
}

interface CreateDocumentInput {
  readonly fileId: string;
  readonly suppliedId?: string;
}

interface DetailInput {
  readonly id: string;
}

type DocumentRes = DocumentData & Res;
type DocumentsResult = GetRes<DocumentData> | DocumentRes | ErrorRes;

function parseScalar(
  value: string | string[] | undefined,
  label: string
): string | undefined | ErrorRes {
  if (Array.isArray(value))
    return { message: `Invalid ${label}.`, status: 400 };
  if (value == null) return undefined;
  const normalized = value.trim();
  return normalized === ""
    ? { message: `Invalid ${label}.`, status: 400 }
    : normalized;
}

function parseQuery(req: NextIronRequest): DocumentsQuery | ErrorRes {
  const cursor = parseScalar(req.query.cursor, "cursor");
  if (typeof cursor !== "string" && cursor != null) return cursor;
  const suppliedId = parseScalar(req.query.suppliedId, "suppliedId");
  if (typeof suppliedId !== "string" && suppliedId != null) return suppliedId;
  const pageSize = req.query.pageSize;
  if (Array.isArray(pageSize))
    return { message: "Invalid pageSize.", status: 400 };
  const parsed = pageSize == null ? 25 : Number.parseInt(pageSize, 10);
  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    (pageSize != null && !/^\d+$/.test(pageSize))
  ) {
    return { message: "Invalid pageSize.", status: 400 };
  }
  return { cursor, pageSize: Math.min(parsed, 100), suppliedId };
}

function parseCreate(req: NextIronRequest): CreateDocumentInput | ErrorRes {
  let value: unknown = req.body;
  try {
    if (typeof value === "string") value = JSON.parse(value);
  } catch {
    return { message: "Invalid body.", status: 400 };
  }
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return { message: "Invalid body.", status: 400 };
  }
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).some((key) => key !== "fileId" && key !== "suppliedId")
  ) {
    return { message: "Invalid body.", status: 400 };
  }
  const fileId = typeof body.fileId === "string" ? body.fileId.trim() : "";
  const suppliedId = body.suppliedId;
  if (
    fileId === "" ||
    (suppliedId != null &&
      (typeof suppliedId !== "string" ||
        suppliedId.trim() === "" ||
        suppliedId.length > 200))
  ) {
    return { message: "Invalid body.", status: 400 };
  }
  return { fileId, suppliedId: suppliedId?.trim() };
}

function parseDetail(req: NextIronRequest): DetailInput | ErrorRes {
  const id = requiredPathParam(req, "id", "Document ID");
  return typeof id === "string" && !Array.isArray(req.query.id)
    ? { id }
    : typeof id === "string"
    ? { message: "Document ID is required.", status: 400 }
    : id;
}

export const documentsCollectionRouteSpec: VertexRouteSpec<
  CreateDocumentInput,
  DocumentsQuery,
  DocumentsResult
> = {
  hooks: {
    onError: (_ctx, error) => {
      const failure = error as {
        readonly vertexError?: { readonly res?: unknown };
      };
      const response = failure.vertexError?.res;
      return Promise.resolve(
        response != null && isFailure(response)
          ? toErrorRes({ failure: response })
          : undefined
      );
    },
  },
  operations: {
    GET: {
      execute: async ({ client, query }) => {
        const { cursors, page } = await getPage(() =>
          client.documents.getDocuments({
            filterSuppliedId: query.suppliedId,
            pageCursor: query.cursor,
            pageSize: query.pageSize,
          })
        );
        return { cursors, data: page.data, status: 200 };
      },
      query: parseQuery,
    },
    POST: {
      execute: async ({ client, input }) => {
        const file = await client.files.getFile({ id: input.fileId });
        if (!isCompleteFileStatus(file.data.data.attributes.status)) {
          return {
            message: "Only completed files can be registered as documents.",
            status: 400,
          };
        }
        const result = await client.documents.createDocument({
          createDocumentRequest: {
            data: {
              attributes: {
                fileId: input.fileId,
                suppliedId: input.suppliedId,
              },
              type: "document",
            },
          },
        });
        return { ...result.data.data, status: 201 };
      },
      parse: parseCreate,
    },
  },
};

export const documentsDetailRouteSpec: VertexRouteSpec<
  DetailInput,
  undefined,
  DocumentsResult
> = {
  operations: {
    GET: {
      execute: async ({ client, input }) => ({
        ...(await client.documents.getDocument({ id: input.id })).data.data,
        status: 200,
      }),
      parse: parseDetail,
    },
  },
};
