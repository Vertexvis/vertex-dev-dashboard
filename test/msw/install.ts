import nodeFetch, { Headers, Request, Response } from "node-fetch";

import { server } from "./server";

const fetchImplementation = ((
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  if (typeof input === "string" || input instanceof URL) {
    return nodeFetch(new URL(input.toString(), "http://localhost").toString(), init);
  }

  return nodeFetch(input as never, init);
}) as unknown as typeof fetch;

export function installMockServer(): void {
  beforeAll(() => {
    Object.assign(global, {
      Headers,
      Request,
      Response,
      fetch: fetchImplementation,
    });

    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
    Object.assign(global, { fetch: fetchImplementation });
  });

  afterAll(() => {
    server.close();
  });
}
