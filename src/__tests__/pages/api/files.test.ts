/**
 * @jest-environment node
 */
import type { NextApiResponse } from "next";
import type { Session } from "next-iron-session";

import { type MockServerHarness, startMockServer } from "../../../../test/helpers/mockserver";
import {
  CredsKey,
  EnvKey,
  NetworkConfig as NetworkConfigKey,
  type NextIronRequest,
  TokenKey,
} from "../../../lib/with-session";
import { handleFiles } from "../../../pages/api/files";

jest.setTimeout(120_000);

type JsonBody = Record<string, unknown>;

type TestReq = Pick<NextIronRequest, "body" | "method" | "query" | "session">;

interface TestRes extends Pick<NextApiResponse, "json" | "status"> {
  readonly body: () => unknown;
  readonly statusCode: () => number | undefined;
}

describe("files API route", () => {
  let mockServer: MockServerHarness;

  beforeAll(async () => {
    mockServer = await startMockServer();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(async () => {
    await mockServer.client.reset();
  });

  it("lists files with filter query parameters", async () => {
    await expectFilesList({
      "filter[createdAt][gte]": ["2026-06-01T00:00:00.000Z"],
      "filter[createdAt][lte]": ["2026-06-30T23:59:59.999Z"],
      "filter[fileId][eq]": ["2d6cf3f3-7d20-46ab-ab84-f6cb23877864"],
      "filter[name][contains]": ["gear"],
      "filter[suppliedId][contains]": ["sup-123"],
      "page[cursor]": ["cursor-1"],
      "page[size]": ["50"],
    });

    const res = await callFiles({
      method: "GET",
      query: {
        createdAtEnd: "2026-06-30T23:59:59.999Z",
        createdAtStart: "2026-06-01T00:00:00.000Z",
        cursor: "cursor-1",
        fileId: "2d6cf3f3-7d20-46ab-ab84-f6cb23877864",
        name: "gear",
        pageSize: "50",
        suppliedId: "sup-123",
      },
    });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({
      cursors: { next: undefined, self: undefined },
      data: [fileData("file-1")],
      status: 200,
    });
    await verifyFilesList({
      "filter[createdAt][gte]": ["2026-06-01T00:00:00.000Z"],
      "filter[createdAt][lte]": ["2026-06-30T23:59:59.999Z"],
      "filter[fileId][eq]": ["2d6cf3f3-7d20-46ab-ab84-f6cb23877864"],
      "filter[name][contains]": ["gear"],
      "filter[suppliedId][contains]": ["sup-123"],
      "page[cursor]": ["cursor-1"],
      "page[size]": ["50"],
    });
  });

  it("uses the default page size when one is not supplied", async () => {
    await expectFilesList({ "page[size]": ["10"] });

    const res = await callFiles({ method: "GET" });

    expect(res.statusCode()).toBe(200);
    await verifyFilesList({ "page[size]": ["10"] });
  });

  function callFiles(req: {
    readonly body?: string;
    readonly method: string;
    readonly query?: Record<string, string | string[]>;
  }): Promise<TestRes> {
    return callApi((r, res) => handleFiles(r, res), req);
  }

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
    return {
      body,
      method,
      query,
      session: createSession(),
    } as TestReq as NextIronRequest;
  }

  function createSession(): Session {
    const values = new Map<string, unknown>([
      [CredsKey, { id: "client-id", secret: "client-secret" }],
      [EnvKey, "custom"],
      [
        NetworkConfigKey,
        {
          apiHost: mockServer.apiHost,
          name: "mock-server",
          renderingHost: mockServer.apiHost,
          sceneTreeHost: mockServer.apiHost,
          sceneViewHost: mockServer.apiHost,
        },
      ],
      [
        TokenKey,
        {
          expiration: Date.now() + 3_600_000,
          token: {
            access_token: "token",
            account_id: "account-id",
            expires_in: 3_600,
            scopes: [],
            token_type: "Bearer",
          },
        },
      ],
    ]);

    return {
      destroy: jest.fn(),
      get: jest.fn((key: string) => values.get(key)),
      save: jest.fn(),
      set: jest.fn((key: string, value: unknown) => values.set(key, value)),
    } as Session;
  }

  function createRes(): TestRes {
    let payload: unknown;
    let code: number | undefined;

    return {
      body: () => payload,
      json: (body: unknown) => {
        payload = body;
        return undefined as never;
      },
      status: (statusCode: number) => {
        code = statusCode;
        return { json: (body: unknown) => ((payload = body), undefined as never) };
      },
      statusCode: () => code,
    };
  }

  async function expectFilesList(queryStringParameters?: Record<string, string[]>) {
    await mockServer.client.mockAnyResponse({
      httpRequest: {
        method: "GET",
        path: "/files",
        queryStringParameters,
      },
      httpResponse: jsonResponse({
        data: [fileData("file-1")],
        links: { next: "/files?page[cursor]=next-page", self: "/files?page[cursor]=self-page" },
      }),
    });
  }

  async function verifyFilesList(queryStringParameters?: Record<string, string[]>) {
    await mockServer.client.verify(
      {
        method: "GET",
        path: "/files",
        queryStringParameters,
      },
      1,
      1
    );
  }

  function fileData(id: string): JsonBody {
    return {
      attributes: {
        createdAt: "2026-06-20T12:34:56.000Z",
        metadata: {},
        name: "gear.stl",
        rootFileName: "gear.stl",
        suppliedId: "sup-123",
        type: "stl",
      },
      id,
      links: { self: `/files/${id}` },
      type: "file",
    };
  }

  function jsonResponse(body: JsonBody, statusCode = 200) {
    return {
      body: JSON.stringify(body),
      headers: { "content-type": ["application/json"] },
      statusCode,
    };
  }
});
