#!/usr/bin/env bash

set -euo pipefail

yarn install --frozen-lockfile
yarn playwright install chromium
