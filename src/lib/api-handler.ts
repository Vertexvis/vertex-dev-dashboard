import { logError, VertexError } from "@vertexvis/api-client-node";
import { NextApiResponse } from "next";

import {
  ErrorRes,
  MethodNotAllowed,
  Res,
  ServerError,
  toErrorRes,
} from "./api";
import { NextIronRequest } from "./with-session";

/**
 * Normalizes a thrown VertexError into our ErrorRes shape. Collapses the
 * try/catch block that was previously copied into every route handler.
 */
export function handleVertexError(error: unknown): ErrorRes {
  const obj = error as Record<string, unknown> | null;
  const isVertexError =
    typeof obj === "object" && obj != null && "vertexError" in obj;

  if (isVertexError) {
    const e = error as VertexError;
    logError(e);
    return e.vertexError?.res
      ? toErrorRes({ failure: e.vertexError.res })
      : ServerError;
  }

  console.error(error);
  return ServerError;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** A per-method handler: run the logic and return an API response payload. */
export type MethodHandler = (req: NextIronRequest) => Promise<Res>;

/**
 * Builds an inner API handler that:
 *  - dispatches by HTTP method to the matching handler,
 *  - returns 405 for any method that isn't provided,
 *  - serializes the returned payload as JSON using its `status` (or 200), and
 *  - converts any thrown VertexError into a logged ErrorRes.
 *
 * Wrap the result in `withSession` for the route's default export, e.g.:
 *
 *   export const handleThing = methodRouter({ GET: get, DELETE: del });
 *   export default withSession(handleThing);
 */
export function methodRouter(handlers: Partial<Record<Method, MethodHandler>>) {
  return async function handle(
    req: NextIronRequest,
    res: NextApiResponse,
  ): Promise<void> {
    const handler = handlers[req.method as Method];
    if (handler == null) {
      res.setHeader("Allow", Object.keys(handlers).join(", "));
      return res.status(MethodNotAllowed.status).json(MethodNotAllowed);
    }

    let payload: unknown;
    try {
      payload = await handler(req);
    } catch (error) {
      payload = handleVertexError(error);
    }

    const status =
      typeof (payload as { status?: unknown } | null)?.status === "number"
        ? (payload as { status: number }).status
        : 200;
    return res.status(status).json(payload);
  };
}
