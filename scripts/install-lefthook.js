const { spawnSync } = require("child_process");
const { accessSync, constants } = require("fs");
const path = require("path");

function resolveLefthookBin() {
  try {
    const packageJsonPath = require.resolve("lefthook/package.json");
    return path.join(
      path.dirname(packageJsonPath),
      "..",
      ".bin",
      process.platform === "win32" ? "lefthook.cmd" : "lefthook"
    );
  } catch {
    return null;
  }
}

function resolveGitHooksDir() {
  const result = spawnSync("git", ["rev-parse", "--git-common-dir"], {
    encoding: "utf8",
  });

  if (result.status !== 0 || result.error != null) {
    return null;
  }

  const gitCommonDir = result.stdout.trim();
  return path.join(path.resolve(gitCommonDir), "hooks");
}

function canWriteHooks() {
  const hooksDir = resolveGitHooksDir();

  if (hooksDir == null) {
    console.log(
      "Git hooks directory is unavailable; skipping lefthook install."
    );
    return false;
  }

  try {
    accessSync(hooksDir, constants.W_OK);
    return true;
  } catch {
    console.log(
      "Git hooks directory is not writable; skipping lefthook install."
    );
    return false;
  }
}

const lefthookBin = resolveLefthookBin();

if (lefthookBin == null) {
  console.log("lefthook is not installed; skipping hook installation.");
  process.exit(0);
}

if (!canWriteHooks()) {
  process.exit(0);
}

const result = spawnSync(lefthookBin, ["install"], { stdio: "inherit" });

process.exit(result.status ?? 1);
