// developer-owned: specialized Files API behavior belongs here.
import { FileList, getPage } from "@vertexvis/api-client-node";
import type { AxiosResponse } from "axios";

import { DeleteReq, ErrorRes, GetRes, Res } from "../../api/contracts";
import {
  type ListQuery,
  type ListQuerySpec,
  parseListQuery,
  toVertexListParams,
} from "../../api/query";
import {
  createVertexRoute,
  isBodyParseError,
  parseJsonBody,
  type VertexRouteSpec,
} from "../../api/route";
import { CreateFileReq, CreateFileRes, FileData } from "./files.contracts";

type FilesResult = GetRes<FileData> | CreateFileRes | ErrorRes | Res;

const filesListQuery: ListQuerySpec = {
  defaultPageSize: 10,
  filters: [
    { operation: "contains", requestName: "name", vertexField: "name" },
    { operation: "contains", requestName: "fileId", vertexField: "fileId" },
    {
      operation: "contains",
      requestName: "suppliedId",
      vertexField: "suppliedId",
    },
    {
      operation: "gte",
      requestName: "createdAtStart",
      vertexField: "createdAt",
    },
    {
      operation: "lte",
      requestName: "createdAtEnd",
      vertexField: "createdAt",
    },
  ],
  maxPageSize: 100,
  sortable: ["created", "name", "fileId", "suppliedId", "status", "uploaded"],
};

function validDeleteRequest(value: unknown): value is DeleteReq {
  return (
    isPlainObject(value) &&
    Object.keys(value).length === 1 &&
    "ids" in value &&
    Array.isArray(value.ids) &&
    value.ids.length > 0 &&
    value.ids.every((id) => typeof id === "string" && id.trim() !== "")
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validCreateFileRequest(value: unknown): value is CreateFileReq {
  if (!isPlainObject(value)) return false;
  const allowed = new Set([
    "name",
    "suppliedId",
    "rootFileName",
    "expiry",
    "metadata",
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  if (typeof value.name !== "string" || value.name.trim() === "") return false;
  if (value.suppliedId != null && typeof value.suppliedId !== "string")
    return false;
  if (value.rootFileName != null && typeof value.rootFileName !== "string")
    return false;
  if (
    value.expiry != null &&
    (typeof value.expiry !== "number" ||
      !Number.isFinite(value.expiry) ||
      value.expiry < 0)
  ) {
    return false;
  }
  return (
    value.metadata == null ||
    (isPlainObject(value.metadata) &&
      Object.values(value.metadata).every(
        (metadataValue) => typeof metadataValue === "string"
      ))
  );
}

export const filesCollectionRouteSpec: VertexRouteSpec<
  CreateFileReq | DeleteReq | undefined,
  ListQuery | undefined,
  FilesResult
> = {
  operations: {
    DELETE: {
      execute: async ({ client, input }) => {
        const request = input as DeleteReq;
        await Promise.all(
          request.ids.map((id) => client.files.deleteFile({ id }))
        );
        return { status: 200 };
      },
      parse: (req) => {
        const parsed = parseJsonBody<unknown>(req.body);
        if (isBodyParseError(parsed)) return parsed;
        return validDeleteRequest(parsed)
          ? parsed
          : { message: "Invalid body.", status: 400 };
      },
    },
    GET: {
      execute: async ({ client, query, req }) => {
        const params = toVertexListParams(
          query as ListQuery,
          filesListQuery,
          req
        );
        const { cursors, page } = await getPage(
          () =>
            client.axiosInstance.get(
              `${client.config.basePath}/files?${params.toString()}`,
              {
                headers: {
                  Accept: "application/vnd.api+json",
                  Authorization: `Bearer ${client.token.access_token}`,
                },
              }
            ) as Promise<AxiosResponse<FileList>>
        );
        return { cursors, data: page.data, status: 200 };
      },
      query: (req) => parseListQuery(req, filesListQuery),
    },
    POST: {
      execute: async ({ client, input }) => {
        const response = await client.files.createFile({
          createFileRequest: {
            data: { attributes: input as CreateFileReq, type: "file" },
          },
        });
        return { id: response.data.data.id, status: 200 };
      },
      parse: (req) => {
        const parsed = parseJsonBody<unknown>(req.body);
        if (isBodyParseError(parsed)) return parsed;
        return validCreateFileRequest(parsed)
          ? parsed
          : { message: "Invalid body.", status: 400 };
      },
    },
  },
};

export const handleFiles = createVertexRoute(filesCollectionRouteSpec);
