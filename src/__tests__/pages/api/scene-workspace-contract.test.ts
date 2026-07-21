/**
 * @jest-environment node
 */
import type { NextApiResponse } from "next";
import type { Session } from "next-iron-session";

import {
  type MockServerHarness,
  startMockServer,
} from "../../../../test/helpers/mockserver";
import { handleSceneWorkspaceItems } from "../../../lib/resources/scene-workspace/scene-workspace-items.hooks";
import { handleSceneWorkspaceViews } from "../../../lib/resources/scene-workspace/scene-workspace-views.hooks";
import {
  CredsKey,
  EnvKey,
  NetworkConfig as NetworkConfigKey,
  type NextIronRequest,
  TokenKey,
} from "../../../lib/with-session";

jest.setTimeout(120_000);

type JsonBody = Record<string, unknown>;

interface TestResponse extends Pick<NextApiResponse, "json" | "status"> {
  readonly body: () => unknown;
  readonly statusCode: () => number | undefined;
}

describe("scene workspace SDK wire contracts", () => {
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

  it("serializes scene-item paging and supplied ID filtering through the SDK", async () => {
    await mockServer.client.mockAnyResponse({
      httpRequest: {
        method: "GET",
        path: "/scenes/scene-1/scene-items",
        queryStringParameters: {
          "filter[suppliedId]": ["assembly-1"],
          "page[cursor]": ["cursor-1"],
          "page[size]": ["100"],
        },
      },
      httpResponse: jsonResponse({
        data: [sceneItem("item-1")],
        links: links("/scenes/scene-1/scene-items"),
      }),
    });

    const res = await callRoute(handleSceneWorkspaceItems, {
      cursor: "cursor-1",
      pageSize: "100",
      sceneId: "scene-1",
      suppliedId: "assembly-1",
    });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [sceneItem("item-1")],
      status: 200,
    });
    await mockServer.client.verify(
      {
        method: "GET",
        path: "/scenes/scene-1/scene-items",
        queryStringParameters: {
          "filter[suppliedId]": ["assembly-1"],
          "page[cursor]": ["cursor-1"],
          "page[size]": ["100"],
        },
      },
      1,
      1
    );
  });

  it("maps an upstream scene-item failure to the stable error envelope", async () => {
    await mockServer.client.mockAnyResponse({
      httpRequest: {
        method: "GET",
        path: "/scenes/scene-1/scene-items",
        queryStringParameters: { "page[size]": ["25"] },
      },
      httpResponse: jsonResponse(failure("403", "Scene access denied."), 403),
    });

    const res = await callRoute(handleSceneWorkspaceItems, {
      sceneId: "scene-1",
    });

    expect(res.statusCode()).toBe(403);
    expect(res.body()).toEqual({
      message: "Scene access denied.",
      status: 403,
    });
  });

  it("serializes scene-view paging through the SDK", async () => {
    await mockServer.client.mockAnyResponse({
      httpRequest: {
        method: "GET",
        path: "/scenes/scene-1/scene-views",
        queryStringParameters: {
          "page[cursor]": ["cursor-1"],
          "page[size]": ["100"],
        },
      },
      httpResponse: jsonResponse({
        data: [sceneView("view-1")],
        links: links("/scenes/scene-1/scene-views"),
      }),
    });

    const res = await callRoute(handleSceneWorkspaceViews, {
      cursor: "cursor-1",
      pageSize: "100",
      sceneId: "scene-1",
    });

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({
      cursors: { next: "next-page", self: "self-page" },
      data: [sceneView("view-1")],
      status: 200,
    });
    await mockServer.client.verify(
      {
        method: "GET",
        path: "/scenes/scene-1/scene-views",
        queryStringParameters: {
          "page[cursor]": ["cursor-1"],
          "page[size]": ["100"],
        },
      },
      1,
      1
    );
  });

  it("maps an upstream scene-view failure to the stable error envelope", async () => {
    await mockServer.client.mockAnyResponse({
      httpRequest: {
        method: "GET",
        path: "/scenes/scene-1/scene-views",
        queryStringParameters: { "page[size]": ["25"] },
      },
      httpResponse: jsonResponse(failure("500", "View service failed."), 500),
    });

    const res = await callRoute(handleSceneWorkspaceViews, {
      sceneId: "scene-1",
    });

    expect(res.statusCode()).toBe(500);
    expect(res.body()).toEqual({
      message: "View service failed.",
      status: 500,
    });
  });

  async function callRoute(
    handler: (req: NextIronRequest, res: NextApiResponse) => Promise<void>,
    query: Record<string, string>
  ): Promise<TestResponse> {
    const res = createResponse();
    await handler(
      {
        method: "GET",
        query,
        session: createSession(mockServer.apiHost),
      } as NextIronRequest,
      res as unknown as NextApiResponse
    );
    return res;
  }
});

function createResponse(): TestResponse {
  let responseBody: unknown;
  let responseStatus: number | undefined;
  const res = {} as TestResponse;
  res.body = () => responseBody;
  res.statusCode = () => responseStatus;
  res.status = jest.fn((status: number) => {
    responseStatus = status;
    return res;
  });
  res.json = jest.fn((body: unknown) => {
    responseBody = body;
    return res;
  });
  return res;
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

function sceneItem(id: string): JsonBody {
  return {
    attributes: { name: "Assembly item", suppliedId: "assembly-1" },
    id,
    type: "scene-item",
  };
}

function sceneView(id: string): JsonBody {
  return {
    attributes: {
      camera: { lookAt: {}, position: {}, up: {} },
      created: "2026-07-21T12:00:00Z",
    },
    id,
    relationships: { scene: { data: { id: "scene-1", type: "scene" } } },
    type: "scene-view",
  };
}

function links(path: string): JsonBody {
  return {
    next: { href: `http://example.test${path}?page[cursor]=next-page` },
    self: { href: `http://example.test${path}?page[cursor]=self-page` },
  };
}

function failure(status: string, title: string): JsonBody {
  return { errors: [{ status, title }] };
}

function jsonResponse(body: JsonBody, statusCode = 200): JsonBody {
  return {
    body: JSON.stringify(body),
    headers: { "content-type": ["application/json"] },
    statusCode,
  };
}
