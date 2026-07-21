import type { FilterExpression } from "@vertexvis/api-client-node";

import { NextIronRequest } from "../with-session";
import { ErrorRes } from "./contracts";

export interface ListQuery {
  readonly cursor?: string;
  readonly filters: Readonly<Record<string, Partial<FilterExpression>>>;
  readonly pageSize: number;
  readonly sort?: string;
}

export interface FilterBinding {
  readonly requestName: string;
  readonly vertexField: string;
  readonly operation: keyof FilterExpression;
}

export interface ListQuerySpec {
  readonly defaultPageSize: number;
  readonly filters?: readonly FilterBinding[];
  readonly maxPageSize?: number;
  readonly sortable?: readonly string[];
  readonly transform?: (params: URLSearchParams, req: NextIronRequest) => void;
}

export function queryValue(
  req: NextIronRequest,
  name: string
): string | undefined {
  const value = req.query[name];
  return Array.isArray(value) ? value[0] : value;
}

export function requiredQueryValue(
  req: NextIronRequest,
  name: string,
  label = name
): string | ErrorRes {
  const value = queryValue(req, name)?.trim();
  return value == null || value === ""
    ? { message: `${label} is required.`, status: 400 }
    : value;
}

export function parseListQuery(
  req: NextIronRequest,
  spec: ListQuerySpec
): ListQuery | ErrorRes {
  const requestedSize = queryValue(req, "pageSize");
  const parsedSize =
    requestedSize != null ? Number.parseInt(requestedSize, 10) : NaN;
  const maxPageSize = spec.maxPageSize ?? 100;
  const pageSize =
    Number.isFinite(parsedSize) &&
    /^\d+$/.test(requestedSize ?? "") &&
    parsedSize > 0
      ? Math.min(parsedSize, maxPageSize)
      : spec.defaultPageSize;

  const sort = queryValue(req, "sort");
  if (sort != null && sort !== "") {
    const field = sort.startsWith("-") ? sort.slice(1) : sort;
    if (field === "" || !spec.sortable?.includes(field)) {
      return { message: "Invalid sort.", status: 400 };
    }
  }

  const filters: Record<string, Partial<FilterExpression>> = {};
  for (const binding of spec.filters ?? []) {
    const value = queryValue(req, binding.requestName);
    if (value == null || value === "") continue;

    filters[binding.vertexField] = {
      ...filters[binding.vertexField],
      [binding.operation]: value,
    };
  }

  return {
    cursor: queryValue(req, "cursor"),
    filters,
    pageSize,
    sort: sort || undefined,
  };
}

export function toVertexListParams(
  query: ListQuery,
  spec: ListQuerySpec,
  req?: NextIronRequest
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.cursor != null) params.set("page[cursor]", query.cursor);
  params.set("page[size]", query.pageSize.toString());
  if (query.sort != null) params.set("sort", query.sort);

  for (const [field, expression] of Object.entries(query.filters)) {
    for (const [operation, value] of Object.entries(expression)) {
      if (value != null)
        params.append(`filter[${field}][${operation}]`, String(value));
    }
  }

  if (req != null) spec.transform?.(params, req);
  return params;
}
