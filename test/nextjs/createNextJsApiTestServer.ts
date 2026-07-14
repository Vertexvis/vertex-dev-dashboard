import { createServer, Server } from "node:http";
import { join } from "node:path";

import next from "next";

export interface NextJsApiTestServer {
  readonly server: Server;
  close(): Promise<void>;
}

/**
 * Starts the built Next.js application so API tests exercise the real request
 * pipeline: filesystem routing, Next's API resolver, and middleware.
 */
export async function createNextJsApiTestServer(): Promise<NextJsApiTestServer> {
  configureBuiltNextApplication();

  const app = next({
    dev: false,
    dir: process.cwd(),
    quiet: true,
  });
  await app.prepare();

  const handle = app.getRequestHandler();
  const server = createServer((request, response) => {
    void handle(request, response);
  });
  await listen(server);

  return {
    server,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error == null ? resolve() : reject(error)));
      });
      await app.close();
    },
  };
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function configureBuiltNextApplication(): void {
  // This is how Next starts standalone builds. Reusing the build's resolved
  // config avoids Jest's unsupported dynamic import of next.config.js.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { config } = require(join(process.cwd(), ".next/required-server-files.json"));
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);
}
