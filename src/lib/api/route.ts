import type { VertexClient } from "@vertexvis/api-client-node";
import { logError } from "@vertexvis/api-client-node";
import type { NextApiResponse } from "next";
import type { Handler } from "next-iron-session";

import {
  BodyRequired,
  ErrorRes,
  InvalidBody,
  isErrorFailure,
  MethodNotAllowed,
  Res,
  ServerError,
  toErrorRes,
} from "../api";
import { getClientFromSession } from "../vertex-api";
import { NextIronRequest } from "../with-session";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RouteContext<
  TInput = unknown,
  TQuery = Record<string, unknown>
> {
  readonly client: VertexClient;
  readonly input: TInput;
  readonly method: HttpMethod;
  readonly path: Readonly<Record<string, string | undefined>>;
  readonly query: TQuery;
  readonly req: NextIronRequest;
  readonly res: NextApiResponse;
}

export type HookResult<T extends Res> = void | T;

export interface RouteHooks<TInput, TQuery, TResult extends Res> {
  readonly afterCall?: (
    ctx: RouteContext<TInput, TQuery>,
    result: TResult
  ) => Promise<TResult>;
  readonly afterResponse?: (
    ctx: RouteContext<TInput, TQuery>,
    result: TResult
  ) => Promise<void>;
  readonly beforeCall?: (
    ctx: RouteContext<TInput, TQuery>
  ) => Promise<HookResult<TResult>>;
  readonly beforeRequest?: (
    ctx: RouteContext<TInput, TQuery>
  ) => Promise<HookResult<TResult>>;
  readonly beforeValidate?: (
    ctx: RouteContext<TInput, TQuery>
  ) => Promise<HookResult<TResult>>;
  readonly onError?: (
    ctx: Partial<RouteContext<TInput, TQuery>>,
    error: unknown
  ) => Promise<ErrorRes | undefined>;
  readonly transformInput?: (
    ctx: RouteContext<TInput, TQuery>
  ) => Promise<TInput> | TInput;
  readonly transformQuery?: (
    ctx: RouteContext<TInput, TQuery>
  ) => Promise<TQuery> | TQuery;
  readonly validate?: (
    ctx: RouteContext<TInput, TQuery>
  ) => Promise<HookResult<TResult>>;
}

export interface RouteOperation<TInput, TQuery, TResult extends Res> {
  readonly parse?: (req: NextIronRequest) => TInput | ErrorRes;
  readonly query?: (req: NextIronRequest) => TQuery | ErrorRes;
  readonly execute: (ctx: RouteContext<TInput, TQuery>) => Promise<TResult>;
}

export interface VertexRouteSpec<TInput, TQuery, TResult extends Res> {
  readonly hooks?: RouteHooks<TInput, TQuery, TResult>;
  readonly operations: Partial<
    Record<HttpMethod, RouteOperation<TInput, TQuery, TResult>>
  >;
}

export function parseJsonBody<T>(body: unknown): T | ErrorRes {
  if (body == null || body === "") return BodyRequired;
  if (typeof body !== "string") return body as T;

  try {
    return JSON.parse(body) as T;
  } catch {
    return InvalidBody;
  }
}

/**
 * Only parser-created sentinel objects may bypass a resource's own input
 * validation. Do not use structural ErrorRes checks on untrusted JSON bodies.
 */
export function isBodyParseError(value: unknown): value is ErrorRes {
  return value === BodyRequired || value === InvalidBody;
}

export function requiredPathParam(
  req: NextIronRequest,
  name: string,
  label = name
): string | ErrorRes {
  const value = req.query[name];
  const pathValue = Array.isArray(value) ? value[0] : value;
  return pathValue == null || pathValue.trim() === ""
    ? { message: `${label} is required.`, status: 400 }
    : pathValue;
}

export function toRouteError(error: unknown): ErrorRes {
  const vertexError = error as {
    readonly vertexError?: { readonly res?: unknown };
  };
  const axiosError = error as {
    readonly response?: { readonly data?: unknown };
  };
  const failure = vertexError.vertexError?.res ?? axiosError.response?.data;

  if (isErrorFailure(failure)) return toErrorRes({ failure });
  logError(error as never);
  return ServerError;
}

function isErrorRes(value: unknown): value is ErrorRes {
  return (
    typeof value === "object" &&
    value != null &&
    typeof (value as ErrorRes).message === "string" &&
    typeof (value as ErrorRes).status === "number"
  );
}

function pathFromRequest(
  req: NextIronRequest
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(req.query).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ])
  );
}

function send<TResult extends Res>(
  res: NextApiResponse,
  result: TResult
): void {
  res.status(result.status).json(result);
}

export function createVertexRoute<TInput, TQuery, TResult extends Res>(
  spec: VertexRouteSpec<TInput, TQuery, TResult>
): Handler<NextIronRequest, NextApiResponse> {
  return async (req, res): Promise<void> => {
    const method = req.method as HttpMethod | undefined;
    const operation = method == null ? undefined : spec.operations[method];
    if (operation == null || method == null) {
      send(res, MethodNotAllowed);
      return;
    }

    let context: Partial<RouteContext<TInput, TQuery>> = { req, res, method };
    try {
      const client = await getClientFromSession(req.session);
      const input = operation.parse?.(req) as TInput | ErrorRes | undefined;
      if (isErrorRes(input)) return send(res, input);
      const query = operation.query?.(req) as TQuery | ErrorRes | undefined;
      if (isErrorRes(query)) return send(res, query);

      context = {
        client,
        input: input as TInput,
        method,
        path: pathFromRequest(req),
        query: query as TQuery,
        req,
        res,
      };
      let typedContext = context as RouteContext<TInput, TQuery>;
      const hooks = spec.hooks;
      const beforeRequest = await hooks?.beforeRequest?.(typedContext);
      if (beforeRequest != null) return send(res, beforeRequest);
      const beforeValidate = await hooks?.beforeValidate?.(typedContext);
      if (beforeValidate != null) return send(res, beforeValidate);
      const validation = await hooks?.validate?.(typedContext);
      if (validation != null) return send(res, validation);

      const transformedQuery = await hooks?.transformQuery?.(typedContext);
      const transformedInput = await hooks?.transformInput?.(typedContext);
      if (transformedQuery != null || transformedInput != null) {
        typedContext = {
          ...typedContext,
          input: transformedInput ?? typedContext.input,
          query: transformedQuery ?? typedContext.query,
        };
        context = typedContext;
      }

      const beforeCall = await hooks?.beforeCall?.(typedContext);
      if (beforeCall != null) return send(res, beforeCall);
      const result = await operation.execute(typedContext);
      const afterCall = await hooks?.afterCall?.(typedContext, result);
      const finalResult = afterCall ?? result;
      send(res, finalResult);

      try {
        await hooks?.afterResponse?.(typedContext, finalResult);
      } catch (error) {
        logError(error as never);
      }
    } catch (error) {
      const mapped = await spec.hooks?.onError?.(context, error);
      send(res, mapped ?? toRouteError(error));
    }
  };
}
