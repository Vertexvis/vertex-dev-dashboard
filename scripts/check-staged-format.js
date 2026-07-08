#!/usr/bin/env node

const { spawnSync } = require("child_process");

const supportedExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdx",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

function stagedFiles() {
  const result = spawnSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
    { encoding: "utf8" }
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  return result.stdout
    .split("\0")
    .filter(Boolean)
    .filter((file) => supportedExtensions.has(extension(file)));
}

function extension(file) {
  const match = file.toLowerCase().match(/(\.[^.]+)$/);
  return match == null ? "" : match[1];
}

function stagedBlob(file) {
  return spawnSync("git", ["show", `:${file}`]);
}

const prettier = require.resolve("prettier/bin-prettier.js");
const files = stagedFiles();
let failed = false;

for (const file of files) {
  const blob = stagedBlob(file);

  if (blob.status !== 0) {
    process.stderr.write(`Unable to read staged content for ${file}\n`);
    process.stderr.write(blob.stderr);
    failed = true;
    continue;
  }

  process.stdout.write(`Checking staged formatting for ${file}\n`);

  const result = spawnSync(
    process.execPath,
    [prettier, "--check", "--stdin-filepath", file],
    {
      input: blob.stdout,
      stdio: ["pipe", "inherit", "inherit"],
    }
  );

  if (result.status !== 0) {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
