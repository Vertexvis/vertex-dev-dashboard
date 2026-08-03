import { buildQuery } from "../paging";

export type ResourceOperation = "list" | "get" | "create" | "update" | "remove";

export async function requestJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  return (await fetch(path, init)).json() as Promise<T>;
}

export function createResourceClient<
  TList,
  TListQuery extends Record<string, string | number | undefined>,
  TCreate,
  TUpdate,
  TGet = TList,
  TRemove = { readonly ids: string[] }
>(spec: {
  readonly path: string;
  readonly supports: readonly ResourceOperation[];
}): {
  readonly create?: (body: TCreate) => Promise<unknown>;
  readonly get?: (id: string) => Promise<TGet>;
  readonly keys: {
    readonly all: readonly [string];
    readonly detail: (id: string) => readonly [string, string];
    readonly list: (query: TListQuery) => string;
  };
  readonly list?: (query: TListQuery) => Promise<TList>;
  readonly remove?: (body: TRemove) => Promise<unknown>;
  readonly update?: (id: string, body: TUpdate) => Promise<unknown>;
} {
  const supports = (operation: ResourceOperation) =>
    spec.supports.includes(operation);
  const withJsonBody = (method: string, body: unknown): RequestInit => ({
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method,
  });

  return {
    ...(supports("create")
      ? {
          create: (body: TCreate) =>
            requestJson(spec.path, withJsonBody("POST", body)),
        }
      : {}),
    ...(supports("get")
      ? {
          get: (id: string) =>
            requestJson<TGet>(`${spec.path}/${encodeURIComponent(id)}`),
        }
      : {}),
    keys: {
      all: [spec.path],
      detail: (id: string) => [spec.path, id],
      list: (query: TListQuery) => buildQuery(spec.path, query),
    },
    ...(supports("list")
      ? {
          list: (query: TListQuery) =>
            requestJson<TList>(buildQuery(spec.path, query)),
        }
      : {}),
    ...(supports("remove")
      ? {
          remove: (body: TRemove) =>
            requestJson(spec.path, withJsonBody("DELETE", body)),
        }
      : {}),
    ...(supports("update")
      ? {
          update: (id: string, body: TUpdate) =>
            requestJson(
              `${spec.path}/${encodeURIComponent(id)}`,
              withJsonBody("PATCH", body)
            ),
        }
      : {}),
  };
}
