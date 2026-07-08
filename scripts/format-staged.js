#!/usr/bin/env node

const fs = require("fs");
const { spawnSync } = require("child_process");

const mode = process.argv.includes("--write") ? "write" : "check";
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

function git(args, options = {}) {
  const result = spawnSync("git", args, options);

  if (result.status !== 0) {
    if (result.stderr != null) {
      process.stderr.write(result.stderr);
    }
  }

  return result;
}

function stagedFiles() {
  const result = git(
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
    { encoding: "utf8" }
  );

  if (result.status !== 0) {
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
  return git(["show", `:${file}`]);
}

function indexMode(file) {
  const result = git(["ls-files", "-s", "-z", "--", file], {
    encoding: "utf8",
  });

  if (result.status !== 0 || result.stdout.length === 0) {
    return null;
  }

  return result.stdout.split(" ", 1)[0];
}

function formatBlob(file, input) {
  return spawnSync(process.execPath, [prettier, "--stdin-filepath", file], {
    input,
  });
}

function updateIndex(file, formatted) {
  const hash = git(["hash-object", "-w", "--stdin"], {
    input: formatted,
    encoding: "utf8",
  });

  if (hash.status !== 0) {
    return false;
  }

  const fileMode = indexMode(file);
  if (fileMode == null) {
    process.stderr.write(`Unable to read index mode for ${file}\n`);
    return false;
  }

  const objectId = hash.stdout.trim();
  const update = git(["update-index", "--cacheinfo", fileMode, objectId, file]);
  return update.status === 0;
}

function updateWorktreeIfSafe(file, original, formatted) {
  if (!fs.existsSync(file)) {
    return;
  }

  const worktree = fs.readFileSync(file);
  if (Buffer.compare(worktree, original) === 0) {
    fs.writeFileSync(file, formatted);
  }
}

const prettier = require.resolve("prettier/bin-prettier.js");
const files = stagedFiles();
let failed = false;

for (const file of files) {
  const blob = stagedBlob(file);

  if (blob.status !== 0) {
    process.stderr.write(`Unable to read staged content for ${file}\n`);
    failed = true;
    continue;
  }

  const formatted = formatBlob(file, blob.stdout);

  if (formatted.status !== 0) {
    process.stderr.write(formatted.stderr);
    failed = true;
    continue;
  }

  if (Buffer.compare(blob.stdout, formatted.stdout) === 0) {
    process.stdout.write(`Staged formatting ok for ${file}\n`);
    continue;
  }

  if (mode === "check") {
    process.stderr.write(`Staged formatting differs for ${file}\n`);
    failed = true;
    continue;
  }

  process.stdout.write(`Formatting staged content for ${file}\n`);

  updateWorktreeIfSafe(file, blob.stdout, formatted.stdout);
  if (!updateIndex(file, formatted.stdout)) {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
