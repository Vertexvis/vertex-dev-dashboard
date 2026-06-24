import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const authFile = path.join(projectRoot, "playwright/.auth/user.json");
const url = process.argv[2] ?? "http://localhost:3000";

if (!existsSync(authFile)) {
  console.error(`Missing storage state: ${path.relative(projectRoot, authFile)}`);
  console.error(
    "Create it with: npx playwright codegen --save-storage=playwright/.auth/user.json <url>"
  );
  process.exit(1);
}

await mkdir(path.dirname(authFile), { recursive: true });

const browser = await chromium.launch({
  headless: false,
});

const context = await browser.newContext({
  storageState: authFile,
  viewport: { width: 1440, height: 1000 },
});

const page = await context.newPage();

const saveState = async () => {
  if (!browser.isConnected()) {
    return;
  }

  await context.storageState({ path: authFile });
  await browser.close();
};

process.once("SIGINT", async () => {
  await saveState();
  process.exit(0);
});

process.once("SIGTERM", async () => {
  await saveState();
  process.exit(0);
});

await page.goto(url);
console.log(`Opened ${url}`);
console.log("Close the browser window or press Ctrl-C here when done.");

await new Promise((resolve) => browser.once("disconnected", resolve));
