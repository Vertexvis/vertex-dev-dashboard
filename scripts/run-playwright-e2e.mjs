#!/usr/bin/env node
// Launches Playwright with per-run secrets shared between the test process
// and the Next dev server that playwright.config.ts starts.
//
// E2E_PORT (default 3100) selects the port used for the dev server, the
// Playwright baseURL, and the mock upstream hosts wired up by
// /api/test/e2e-session. Override it when something else already occupies
// 3100, e.g. `E2E_PORT=3177 node scripts/run-playwright-e2e.mjs`.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const executable = join(root, "node_modules", ".bin", "playwright");
const child = spawn(executable, ["test", ...process.argv.slice(2)], {
  env: {
    ...process.env,
    COOKIE_SECRET: randomBytes(32).toString("hex"),
    E2E_PORT: process.env.E2E_PORT ?? "3100",
    E2E_SESSION_SECRET: randomBytes(32).toString("hex"),
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal == null ? 1 : 128);
});
