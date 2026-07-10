import { IncomingMessage, ServerResponse } from "http";
import { ParsedUrlQuery } from "querystring";
import { NextApiHandler } from "next";
import { apiResolver } from "next/dist/server/api-utils/node/api-resolver";

import { CookieAttributes } from "../../src/lib/with-session";

export interface NextJsPagesApiRoute {
  readonly handler: NextApiHandler;
  readonly pathname: string;
}

export type NextJsPagesApiTestApp = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<void>;

const previewModeKeys = {
  previewModeEncryptionKey: "preview-mode-encryption-key",
  previewModeId: "preview-mode-id-123",
  previewModeSigningKey: "preview-mode-signing-key-123",
};

export function createNextJsPagesApiTestApp(
  routes: readonly NextJsPagesApiRoute[]
): NextJsPagesApiTestApp {
  process.env.COOKIE_SECRET ||= "test-cookie-secret-that-is-long-enough";
  CookieAttributes.password ||= process.env.COOKIE_SECRET;

  const compiledRoutes = routes.map(createCompiledRoute);

  return async (req, res) => {
    const route = matchRoute(compiledRoutes, req);
    if (route == null) {
      res.statusCode = 404;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ message: "API route not found.", status: 404 }));
      return;
    }

    await apiResolver(
      req,
      res,
      route.query,
      { default: route.handler },
      { ...previewModeKeys, dev: false },
      false,
      false,
      route.pathname
    );
  };
}

interface CompiledRoute {
  readonly handler: NextApiHandler;
  readonly pathname: string;
  readonly segments: readonly string[];
}

interface MatchedRoute {
  readonly handler: NextApiHandler;
  readonly pathname: string;
  readonly query: ParsedUrlQuery;
}

function createCompiledRoute(route: NextJsPagesApiRoute): CompiledRoute {
  return {
    handler: route.handler,
    pathname: route.pathname,
    segments: splitPathname(route.pathname),
  };
}

function matchRoute(
  routes: readonly CompiledRoute[],
  req: IncomingMessage
): MatchedRoute | undefined {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const requestSegments = splitPathname(url.pathname);

  for (const route of routes) {
    const params = matchRouteSegments(route.segments, requestSegments);
    if (params == null) {
      continue;
    }

    return {
      handler: route.handler,
      pathname: route.pathname,
      query: mergeQuery(params, url.searchParams),
    };
  }

  return undefined;
}

function splitPathname(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

function matchRouteSegments(
  routeSegments: readonly string[],
  requestSegments: readonly string[]
): ParsedUrlQuery | undefined {
  const params: ParsedUrlQuery = {};
  let requestIndex = 0;

  for (let routeIndex = 0; routeIndex < routeSegments.length; routeIndex += 1) {
    const routeSegment = routeSegments[routeIndex];

    if (isOptionalCatchAllSegment(routeSegment)) {
      const paramName = getDynamicParamName(routeSegment);
      const remainingSegments = requestSegments.slice(requestIndex);
      if (remainingSegments.length > 0) {
        params[paramName] = remainingSegments.map(decodeURIComponent);
      }
      return params;
    }

    if (isCatchAllSegment(routeSegment)) {
      if (requestIndex >= requestSegments.length) {
        return undefined;
      }

      params[getDynamicParamName(routeSegment)] = requestSegments
        .slice(requestIndex)
        .map(decodeURIComponent);
      return params;
    }

    const requestSegment = requestSegments[requestIndex];
    if (requestSegment == null) {
      return undefined;
    }

    if (isDynamicSegment(routeSegment)) {
      params[getDynamicParamName(routeSegment)] = decodeURIComponent(requestSegment);
      requestIndex += 1;
      continue;
    }

    if (routeSegment !== requestSegment) {
      return undefined;
    }

    requestIndex += 1;
  }

  return requestIndex === requestSegments.length ? params : undefined;
}

function mergeQuery(
  routeParams: ParsedUrlQuery,
  searchParams: URLSearchParams
): ParsedUrlQuery {
  const query: ParsedUrlQuery = { ...routeParams };

  searchParams.forEach((value, key) => {
    const existingValue = query[key];
    if (existingValue == null) {
      query[key] = value;
      return;
    }

    query[key] = Array.isArray(existingValue)
      ? [...existingValue, value]
      : [existingValue, value];
  });

  return query;
}

function isDynamicSegment(segment: string): boolean {
  return /^\[[^./][^/]*\]$/.test(segment);
}

function isCatchAllSegment(segment: string): boolean {
  return /^\[\.\.\.[^/]+\]$/.test(segment);
}

function isOptionalCatchAllSegment(segment: string): boolean {
  return /^\[\[\.\.\.[^/]+\]\]$/.test(segment);
}

function getDynamicParamName(segment: string): string {
  return segment.replace(/^\[\[?\.\.\./, "").replace(/\]?\]$/, "");
}
