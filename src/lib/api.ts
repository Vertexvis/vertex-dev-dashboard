import { defined, Failure } from "@vertexvis/api-client-node";

export interface DeleteReq {
  readonly ids: string[];
}

export interface ErrorRes extends Res {
  readonly message: string;
}

export interface GetRes<T> extends Res {
  readonly cursor?: string;
  readonly data: T[];
}

export interface Res {
  readonly status: number;
}

export const BodyRequired: ErrorRes = {
  message: "Body required.",
  status: 400,
};

export const InvalidBody: ErrorRes = {
  message: "Invalid body.",
  status: 400,
};

export const MethodNotAllowed: ErrorRes = {
  message: "Method not allowed.",
  status: 405,
};

export const ServerError: ErrorRes = {
  message: "Unknown error from Vertex API.",
  status: 500,
};

export function toErrorRes({ failure }: { failure: Failure }): ErrorRes {
  const fallback = "Unknown error.";
  const res = { message: fallback, status: ServerError.status };
  if (failure == null || failure.errors == null) return res;

  const es = [...failure.errors];
  if (es == null || es.length === 0) return res;

  return {
    message: es[0].title ?? fallback,
    status: parseInt(es[0].status ?? ServerError.status.toString(), 10),
  };
}

export function isErrorRes(obj?: {
  message?: string;
  status?: number;
}): obj is ErrorRes {
  return defined(obj) && defined(obj.message) && defined(obj.status);
}

export async function fetcher(req: RequestInfo): Promise<any> { //eslint-disable-line
  return (await fetch(req)).json();
}
