import type { NextApiResponse } from "next";

import {
  CredsKey,
  EnvKey,
  NetworkConfig as NetworkConfigKey,
  NextIronRequest,
  TokenKey,
} from "../../../lib/with-session";
import withSession from "../../../lib/with-session";

const E2E_TOKEN = {
  access_token: "e2e-token-not-for-vertex",
  account_id: "e2e-account",
  expires_in: 60 * 60,
  scopes: [],
  token_type: "Bearer",
};

function enabled(req: NextIronRequest): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.E2E_TEST_MODE === "true" &&
    process.env.E2E_SESSION_SECRET != null &&
    req.headers["x-e2e-session-secret"] === process.env.E2E_SESSION_SECRET
  );
}

export async function handleE2eSession(
  req: NextIronRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed.", status: 405 });
    return;
  }
  if (!enabled(req)) {
    res.status(404).json({ message: "Not found.", status: 404 });
    return;
  }

  // Mock upstream hosts loop back to this dev server; E2E_PORT must match
  // the port the harness runs on (see scripts/run-playwright-e2e.mjs).
  const base = `http://127.0.0.1:${process.env.E2E_PORT ?? "3100"}`;
  req.session.set(CredsKey, { id: "e2e-client", secret: "e2e-secret" });
  req.session.set(EnvKey, "custom");
  req.session.set(NetworkConfigKey, {
    apiHost: `${base}/api/e2e-upstream`,
    name: "local-e2e",
    renderingHost: `${base}/e2e-rendering`,
    sceneTreeHost: `${base}/e2e-scene-tree`,
    sceneViewHost: `${base}/e2e-scene-view`,
  });
  req.session.set(TokenKey, {
    expiration: Date.now() + 60 * 60 * 1000,
    token: E2E_TOKEN,
  });
  await req.session.save();
  res.status(200).json({ status: 200 });
}

export default withSession(handleE2eSession);
