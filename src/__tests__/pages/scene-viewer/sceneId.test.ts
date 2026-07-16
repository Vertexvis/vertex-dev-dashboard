import type { Session } from "next-iron-session";

import {
  CredsKey,
  EnvKey,
  NextIronRequest,
  TokenKey,
} from "../../../lib/with-session";
import { serverSidePropsHandler } from "../../../pages/scene-viewer/[sceneId]";

const mockCreateSceneStreamKey = jest.fn();

jest.mock("../../../lib/vertex-api", () => ({
  getClientFromSession: jest.fn(() => ({
    streamKeys: { createSceneStreamKey: mockCreateSceneStreamKey },
  })),
}));

describe("scene viewer route", () => {
  beforeEach(() => {
    mockCreateSceneStreamKey.mockReset();
  });

  it("creates a stream key and redirects when the URL only specifies a scene", async () => {
    mockCreateSceneStreamKey.mockResolvedValue({
      data: { data: { attributes: { key: "stream-key-1" } } },
    });

    const result = await serverSidePropsHandler({
      query: { sceneId: "scene-1" },
      req: createReq(),
    });

    expect(mockCreateSceneStreamKey).toHaveBeenCalledWith({
      id: "scene-1",
      createStreamKeyRequest: {
        data: { type: "stream-key", attributes: { expiry: 86400 } },
      },
    });
    expect(result).toEqual({
      redirect: {
        destination: "/scene-viewer/scene-1?streamKey=stream-key-1",
        permanent: false,
      },
    });
  });

  it("uses a supplied stream key without creating a replacement", async () => {
    const result = await serverSidePropsHandler({
      query: { sceneId: "scene-1", streamKey: "provided-key" },
      req: createReq(),
    });

    expect(mockCreateSceneStreamKey).not.toHaveBeenCalled();
    expect(result).toEqual({
      props: {
        clientId: "client-id",
        networkConfig: undefined,
        vertexEnv: "platdev",
      },
    });
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
