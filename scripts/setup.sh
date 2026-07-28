#!/usr/bin/env bash

# Sets up a worktree
set -euo pipefail

# Correctly resolve the script directory and repository root, even if the script is sourced or symlinked
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"

cd "$repo_root"
"$script_dir/setup-env-local.sh"

yarn install --frozen-lockfile
yarn playwright install chromium webkit
