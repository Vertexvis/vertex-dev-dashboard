#!/usr/bin/env bash

set -euo pipefail

# Environment Variables 
current_worktree="$(git rev-parse --show-toplevel)"
primary_worktree="$(
  git worktree list --porcelain | awk '/^worktree / { print substr($0, 10); exit }'
)"

# Functions 
copy_local_path() {
  local relative_path="$1"
  local source="$primary_worktree/$relative_path"
  local destination="$current_worktree/$relative_path"

  if [[ ! -e "$source" && ! -L "$source" ]]; then
    return
  fi

  if [[ -d "$source" && ! -L "$source" ]]; then
    mkdir -p "$destination"
    cp -R "$source"/. "$destination"/
  else
    mkdir -p "$(dirname "$destination")"
    cp -p "$source" "$destination"
  fi
}

copy_local_entry() {
  local entry="$1"

  case "$entry" in
    /* | .. | ../* | */.. | */../*)
      echo "Skipping unsafe local worktree file entry: $entry" >&2
      return
      ;;
  esac

  case "$entry" in
    *'*'* | *'?'* | *'['*)
      while IFS= read -r match; do
        [[ -n "$match" ]] && copy_local_path "$match"
      done < <(
        cd "$primary_worktree"
        compgen -G "$entry" || true
      )
      ;;
    *)
      copy_local_path "$entry"
      ;;
  esac
}

# Copies local only files from primary worktree into this worktree
# 
# To Use:
#  Create local-dev-files.txt in the primary worktree and list
#  repo-relative files or glob patterns, one per line.
# 
#   Blank lines and comments are ignored.
copy_local_dev_files() {
  if [[ -n "$primary_worktree" && "$primary_worktree" != "$current_worktree" ]]; then
    local_file_list="$primary_worktree/local-dev-files.txt"

    if [[ -f "$local_file_list" ]]; then
      while IFS= read -r entry || [[ -n "$entry" ]]; do
        entry="$(
          printf '%s' "$entry" \
            | sed -e 's/[[:space:]]*#.*$//' \
                  -e 's/^[[:space:]]*//' \
                  -e 's/[[:space:]]*$//'
        )"
        [[ -n "$entry" ]] && copy_local_entry "$entry"
      done < "$local_file_list"
    fi
  fi
}

# Runs a worktree script if it is present, executed from the worktree root.
#
# Local-only hook scripts (e.g. pre-project-init.sh, post-project-init.sh) are
# gitignored and therefore only live in the primary worktree. When a script is
# missing from the current worktree but present in the primary, it is copied
# across before running. Committed scripts (e.g. scripts/setup.sh) already exist
# in the worktree and are run as-is.
#
# NOTE: scripts run from the current worktree root - BE CAREFUL WITH PATHS!
run_worktree_script() {
  local relative_path="$1"
  local target_script="$current_worktree/$relative_path"

  # Pull local-only scripts in from the primary worktree if we don't have them.
  if [[ ! -f "$target_script" \
        && -n "$primary_worktree" \
        && "$primary_worktree" != "$current_worktree" ]]; then
    copy_local_path "$relative_path"
  fi

  if [[ -f "$target_script" ]]; then
    echo "Running $relative_path"
    (
      cd "$current_worktree"
      bash "$relative_path"
    )
  else
    echo "No $relative_path found - skipping."
  fi
}

## Pre-Project Init
copy_local_dev_files
run_worktree_script "pre-project-init.sh"

## Project Setup
run_worktree_script "scripts/setup.sh"

## Post-Project Init
run_worktree_script "post-project-init.sh"
