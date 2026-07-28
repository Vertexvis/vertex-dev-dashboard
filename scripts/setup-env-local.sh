#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
env_file="$repo_root/.env.local"
env_template="$repo_root/.env.local.template"

if [[ ! -f "$env_file" ]]; then
  cp "$env_template" "$env_file"
fi

if ! grep -Eq '^COOKIE_SECRET=.{32,}$' "$env_file"; then
  cookie_secret="$(openssl rand -hex 32)"

  if grep -q '^COOKIE_SECRET=' "$env_file"; then
    sed -i.bak "s|^COOKIE_SECRET=.*|COOKIE_SECRET=$cookie_secret|" "$env_file"
    rm "$env_file.bak"
  else
    printf '\nCOOKIE_SECRET=%s\n' "$cookie_secret" >> "$env_file"
  fi
fi
