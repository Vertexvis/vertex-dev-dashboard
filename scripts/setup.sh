#!/usr/bin/env bash

# Sets up a worktree
set -euo pipefail

# Setup .env.local 
env_file=".env.local"

if [[ ! -f "$env_file" ]]; then
  cp .env.local.template "$env_file"
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

yarn install --frozen-lockfile
yarn playwright install chromium webkit
