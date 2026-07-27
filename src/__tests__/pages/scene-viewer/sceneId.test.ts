import { http, HttpResponse } from "msw";
import type { Session } from "next-iron-session";

import { installJsdomMockServer } from "../../../../test/msw/installJsdomMockServer";
import { server } from "../../../../test/msw/server";
import {
  CredsKey,
  EnvKey,
  NextIronRequest,
  TokenKey,
} from "../../../lib/with-session";
import {
  createPolicySwitch,
  createStreamKey,
  diagnosePolicy,
  encodeCreds,
  loadItemMetadata,
  serverSidePropsHandler,
} from "../../../pages/scene-viewer/[sceneId]";

type Controller = Parameters<typeof loadItemMetadata>[0]["controller"];

function stringEntry(id: string, name: string, value: string) {
  return {
    id,
    key: { name, category: 0 },
    value: { type: "string", value },
  };
}

describe("scene viewer route", () => {
  it("does not create a stream key while serving a scene route", async () => {
    const result = await serverSidePropsHandler({
      query: { sceneId: "scene-1" },
      req: createReq(),
    });

    expect(result).toEqual({
      props: {
        clientId: "client-id",
        networkConfig: undefined,
        vertexEnv: "platdev",
      },
    });
  });

  it("does not mutate when a supplied stream key is present", async () => {
    const result = await serverSidePropsHandler({
      query: { sceneId: "scene-1", streamKey: "provided-key" },
      req: createReq(),
    });

    expect(result).toEqual({
      props: {
        clientId: "client-id",
        networkConfig: undefined,
        vertexEnv: "platdev",
      },
    });
  });
});

describe("createStreamKey", () => {
  installJsdomMockServer();

  function captureBody(): { current?: Record<string, unknown> } {
    const captured: { current?: Record<string, unknown> } = {};
    server.use(
      http.post("*/api/stream-keys", async ({ request }) => {
        captured.current = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ key: "stream-key-1", status: 200 });
      })
    );
    return captured;
  }

  it("includes propertyKeyPolicyId when a policy is applied", async () => {
    const captured = captureBody();

    const key = await createStreamKey("scene-1", "policy-1");

    expect(key).toBe("stream-key-1");
    expect(captured.current).toEqual({
      id: "scene-1",
      propertyKeyPolicyId: "policy-1",
    });
  });

  it("omits propertyKeyPolicyId when no policy is applied", async () => {
    const captured = captureBody();

    const key = await createStreamKey("scene-1");

    expect(key).toBe("stream-key-1");
    expect(captured.current).toEqual({ id: "scene-1" });
    expect(captured.current).not.toHaveProperty("propertyKeyPolicyId");
  });
});

describe("createPolicySwitch", () => {
  installJsdomMockServer();

  function captureBody(): { current?: Record<string, unknown> } {
    const captured: { current?: Record<string, unknown> } = {};
    server.use(
      http.post("*/api/stream-keys", async ({ request }) => {
        captured.current = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ key: "switched-key", status: 200 });
      })
    );
    return captured;
  }

  it("recreates the stream key under the new policy and derives creds + url", async () => {
    // Drives the in-viewer switch: this is the core of handlePolicyChange,
    // which retains the selected item (state left untouched) while the stream
    // key, credentials, and URL are rebuilt under the new policy.
    const captured = captureBody();

    const { streamKey, credentials, url } = await createPolicySwitch({
      sceneId: "scene-1",
      clientId: "client-id",
      vertexEnv: "platdev",
      policyId: "policy-2",
    });

    // A NEW stream key POST carries the new propertyKeyPolicyId.
    expect(captured.current).toEqual({
      id: "scene-1",
      propertyKeyPolicyId: "policy-2",
    });
    expect(streamKey).toBe("switched-key");
    // Credentials reconnect the viewer with the new key.
    expect(credentials).toEqual({
      clientId: "client-id",
      streamKey: "switched-key",
      vertexEnv: "platdev",
    });
    // URL round-trips the new key + policy for shareability.
    expect(url).toContain("streamKey=switched-key");
    expect(url).toContain("policyId=policy-2");
  });

  it("switches to the unrestricted policy (no propertyKeyPolicyId, no policyId in url)", async () => {
    const captured = captureBody();

    const { url } = await createPolicySwitch({
      sceneId: "scene-1",
      clientId: "client-id",
      vertexEnv: "platdev",
    });

    expect(captured.current).toEqual({ id: "scene-1" });
    expect(captured.current).not.toHaveProperty("propertyKeyPolicyId");
    expect(url).not.toContain("policyId");
  });
});

describe("encodeCreds", () => {
  it("round-trips policyId through the URL when present", () => {
    const url = encodeCreds({
      clientId: "client-id",
      streamKey: "stream-key-1",
      vertexEnv: "platdev",
      sceneId: "scene-1",
      policyId: "policy-1",
    });

    expect(url).toContain("policyId=policy-1");
  });

  it("omits policyId from the URL when absent", () => {
    const url = encodeCreds({
      clientId: "client-id",
      streamKey: "stream-key-1",
      vertexEnv: "platdev",
      sceneId: "scene-1",
    });

    expect(url).not.toContain("policyId");
  });
});

describe("loadItemMetadata", () => {
  it("paginates through all metadata pages via the Web SDK", async () => {
    const listSceneItemMetadata = jest
      .fn()
      .mockResolvedValueOnce({
        paging: { next: "cursor-2" },
        entries: [stringEntry("1", "Material", "Steel")],
      })
      .mockResolvedValueOnce({
        paging: {},
        entries: [stringEntry("2", "Weight", "12kg")],
      });
    const getSceneViewItem = jest
      .fn()
      .mockResolvedValue({ id: "item-1", suppliedId: "s-1", name: "Bracket" });

    const controller = {
      listSceneItemMetadata,
      getSceneViewItem,
    } as unknown as Controller;

    const { metadata: md, entryCount } = await loadItemMetadata({
      controller,
      itemId: "item-1",
      viewId: "view-1",
    });

    expect(listSceneItemMetadata).toHaveBeenCalledTimes(2);
    expect(listSceneItemMetadata).toHaveBeenNthCalledWith(1, "item-1", {
      size: 100,
      cursor: undefined,
    });
    expect(listSceneItemMetadata).toHaveBeenNthCalledWith(2, "item-1", {
      size: 100,
      cursor: "cursor-2",
    });
    expect(md.partName).toBe("Bracket");
    expect(md.properties.Material).toBe("Steel");
    expect(md.properties.Weight).toBe("12kg");
    expect(md.properties.VERTEX_SCENE_ITEM_ID).toBe("item-1");
    // entryCount reflects only the real (non-synthetic) entries returned.
    expect(entryCount).toBe(2);
  });

  it("threads hit identifiers into the synthetic identifier keys", async () => {
    const listSceneItemMetadata = jest.fn().mockResolvedValue({
      paging: {},
      entries: [stringEntry("1", "Material", "Steel")],
    });
    // getSceneViewItem yields no supplied id / name, so the hit identifiers
    // are what surface the part id / revision synthetic keys.
    const getSceneViewItem = jest.fn().mockResolvedValue({ id: "item-1" });

    const controller = {
      listSceneItemMetadata,
      getSceneViewItem,
    } as unknown as Controller;

    const { metadata: md } = await loadItemMetadata({
      controller,
      itemId: "item-1",
      viewId: "view-1",
      identifiers: {
        suppliedId: "supplied-1",
        partId: "part-1",
        partRevisionId: "rev-1",
        partRevisionSuppliedId: "rev-supplied-1",
      },
    });

    expect(md.properties.VERTEX_SCENE_ITEM_SUPPLIED_ID).toBe("supplied-1");
    expect(md.properties.VERTEX_PART_ID).toBe("part-1");
    expect(md.properties.VERTEX_PART_REVISION_ID).toBe("rev-1");
    expect(md.properties.VERTEX_PART_REVISION_SUPPLIED_ID).toBe(
      "rev-supplied-1"
    );
  });

  it("rejects when listSceneItemMetadata fails (drives the panel error state)", async () => {
    const controller = {
      listSceneItemMetadata: jest
        .fn()
        .mockRejectedValue(new Error("metadata unavailable")),
      getSceneViewItem: jest.fn(),
    } as unknown as Controller;

    await expect(
      loadItemMetadata({ controller, itemId: "item-1", viewId: "view-1" })
    ).rejects.toThrow("metadata unavailable");
  });
});

describe("diagnosePolicy", () => {
  it("returns no diagnostic when no policy is active", () => {
    expect(diagnosePolicy({ entryCount: 0 })).toBeUndefined();
    expect(diagnosePolicy({ entryCount: 3 })).toBeUndefined();
  });

  it("flags an active policy that returned no real metadata entries", () => {
    // entryCount is 0 even though synthetic identifier keys are always merged,
    // so the diagnostic can actually fire.
    expect(diagnosePolicy({ policyId: "policy-1", entryCount: 0 })).toBe(
      "Policy applied, but no metadata was returned for this item."
    );
  });

  it("returns no diagnostic when an active policy returned metadata", () => {
    expect(
      diagnosePolicy({ policyId: "policy-1", entryCount: 2 })
    ).toBeUndefined();
  });
});

function createReq(): NextIronRequest {
  const values = new Map<string, unknown>([
    [CredsKey, { id: "client-id", secret: "client-secret" }],
    [EnvKey, "platdev"],
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

  const session = {
    get: (key: string) => values.get(key),
  } as Session;
  return { session } as NextIronRequest;
}
