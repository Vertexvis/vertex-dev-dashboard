import { server } from "./server";

function createRelativeUrlFetch(nativeFetch: typeof fetch): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (typeof input === "string" || input instanceof URL) {
      return nativeFetch(
        new URL(input.toString(), "http://localhost").toString(),
        init
      );
    }

    return nativeFetch(input, init);
  }) as typeof fetch;
}

export function installJsdomMockServer(): void {
  // Client-side tests fetch relative URLs like "/api/...".
  // Normalize them to localhost so MSW's Node server can intercept them.
  const jsdomFetch = createRelativeUrlFetch(globalThis.fetch.bind(globalThis));
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    global.fetch = jsdomFetch;
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
    global.fetch = originalFetch;
  });
}
