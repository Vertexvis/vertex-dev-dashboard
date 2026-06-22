/**
 * @jest-environment node
 */
import type { NextApiResponse } from "next";
import type { Session } from "next-iron-session";

import {
  type MockServerHarness,
  startMockServer,
} from "../../../../test/helpers/mockserver";
import {
  CredsKey,
  EnvKey,
  NetworkConfig as NetworkConfigKey,
  type NextIronRequest,
  TokenKey,
} from "../../../lib/with-session";
import { handleFiles } from "../../../pages/api/files";

type JsonBody = Record<string, unknown>;

type TestReq = Pick<NextIronRequest, "body" | "method" | "query" | "session">;

interface TestRes extends Pick<NextApiResponse, "json" | "status"> {
  readonly body: () => unknown;
  readonly statusCode: () => number | undefined;
}

jest.setTimeout(120_000);

describe("files API route", () => {
  let mockServer: MockServerHarness;

  beforeAll(async () => {
    mockServer = await startMockServer();
  });

  afterAll(async () => {
    await mockServer?.stop();
  });

  beforeEach(async () => {
    await mockServer.client.reset();
  });

  it("lists files with sort query parameters", async () => {
    await mockServer.client.mockAnyResponse({
      httpRequest: {
        method: "GET",
        path: "/files",
        queryStringParameters: {
          "page[cursor]": ["cursor-1"],
          "page[size]": ["50"],
          sort: ["-created"],
        },
      },
      httpResponse: jsonResponse({
        data: [fileData("file-1")],
        links: {
          next: {
            href: `${mockServer.apiHost}/files?page[cursor]=next-page`,
          },
          self: {
            href: `${mockServer.apiHost}/files?page[cursor]=self-page`,
          },
        },
      }),
    });

    const res = await callApi((r, response) => handleFiles(r, response), {
      method: "GET",
      query: { cursor: "cursor-1", pageSize: "50", sort: "-created" },
    });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [fileData("file-1")],
      status: 200,
    });

    await mockServer.client.verify(
      {
        method: "GET",
        path: "/files",
        queryStringParameters: {
          "page[cursor]": ["cursor-1"],
          "page[size]": ["50"],
          sort: ["-created"],
        },
      },
      1,
      1
    );
  });

  async function callApi(
    handler: (req: NextIronRequest, res: NextApiResponse) => Promise<void>,
    req: {
      readonly body?: string;
      readonly method: string;
      readonly query?: Record<string, string | string[]>;
    }
  ): Promise<TestRes> {
    const res = createRes();
    await handler(createReq(req), res as unknown as NextApiResponse);
    return res;
  }

  function createReq({
    body,
    method,
    query = {},
  }: {
    readonly body?: string;
    readonly method: string;
    readonly query?: Record<string, string | string[]>;
  }): NextIronRequest {
    const req: TestReq = {
      body,
      method,
      query,
      session: createSession(mockServer.apiHost),
    };
    return req as NextIronRequest;
  }
});

function createRes(): TestRes {
  let responseBody: unknown;
  let responseStatus: number | undefined;
  const res = {} as TestRes;
  res.body = () => responseBody;
  res.statusCode = () => responseStatus;
  res.status = jest.fn((statusCode: number) => {
    responseStatus = statusCode;
    return res;
  });
  res.json = jest.fn((body: unknown) => {
    responseBody = body;
    return res;
  });
  return res;
}

function fileData(id: string): JsonBody {
  return {
    attributes: {
      created: "2026-06-10T15:30:00Z",
      name: "alpha.jt",
      status: "completed",
      suppliedId: "supplied-1",
      uploaded: "2026-06-10T15:45:00Z",
    },
    id,
    type: "file",
  };
}

function createSession(apiHost: string): Session {
  const values = new Map<string, unknown>([
    [CredsKey, { id: "client-id", secret: "client-secret" }],
    [EnvKey, "custom"],
    [
      NetworkConfigKey,
      {
        apiHost,
        name: "mock-server",
        renderingHost: apiHost,
        sceneTreeHost: apiHost,
        sceneViewHost: apiHost,
      },
    ],
    [
      TokenKey,
      {
        expiration: Date.now() + 60 * 60 * 1000,
        token: {
          access_token: "test-token",
          account_id: "account-id",
          expires_in: 60 * 60,
          scopes: [],
          token_type: "Bearer",
        },
      },
    ],
  ]);

  return {
    get: (key: string) => values.get(key),
    set: (key: string, value: unknown) => {
      values.set(key, value);
    },
  } as unknown as Session;
}

function jsonResponse(body: JsonBody, statusCode = 200): JsonBody {
  return {
    body: JSON.stringify(body),
    headers: { "content-type": ["application/json"] },
    statusCode,
  };
}
