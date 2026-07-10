import { server } from "./server";

interface FetchApis {
  readonly fetch: typeof fetch;
  readonly Headers: typeof Headers;
  readonly Request: typeof Request;
  readonly Response: typeof Response;
}

function createRelativeUrlFetch(nativeFetch: typeof fetch): typeof fetch {
  return ((
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<globalThis.Response> => {
    if (typeof input === "string" || input instanceof URL) {
      return nativeFetch(
        new URL(input.toString(), "http://localhost").toString(),
        init,
      );
    }

    return nativeFetch(input, init);
  }) as typeof fetch;
}

function getFetchApis(): FetchApis {
  const { fetch: nativeFetch, Headers, Request, Response } = globalThis;

  if (
    nativeFetch != null &&
    Headers != null &&
    Request != null &&
    Response != null
  ) {
    return {
      fetch: nativeFetch,
      Headers,
      Request,
      Response,
    };
  }

  // Jest's jsdom environment may not expose fetch globals even though Node can.
  const nodeFetchModule = require("node-fetch") as {
    readonly default: typeof fetch;
    readonly Headers: typeof Headers;
    readonly Request: typeof Request;
    readonly Response: typeof Response;
  };

  return {
    fetch: nodeFetchModule.default,
    Headers: nodeFetchModule.Headers,
    Request: nodeFetchModule.Request,
    Response: nodeFetchModule.Response,
  };
}

export function installMockServer(): void {
  beforeAll(() => {
    const apis = getFetchApis();

    Object.assign(global, {
      Headers: apis.Headers,
      Request: apis.Request,
      Response: apis.Response,
      fetch: createRelativeUrlFetch(apis.fetch),
    });

    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    const apis = getFetchApis();

    server.resetHandlers();
    Object.assign(global, { fetch: createRelativeUrlFetch(apis.fetch) });
  });

  afterAll(() => {
    server.close();
  });
}
