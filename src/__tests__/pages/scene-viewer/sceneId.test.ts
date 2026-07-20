import type { Session } from "next-iron-session";

import {
  CredsKey,
  EnvKey,
  NextIronRequest,
  TokenKey,
} from "../../../lib/with-session";
import { serverSidePropsHandler } from "../../../pages/scene-viewer/[sceneId]";

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
