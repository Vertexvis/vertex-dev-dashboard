import { nodeMswServer } from "./server";

export function installNodeMswServer(): void {
  beforeAll(() => {
    nodeMswServer.listen({
      onUnhandledRequest(request, print) {
        const url = new URL(request.url);
        const isLocalApiRequest =
          (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
          url.pathname.startsWith("/api/");

        if (isLocalApiRequest) {
          return;
        }

        print.error();
        throw new Error(
          `Unhandled outbound request: ${request.method} ${url.toString()}`
        );
      },
    });
  });

  afterEach(() => {
    nodeMswServer.resetHandlers();
  });

  afterAll(() => {
    nodeMswServer.close();
  });
}
