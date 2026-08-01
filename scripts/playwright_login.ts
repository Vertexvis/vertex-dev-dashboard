import { chmod, mkdir } from "node:fs/promises";
import * as path from "node:path";

import type { Browser, BrowserContext } from "playwright";
import { chromium } from "playwright";

function readRequiredEnv(names: string[]): string[] {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}`
    );
  }

  return names.map((name) => process.env[name] as string);
}

function readCustomNetworkHosts(): { apiHost: string; renderingHost: string } {
  const apiHost = process.env.DEV_API_HOST;
  const renderingHost = process.env.DEV_RENDERING_HOST;

  if (!apiHost || !renderingHost) {
    throw new Error(
      "DEV_ENVIRONMENT=custom requires DEV_API_HOST and DEV_RENDERING_HOST to be set."
    );
  }

  return { apiHost, renderingHost };
}

function parseBoolean(
  value: string | undefined,
  defaultValue: boolean
): boolean {
  if (value == null) return defaultValue;

  if (["1", "true", "yes"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no"].includes(value.toLowerCase())) return false;

  throw new Error(
    `Expected PLAYWRIGHT_VISIBLE to be true or false; received ${value}`
  );
}

const [username, credential] = readRequiredEnv([
  "DEV_USERNAME",
  "DEV_CREDENTIAL",
]);

const baseUrl = new URL(
  process.env.DEV_DASHBOARD_URL ?? "http://localhost:3000"
);
const destination = new URL(
  process.env.DEV_DASHBOARD_PATH ?? "/",
  baseUrl
).toString();
const loginUrl = new URL("/login", baseUrl).toString();
const storageStatePath = path.resolve(
  process.env.PLAYWRIGHT_STORAGE_STATE ?? "playwright/.auth/dev-dashboard.json"
);
const visible = parseBoolean(process.env.PLAYWRIGHT_VISIBLE, false);
const environment = process.env.DEV_ENVIRONMENT ?? "platdev";
const customNetworkHosts =
  environment === "custom" ? readCustomNetworkHosts() : null;

async function loginAndSaveState(browser: Browser): Promise<void> {
  const context = await browser.newContext();

  try {
    const page = await context.newPage();
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

    await page.getByLabel("Client ID").fill(username);
    await page.getByLabel("Client Secret").fill(credential);

    const environmentSelect = page.getByRole("combobox", {
      name: "Environment",
    });
    if ((await environmentSelect.count()) > 0) {
      await environmentSelect.click();
      await page
        .getByRole("option", { name: environment, exact: true })
        .click();

      if (customNetworkHosts != null) {
        await page.getByLabel("Api Host").fill(customNetworkHosts.apiHost);
        await page
          .getByLabel("Rendering Host")
          .fill(customNetworkHosts.renderingHost);
      }
    }

    await Promise.all([
      page.waitForURL((url) => !url.pathname.endsWith("/login")),
      page.getByRole("button", { name: "Sign In", exact: true }).click(),
    ]);

    await mkdir(path.dirname(storageStatePath), { recursive: true });
    await context.storageState({ path: storageStatePath });
    await chmod(storageStatePath, 0o600);
  } finally {
    await context.close();
  }
}

async function openAuthenticatedDashboard(
  browser: Browser
): Promise<BrowserContext> {
  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();
  const response = await page.goto(destination, {
    waitUntil: "domcontentloaded",
  });

  if (new URL(page.url()).pathname.endsWith("/login")) {
    await context.close();
    throw new Error(
      "Saved authentication state was not accepted by the dashboard."
    );
  }

  if (response != null && !response.ok()) {
    await context.close();
    throw new Error(
      `Dashboard responded with HTTP ${response.status()} for ${destination}.`
    );
  }

  return context;
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: !visible });

  try {
    await loginAndSaveState(browser);
    const authenticatedContext = await openAuthenticatedDashboard(browser);

    console.log(`Saved authenticated state to ${storageStatePath}`);
    console.log(`Opened ${destination}`);

    if (visible) {
      console.log("Close the browser window when you are finished.");
      const [authenticatedPage] = authenticatedContext.pages();

      const finished: Promise<unknown>[] = [
        new Promise<void>((resolve) => {
          browser.once("disconnected", () => resolve());
        }),
      ];
      if (authenticatedPage != null) {
        finished.push(authenticatedPage.waitForEvent("close", { timeout: 0 }));
      }

      await Promise.race(finished);
      return;
    }

    await authenticatedContext.close();
  } finally {
    if (browser.isConnected()) await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
