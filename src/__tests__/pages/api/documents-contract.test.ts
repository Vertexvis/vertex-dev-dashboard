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
import { handleDocuments } from "../../../pages/api/documents";
import { handleDocumentsDetail } from "../../../pages/api/documents/[id]";

interface TestResponse extends Pick<NextApiResponse, "json" | "status"> {
  readonly body: () => unknown;
  readonly statusCode: () => number | undefined;
}

jest.setTimeout(120_000);

describe("Documents API routes against MockServer", () => {
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

  it("serializes the documented list cursor, size, and supplied-ID filter", async () => {
    await mockServer.client.mockAnyResponse({
      httpRequest: {
        method: "GET",
        path: "/documents",
        queryStringParameters: {
          "filter[suppliedId]": ["doc-a,doc-b"],
          "page[cursor]": ["cursor-1"],
          "page[size]": ["25"],
        },
      },
      httpResponse: jsonResponse({
        data: [documentData("document-1", "doc-a")],
        links: {
          next: {
            href: `${mockServer.apiHost}/documents?page[cursor]=cursor-2`,
          },
          self: {
            href: `${mockServer.apiHost}/documents?page[cursor]=cursor-1`,
          },
        },
      }),
    });

    const res = await callCollection({
      method: "GET",
      query: { cursor: "cursor-1", pageSize: "25", suppliedId: "doc-a,doc-b" },
    });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({
      cursors: { next: "cursor-2", self: "cursor-1" },
      data: [documentData("document-1", "doc-a")],
      status: 200,
    });
    await mockServer.client.verify(
      {
        method: "GET",
        path: "/documents",
        queryStringParameters: {
          "filter[suppliedId]": ["doc-a,doc-b"],
          "page[cursor]": ["cursor-1"],
          "page[size]": ["25"],
        },
      },
      1,
      1
    );
  });

  it("checks completed Files then serializes a JSON:API document create", async () => {
    await mockServer.client.mockAnyResponse({
      httpRequest: { method: "GET", path: "/files/file-1" },
      httpResponse: jsonResponse({
        data: {
          attributes: { status: "complete" },
          id: "file-1",
          type: "file",
        },
      }),
    });
    await mockServer.client.mockAnyResponse({
      httpRequest: {
        body: JSON.stringify({
          data: {
            attributes: { fileId: "file-1", suppliedId: "doc-a" },
            type: "document",
          },
        }),
        method: "POST",
        path: "/documents",
      },
      httpResponse: jsonResponse(
        { data: documentData("document-1", "doc-a") },
        201
      ),
    });

    const res = await callCollection({
      body: JSON.stringify({ fileId: "file-1", suppliedId: "doc-a" }),
      method: "POST",
    });

    expect(res.statusCode()).toBe(201);
    expect(res.body()).toEqual({
      ...documentData("document-1", "doc-a"),
      status: 201,
    });
    await mockServer.client.verify(
      { method: "GET", path: "/files/file-1" },
      1,
      1
    );
    await mockServer.client.verify(
      {
        body: JSON.stringify({
          data: {
            attributes: { fileId: "file-1", suppliedId: "doc-a" },
            type: "document",
          },
        }),
        method: "POST",
        path: "/documents",
      },
      1,
      1
    );
  });

  it("returns typed document detail through the generated detail route", async () => {
    await mockServer.client.mockAnyResponse({
      httpRequest: { method: "GET", path: "/documents/document-1" },
      httpResponse: jsonResponse({ data: documentData("document-1", "doc-a") }),
    });

    const res = await callDetail({
      method: "GET",
      query: { id: "document-1" },
    });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({
      ...documentData("document-1", "doc-a"),
      status: 200,
    });
    await mockServer.client.verify(
      { method: "GET", path: "/documents/document-1" },
      1,
      1
    );
  });

  it("maps Preview list and detail failures without claiming success", async () => {
    await mockServer.client.mockAnyResponse({
      httpRequest: { method: "GET", path: "/documents" },
      httpResponse: jsonResponse(
        {
          errors: [
            { status: "403", title: "Document Preview is unavailable." },
          ],
        },
        403
      ),
    });
    const list = await callCollection({ method: "GET" });
    expect(list.statusCode()).toBe(403);
    expect(list.body()).toEqual({
      message: "Document Preview is unavailable.",
      status: 403,
    });

    await mockServer.client.reset();
    await mockServer.client.mockAnyResponse({
      httpRequest: { method: "GET", path: "/documents/missing-document" },
      httpResponse: jsonResponse(
        { errors: [{ status: "404", title: "Document was not found." }] },
        404
      ),
    });
    const detail = await callDetail({
      method: "GET",
      query: { id: "missing-document" },
    });
    expect(detail.statusCode()).toBe(404);
    expect(detail.body()).toEqual({
      message: "Document was not found.",
      status: 404,
    });
  });

  function callCollection({
    body,
    method,
    query = {},
  }: {
    readonly body?: string;
    readonly method: string;
    readonly query?: Record<string, string | string[]>;
  }): Promise<TestResponse> {
    return call(handleDocuments, { body, method, query });
  }

  function callDetail({
    body,
    method,
    query = {},
  }: {
    readonly body?: string;
    readonly method: string;
    readonly query?: Record<string, string | string[]>;
  }): Promise<TestResponse> {
    return call(handleDocumentsDetail, { body, method, query });
  }

  async function call(
    handler: (req: NextIronRequest, res: NextApiResponse) => Promise<void>,
    {
      body,
      method,
      query,
    }: {
      readonly body?: string;
      readonly method: string;
      readonly query: Record<string, string | string[]>;
    }
  ): Promise<TestResponse> {
    const res = createResponse();
    await handler(
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

function createResponse(): TestResponse {
  let body: unknown;
  let statusCode: number | undefined;
  const res = {} as TestResponse;
  res.body = () => body;
  res.statusCode = () => statusCode;
  res.status = jest.fn((status: number) => {
    statusCode = status;
    return res;
  });
  res.json = jest.fn((value: unknown) => {
    body = value;
    return res;
  });
  return res;
}

function documentData(
  id: string,
  suppliedId?: string
): Record<string, unknown> {
  return {
    attributes: {
      createdAt: "2026-07-21T12:00:00Z",
      documentType: "PDF",
      fileId: "file-1",
      ...(suppliedId == null ? {} : { suppliedId }),
    },
    id,
    type: "document",
  };
}

function jsonResponse(body: Record<string, unknown>, statusCode = 200) {
  return {
    body: JSON.stringify(body),
    headers: { "content-type": ["application/vnd.api+json"] },
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
