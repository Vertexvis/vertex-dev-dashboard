/**
 * @jest-environment node
 */
import type { NextApiResponse } from "next";

import { handleSceneWorkspaceItems } from "../../../lib/resources/scene-workspace/scene-workspace-items.hooks";
import { handleSceneWorkspaceViews } from "../../../lib/resources/scene-workspace/scene-workspace-views.hooks";
import type { NextIronRequest } from "../../../lib/with-session";

const getSceneItems = jest.fn();
const getSceneViews = jest.fn();

jest.mock("../../../lib/vertex-api", () => ({
  getClientFromSession: jest.fn(() =>
    Promise.resolve({
      sceneItems: { getSceneItems },
      sceneViews: { getSceneViews },
    })
  ),
}));

interface TestResponse extends Pick<NextApiResponse, "json" | "status"> {
  readonly body: () => unknown;
  readonly statusCode: () => number | undefined;
}

function response(): TestResponse {
  let body: unknown;
  let statusCode: number | undefined;
  const res = {
    body: () => body,
    json: jest.fn((value: unknown) => {
      body = value;
      return res;
    }),
    status: jest.fn((status: number) => {
      statusCode = status;
      return res;
    }),
    statusCode: () => statusCode,
  };
  return res as TestResponse;
}

function request(query: Record<string, string | string[]>): NextIronRequest {
  return { method: "GET", query, session: {} } as NextIronRequest;
}

const page = { data: { data: [], links: {} } };

describe("scene workspace read routes", () => {
  beforeEach(() => {
    getSceneItems.mockReset().mockResolvedValue(page);
    getSceneViews.mockReset().mockResolvedValue(page);
  });

  it("maps the assembly query to the typed scene-items SDK call", async () => {
    const res = response();

    await handleSceneWorkspaceItems(
      request({
        cursor: "cursor-1",
        pageSize: "200",
        sceneId: "scene-1",
        suppliedId: "assembly-1",
      }),
      res as NextApiResponse
    );

    expect(res.statusCode()).toBe(200);
    expect(res.body()).toEqual({ cursors: {}, data: [], status: 200 });
    expect(getSceneItems).toHaveBeenCalledWith({
      filterSuppliedId: "assembly-1",
      id: "scene-1",
      pageCursor: "cursor-1",
      pageSize: 100,
    });
  });

  it("rejects missing or ambiguous scene item scope without an SDK call", async () => {
    const missing = response();
    const ambiguous = response();
    await Promise.all([
      handleSceneWorkspaceItems(request({}), missing as NextApiResponse),
      handleSceneWorkspaceItems(
        request({ sceneId: ["scene-1", "scene-2"] }),
        ambiguous as NextApiResponse
      ),
    ]);

    expect(missing.statusCode()).toBe(400);
    expect(missing.body()).toEqual({
      message: "Scene ID is required.",
      status: 400,
    });
    expect(ambiguous.statusCode()).toBe(400);
    expect(ambiguous.body()).toEqual({
      message: "Invalid sceneId.",
      status: 400,
    });
    expect(getSceneItems).not.toHaveBeenCalled();
  });

  it("maps views to the requested scene and bounds the page size", async () => {
    const res = response();

    await handleSceneWorkspaceViews(
      request({ cursor: "cursor-1", pageSize: "101", sceneId: "scene-1" }),
      res as NextApiResponse
    );

    expect(res.statusCode()).toBe(200);
    expect(getSceneViews).toHaveBeenCalledWith({
      id: "scene-1",
      pageCursor: "cursor-1",
      pageSize: 100,
    });
  });

  it("rejects ambiguous view scope without an SDK call", async () => {
    const res = response();

    await handleSceneWorkspaceViews(
      request({ sceneId: ["scene-1", "scene-2"] }),
      res as NextApiResponse
    );

    expect(res.statusCode()).toBe(400);
    expect(res.body()).toEqual({ message: "Invalid sceneId.", status: 400 });
    expect(getSceneViews).not.toHaveBeenCalled();
  });
});
