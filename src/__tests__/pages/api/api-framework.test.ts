/**
 * @jest-environment node
 */
/* eslint-disable require-await */
import type { NextApiResponse } from "next";

import { parseJsonBody } from "../../../lib/api/route";
import {
  createVertexRoute,
  type VertexRouteSpec,
} from "../../../lib/api/route";
import { NextIronRequest } from "../../../lib/with-session";

jest.mock("../../../lib/vertex-api", () => ({
  getClientFromSession: jest.fn(async () => ({ files: {} })),
}));

jest.spyOn(console, "error").mockImplementation(() => undefined);

interface Result {
  readonly label?: string;
  readonly status: number;
}

function response(): NextApiResponse & {
  body: () => Result;
  statusCode: () => number | undefined;
} {
  let body: Result;
  let statusCode: number | undefined;
  const res = {
    body: () => body,
    json: jest.fn((value: Result) => {
      body = value;
      return res;
    }),
    status: jest.fn((status: number) => {
      statusCode = status;
      return res;
    }),
    statusCode: () => statusCode,
  };
  return res as unknown as NextApiResponse & {
    body: () => Result;
    statusCode: () => number | undefined;
  };
}

function request(method: string, body?: unknown): NextIronRequest {
  return { body, method, query: {}, session: {} } as NextIronRequest;
}

describe("Vertex route lifecycle", () => {
  it("rejects unsupported methods before session/client acquisition", async () => {
    const handler = createVertexRoute<Result, undefined, Result>({
      operations: { GET: { execute: async () => ({ status: 200 }) } },
    });
    const res = response();

    await handler(request("PUT"), res);

    expect(res.statusCode()).toBe(405);
    expect(res.body()).toEqual({ message: "Method not allowed.", status: 405 });
  });

  it("runs hooks in order, transforms input, and keeps after-response failures out of the wire response", async () => {
    const events: string[] = [];
    const spec: VertexRouteSpec<{ value: string }, undefined, Result> = {
      hooks: {
        afterCall: async (_, result) => {
          events.push("afterCall");
          return { ...result, label: "after" };
        },
        afterResponse: async () => {
          events.push("afterResponse");
          throw new Error("post-response failure");
        },
        beforeCall: async () => {
          events.push("beforeCall");
        },
        beforeRequest: async () => {
          events.push("beforeRequest");
        },
        beforeValidate: async () => {
          events.push("beforeValidate");
        },
        transformInput: ({ input }) => {
          events.push("transformInput");
          return { value: input.value.toUpperCase() };
        },
        validate: async () => {
          events.push("validate");
        },
      },
      operations: {
        POST: {
          execute: async ({ input }) => {
            events.push(`execute:${input.value}`);
            return { status: 200 };
          },
          parse: (req) => parseJsonBody<{ value: string }>(req.body),
        },
      },
    };
    const handler = createVertexRoute(spec);
    const res = response();

    await handler(request("POST", '{"value":"fixture"}'), res);

    expect(events).toEqual([
      "beforeRequest",
      "beforeValidate",
      "validate",
      "transformInput",
      "beforeCall",
      "execute:FIXTURE",
      "afterCall",
      "afterResponse",
    ]);
    expect(res.body()).toEqual({ label: "after", status: 200 });
  });

  it("does not execute an operation when parsing or validation short-circuits", async () => {
    const execute = jest.fn(async () => ({ status: 200 }));
    const spec: VertexRouteSpec<undefined, undefined, Result> = {
      hooks: { validate: async () => ({ message: "Blocked.", status: 400 }) },
      operations: { POST: { execute } },
    };
    const res = response();

    await createVertexRoute(spec)(request("POST"), res);

    expect(execute).not.toHaveBeenCalled();
    expect(res.body()).toEqual({ message: "Blocked.", status: 400 });
  });
});

describe("safe JSON parser", () => {
  it("handles object, empty, and malformed Next request bodies", () => {
    expect(parseJsonBody({ name: "fixture" })).toEqual({ name: "fixture" });
    expect(parseJsonBody(undefined)).toEqual({
      message: "Body required.",
      status: 400,
    });
    expect(parseJsonBody("{")).toEqual({
      message: "Invalid body.",
      status: 400,
    });
  });
});
