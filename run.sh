#!/usr/bin/env bash
# Run ImpossibleAram locally with one command (D50): installs dependencies only when needed,
# starts the dev server (including the feedback API) and opens the browser.
#   ./run.sh
set -euo pipefail
cd "$(dirname "$0")/app"
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Installing dependencies..."
  npm install --no-audit --no-fund
  touch node_modules/.package-lock.json
fi
exec npm run dev -- --open
