#!/usr/bin/env node
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
    E2E_SESSION_SECRET: randomBytes(32).toString("hex"),
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal == null ? 1 : 128);
});
