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
import { handleFileCollectionFiles } from "../../../pages/api/file-collections/[id]/files";

jest.setTimeout(120_000);

interface TestRes extends Pick<NextApiResponse, "json" | "status"> {
  readonly body: () => unknown;
  readonly statusCode: () => number | undefined;
}

describe("file collection membership API route", () => {
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

  it("serializes typed file membership adds upstream", async () => {
    await mockServer.client.mockAnyResponse({
      httpRequest: {
        body: JSON.stringify({ data: ["file-1", "file-2"] }),
        method: "POST",
        path: "/file-collections/collection-1/files",
      },
      httpResponse: jsonResponse({ data: collectionData("collection-1") }),
    });

    const res = await callRoute({
      body: JSON.stringify({ fileIds: ["file-1", "file-2"] }),
      method: "POST",
      query: { id: "collection-1" },
    });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({ status: 200 });
    await mockServer.client.verify(
      {
        body: JSON.stringify({ data: ["file-1", "file-2"] }),
        method: "POST",
        path: "/file-collections/collection-1/files",
      },
      1,
      1
    );
  });

  it("serializes relationship removal as the documented filter query", async () => {
    await mockServer.client.mockAnyResponse({
      httpRequest: {
        method: "DELETE",
        path: "/file-collections/collection-1/files",
        queryStringParameters: { "filter[fileId]": ["file-1,file-2"] },
      },
      httpResponse: jsonResponse({}),
    });

    const res = await callRoute({
      body: JSON.stringify({ fileIds: ["file-1", "file-2"] }),
      method: "DELETE",
      query: { id: "collection-1" },
    });

    expect(res.statusCode()).toBe(200);
    await mockServer.client.verify(
      {
        method: "DELETE",
        path: "/file-collections/collection-1/files",
        queryStringParameters: { "filter[fileId]": ["file-1,file-2"] },
      },
      1,
      1
    );
  });

  it("maps typed relationship failures without returning success", async () => {
    await mockServer.client.mockAnyResponse({
      httpRequest: {
        method: "POST",
        path: "/file-collections/collection-1/files",
      },
      httpResponse: jsonResponse(
        { errors: [{ status: "409", title: "File is already a member." }] },
        409
      ),
    });

    const res = await callRoute({
      body: JSON.stringify({ fileIds: ["file-1"] }),
      method: "POST",
      query: { id: "collection-1" },
    });

    expect(res.statusCode()).toBe(409);
    expect(res.body()).toEqual({
      message: "File is already a member.",
      status: 409,
    });
  });

  it("rejects an invalid parent ID without an upstream request", async () => {
    const res = await callRoute({
      body: JSON.stringify({ fileIds: ["file-1"] }),
      method: "POST",
      query: { id: "   " },
    });

    expect(res.statusCode()).toBe(400);
    await mockServer.client.verifyZeroInteractions();
  });

  async function callRoute({
    body,
    method,
    query = {},
  }: {
    readonly body?: string;
    readonly method: string;
    readonly query?: Record<string, string | string[]>;
  }): Promise<TestRes> {
    const res = createRes();
    await handleFileCollectionFiles(
      {
        body,
        method,
        query,
        session: createSession(mockServer.apiHost),
      } as NextIronRequest,
      res as unknown as NextApiResponse
    );
    return res;
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

function collectionData(id: string): Record<string, unknown> {
  return {
    attributes: { created: "2026-07-21T12:00:00Z", name: "Fixture" },
    id,
    type: "file-collection",
  };
}

function jsonResponse(body: Record<string, unknown>, statusCode = 200) {
  return {
    body: JSON.stringify(body),
    headers: { "content-type": ["application/json"] },
    statusCode,
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
    set: (key: string, value: unknown) => values.set(key, value),
  } as unknown as Session;
}
