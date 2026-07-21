import { expect, test as setup } from "playwright/test";

const storageState = "e2e/.auth/session.json";
const e2eSessionSecret = process.env.E2E_SESSION_SECRET;

setup("creates a local-only authenticated session", async ({ request }) => {
  if (e2eSessionSecret == null) {
    throw new Error("E2E_SESSION_SECRET was not configured by Playwright.");
  }
  const response = await request.post("/api/test/e2e-session", {
    headers: { "x-e2e-session-secret": e2eSessionSecret },
  });
  expect(response.ok()).toBeTruthy();
  await request.storageState({ path: storageState });
});
