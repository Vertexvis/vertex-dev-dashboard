#!/usr/bin/env bash

set -euo pipefail

git submodule update --init --recursive

current_worktree="$(git rev-parse --show-toplevel)"
primary_worktree="$(
  git worktree list --porcelain | awk '/^worktree / { print substr($0, 10); exit }'
)"

local_files=(
  "mise.local.toml"
)

# Convenience to bring over uncommitted dev local files into worktrees.
if [[ -n "$primary_worktree" && "$primary_worktree" != "$current_worktree" ]]; then
  for file in "${local_files[@]}"; do
    if [[ -f "$primary_worktree/$file" ]]; then
      mkdir -p "$current_worktree/$(dirname "$file")"
      cp "$primary_worktree/$file" "$current_worktree/$file"
    fi
  done
fi
