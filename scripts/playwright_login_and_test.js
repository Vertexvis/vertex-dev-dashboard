const { mkdir } = require("node:fs/promises");
const path = require("node:path");

const { chromium } = require("playwright");

const requiredEnvironmentVariables = ["DEV_USERNAME", "DEV_CREDENTIAL"];
const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
  (name) => !process.env[name]
);

if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missingEnvironmentVariables.join(
      ", "
    )}`
  );
}

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

function parseBoolean(value, defaultValue) {
  if (value == null) return defaultValue;

  if (["1", "true", "yes"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no"].includes(value.toLowerCase())) return false;

  throw new Error(
    `Expected PLAYWRIGHT_VISIBLE to be true or false; received ${value}`
  );
}

async function loginAndSaveState(browser) {
  const context = await browser.newContext();

  try {
    const page = await context.newPage();
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

    await page.getByLabel("Client ID").fill(process.env.DEV_USERNAME);
    await page.getByLabel("Client Secret").fill(process.env.DEV_CREDENTIAL);

    const environmentSelect = page.getByRole("combobox", {
      name: "Environment",
    });
    if ((await environmentSelect.count()) > 0) {
      await environmentSelect.click();
      await page
        .getByRole("option", { name: environment, exact: true })
        .click();
    }

    await Promise.all([
      page.waitForURL((url) => !url.pathname.endsWith("/login")),
      page.getByRole("button", { name: "Sign In", exact: true }).click(),
    ]);

    await mkdir(path.dirname(storageStatePath), { recursive: true });
    await context.storageState({ path: storageStatePath });
  } finally {
    await context.close();
  }
}

async function openAuthenticatedDashboard(browser) {
  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();
  await page.goto(destination, { waitUntil: "domcontentloaded" });

  if (new URL(page.url()).pathname.endsWith("/login")) {
    await context.close();
    throw new Error(
      "Saved authentication state was not accepted by the dashboard."
    );
  }

  return context;
}

async function main() {
  const browser = await chromium.launch({ headless: !visible });

  try {
    await loginAndSaveState(browser);
    const authenticatedContext = await openAuthenticatedDashboard(browser);

    console.log(`Saved authenticated state to ${storageStatePath}`);
    console.log(`Opened ${destination}`);

    if (visible) {
      console.log("Close the browser window when you are finished.");
      await new Promise((resolve) => browser.once("disconnected", resolve));
      return;
    }

    await authenticatedContext.close();
  } finally {
    if (browser.isConnected()) await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
