#!/usr/bin/env node

import type {
  SpawnSyncOptions,
  SpawnSyncOptionsWithStringEncoding,
  SpawnSyncReturns,
} from "child_process";
import { spawnSync } from "child_process";
import * as fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const prettier: string = require.resolve("prettier/bin-prettier.js");

type Mode = "write" | "check";

const mode: Mode = process.argv.includes("--write") ? "write" : "check";
const supportedExtensions = new Set<string>([
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

function git(
  args: string[],
  options: SpawnSyncOptionsWithStringEncoding
): SpawnSyncReturns<string>;
function git(
  args: string[],
  options?: SpawnSyncOptions
): SpawnSyncReturns<Buffer>;
function git(
  args: string[],
  options: SpawnSyncOptions = {}
): SpawnSyncReturns<string | Buffer> {
  const result = spawnSync("git", args, options);

  if (result.status !== 0) {
    if (result.stderr != null) {
      process.stderr.write(result.stderr);
    }
  }

  return result;
}

function stagedFiles(): string[] {
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
    .filter((file) => supportedExtensions.has(extension(file)))
    .filter(isRegularFile);
}

function extension(file: string): string {
  const match = file.toLowerCase().match(/(\.[^.]+)$/);
  return match == null ? "" : match[1];
}

function stagedBlob(file: string): SpawnSyncReturns<Buffer> {
  return git(["show", `:${file}`]);
}

function indexMode(file: string): string | null {
  const result = git(["ls-files", "-s", "-z", "--", file], {
    encoding: "utf8",
  });

  if (result.status !== 0 || result.stdout.length === 0) {
    return null;
  }

  return result.stdout.split(" ", 1)[0];
}

// Only format regular files (mode 100644/100755). Symlinks (120000) and
// gitlinks (160000) store a path, not source we want to run through prettier:
// formatting a symlink's blob would rewrite it to point at a mangled target.
function isRegularFile(file: string): boolean {
  const mode = indexMode(file);
  return mode === "100644" || mode === "100755";
}

function formatBlob(
  file: string,
  input: string | Buffer
): SpawnSyncReturns<Buffer> {
  return spawnSync(process.execPath, [prettier, "--stdin-filepath", file], {
    input,
  });
}

function updateIndex(file: string, formatted: Buffer): boolean {
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

function updateWorktreeIfSafe(file: string, formatted: Buffer): void {
  if (!fs.existsSync(file)) {
    return;
  }

  // `git diff --quiet` is filter/eol-aware: exit 0 means the worktree matches
  // the index, so it's safe to overwrite. A non-zero status means real
  // unstaged edits (or an error) — leave the file alone.
  if (git(["diff", "--quiet", "--", file]).status !== 0) {
    return;
  }

  fs.writeFileSync(file, formatted);
}

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

  updateWorktreeIfSafe(file, formatted.stdout);
  if (!updateIndex(file, formatted.stdout)) {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
