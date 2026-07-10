import { IncomingMessage, ServerResponse } from "http";
import { NextApiHandler, PageConfig } from "next";
import { apiResolver } from "next/dist/server/api-utils/node/api-resolver";
import { ParsedUrlQuery } from "querystring";

import { CookieAttributes } from "../../src/lib/with-session";

export interface NextJsApiRouteTestRoute {
  readonly config?: PageConfig;
  readonly handler: NextApiHandler;
  readonly pathname: string;
}

export type NextJsApiRouteTestApp = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<void>;

const apiResolverContext = {
  previewModeEncryptionKey: "preview-mode-encryption-key",
  previewModeId: "preview-mode-id-123",
  previewModeSigningKey: "preview-mode-signing-key-123",
};

export function createNextJsApiRouteTestApp(
  routes: readonly NextJsApiRouteTestRoute[]
): NextJsApiRouteTestApp {
  ensureTestSessionConfig();

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
      route.resolverModule,
      { ...apiResolverContext, dev: false },
      false,
      false,
      route.pathname
    );
  };
}

interface CompiledRoute {
  readonly pathname: string;
  readonly resolverModule: ResolverModule;
  readonly segments: readonly string[];
}

interface MatchedRoute {
  readonly pathname: string;
  readonly query: ParsedUrlQuery;
  readonly resolverModule: ResolverModule;
}

interface ResolverModule {
  readonly config?: PageConfig;
  readonly default: NextApiHandler;
}

function ensureTestSessionConfig(): void {
  process.env.COOKIE_SECRET ||= "test-cookie-secret-that-is-long-enough";
  CookieAttributes.password ||= process.env.COOKIE_SECRET;
}

function createCompiledRoute(route: NextJsApiRouteTestRoute): CompiledRoute {
  return {
    pathname: route.pathname,
    resolverModule: toApiResolverModule(route),
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
      pathname: route.pathname,
      query: mergeQuery(params, url.searchParams),
      resolverModule: route.resolverModule,
    };
  }

  return undefined;
}

function toApiResolverModule(route: NextJsApiRouteTestRoute): ResolverModule {
  return route.config == null
    ? { default: route.handler }
    : { config: route.config, default: route.handler };
}

function splitPathname(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

function matchRouteSegments(
  routeSegments: readonly string[],
  requestSegments: readonly string[]
): ParsedUrlQuery | undefined {
  if (routeSegments.length !== requestSegments.length) {
    return undefined;
  }

  const params: ParsedUrlQuery = {};

  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index];
    const requestSegment = requestSegments[index];

    if (isDynamicSegment(routeSegment)) {
      params[getDynamicParamName(routeSegment)] = decodeURIComponent(requestSegment);
      continue;
    }

    if (routeSegment !== requestSegment) {
      return undefined;
    }
  }

  return params;
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

function getDynamicParamName(segment: string): string {
  return segment.replace(/^\[/, "").replace(/\]$/, "");
}
