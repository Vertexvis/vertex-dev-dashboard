#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
current_worktree="$(git -C "$script_dir/.." rev-parse --show-toplevel)"

cd "$current_worktree"
git submodule update --init --recursive

primary_worktree="$(
  git worktree list --porcelain | awk '/^worktree / { print substr($0, 10); exit }'
)"

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

# Copy selected uncommitted local files from the primary worktree into this
# worktree. Create local-dev-files.txt in the primary worktree and list
# repo-relative files or glob patterns, one per line. Blank lines and comments
# are ignored.
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

yarn install
