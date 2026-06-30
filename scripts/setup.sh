## Project Specific Setup
if ! command -v yarn >/dev/null 2>&1; then
  echo "Error: yarn is not installed or not on PATH." >&2
  echo "Install yarn and run scripts/setup.sh again." >&2
  exit 1
fi

yarn install
