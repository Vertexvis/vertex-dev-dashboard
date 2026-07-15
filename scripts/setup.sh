#!/usr/bin/env bash

# Sets up a worktree
set -euo pipefail

yarn install --frozen-lockfile
yarn playwright install chromium
