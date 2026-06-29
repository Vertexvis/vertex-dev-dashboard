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

# Runs local dev script in this worktree if it exists in the primary worktree
# To Use:
#  Create local-dev.sh in the primary worktree
# NOTE: local-dev.sh is copied into worktree and executed from there - BE CAREFUL WITH PATHS!
run_local_dev_commands() {
  if [[ -n "$primary_worktree" && "$primary_worktree" != "$current_worktree" ]]; then
    local relative_path="local-dev.sh"
    local source_script="$primary_worktree/$relative_path"
    local target_script="$current_worktree/$relative_path"

    if [[ -f "$source_script" ]]; then
      copy_local_path "$relative_path"

      (
        cd "$current_worktree"
        bash "$target_script"
      )
    fi
  fi
}

# Runs template setup script in this worktree if it exists
setup() {
  if [[ -f "$current_worktree/scripts/setup.sh" ]]; then
      (
        cd "$current_worktree"
        bash scripts/setup.sh
      )
    else
      echo "No setup.sh script found in $current_worktree/scripts"
  fi
}

# Worktree Setup
setup

## Local Dev Setup
copy_local_dev_files
run_local_dev_commands
