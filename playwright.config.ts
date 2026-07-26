import { defineConfig, devices } from "playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;
const e2eSessionSecret = process.env.E2E_SESSION_SECRET;
const cookieSecret = process.env.COOKIE_SECRET;

if (e2eSessionSecret == null || cookieSecret == null) {
  throw new Error("Run Playwright through scripts/run-playwright-e2e.mjs.");
}
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error("E2E_PORT must be a valid TCP port number.");
}

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  outputDir: "test-results",
  retries: process.env.CI ? 1 : 0,
  testDir: "e2e",
  timeout: 30_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      dependencies: ["setup"],
      testMatch: /.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `E2E_TEST_MODE=true E2E_PORT=${port} E2E_SESSION_SECRET=${e2eSessionSecret} COOKIE_SECRET=${cookieSecret} yarn dev -p ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
  },
});
