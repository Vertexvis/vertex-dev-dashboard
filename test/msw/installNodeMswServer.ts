import { nodeMswServer } from "./server";

export function installNodeMswServer(): void {
  beforeAll(() => {
    nodeMswServer.listen({
      onUnhandledRequest(request, print) {
        const isLocalApiRequest =
          (request.url.hostname === "127.0.0.1" ||
            request.url.hostname === "localhost") &&
          request.url.pathname.startsWith("/api/");

        if (isLocalApiRequest) {
          return;
        }

        print.error();
        throw new Error(
          `Unhandled outbound request: ${
            request.method
          } ${request.url.toString()}`
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
