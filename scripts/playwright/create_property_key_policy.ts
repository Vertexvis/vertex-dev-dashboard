import { existsSync } from "node:fs";
import { chromium } from "playwright";

type PolicyMode = "allow" | "deny";

const optionValues = new Map<string, string>();
const args = process.argv.slice(2);

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--help") {
    console.log(`Usage: npx tsx scripts/playwright/create_property_key_policy.ts [options]

Options:
  --name <name>                 Policy name
  --key-count <number>          Number of distinct property keys (default 200)
  --mode <allow|deny>           Policy mode (default allow)
  --dashboard-url <url>         Dashboard origin
  --storage-state <path>        Authenticated Playwright storage state`);
    process.exit(0);
  }

  if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);

  const value = args[index + 1];
  if (value == null || value.startsWith("--"))
    throw new Error(`Missing value for ${arg}.`);

  optionValues.set(arg, value);
  index += 1;
}

const dashboardUrl =
  optionValues.get("--dashboard-url") ??
  process.env.DEV_DASHBOARD_URL ??
  "http://localhost:3000";
const storageState =
  optionValues.get("--storage-state") ??
  process.env.PLAYWRIGHT_STORAGE_STATE ??
  "playwright/.auth/dev-dashboard.json";
const keyCount = Number.parseInt(
  optionValues.get("--key-count") ??
    process.env.PLAYWRIGHT_PROPERTY_KEY_COUNT ??
    "200",
  10
);
const policyName =
  optionValues.get("--name") ??
  process.env.PLAYWRIGHT_POLICY_NAME ??
  `Playwright Property Key Exercise ${new Date().toISOString()}`;
const mode = (optionValues.get("--mode") ??
  process.env.PLAYWRIGHT_PROPERTY_KEY_MODE ??
  "allow") as PolicyMode;

if (!Number.isSafeInteger(keyCount) || keyCount < 1)
  throw new Error("--key-count must be a positive integer.");

if (mode !== "allow" && mode !== "deny")
  throw new Error("--mode must be either allow or deny.");

if (!existsSync(storageState))
  throw new Error(
    `Authenticated storage state not found at ${storageState}. Run yarn playwright:login first.`
  );

const keys = Array.from(
  { length: keyCount },
  (_, index) => `playwright-key-${String(index + 1).padStart(3, "0")}`
);

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  try {
    await page.goto(`${dashboardUrl}/property-key-policies`);
    await page.getByRole("button", { name: "Create Policy" }).click();
    await page.getByLabel("Name").fill(policyName);
    await page
      .getByRole("radio", { name: mode === "allow" ? "Allow" : "Deny" })
      .check();

    // Each field must mount before the next key can be filled.
    // eslint-disable-next-line no-await-in-loop
    for (let index = 0; index < keys.length; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await page
        .locator(`input[aria-label="Property key ${index + 1}"]`)
        .fill(keys[index]);
      if (index < keys.length - 1) {
        // eslint-disable-next-line no-await-in-loop
        await page.getByRole("button", { name: "Add Property Key" }).click();
      }
    }

    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByText(policyName, { exact: true }).waitFor();
    console.log(
      `Created ${mode} policy ${policyName} with ${keyCount} property keys.`
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

void main();
