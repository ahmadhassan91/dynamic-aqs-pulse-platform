#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${PORT:-4000}"
WEB_PORT="${WEB_PORT:-3000}"

"$ROOT_DIR/scripts/bootstrap-local.sh"

require_port_free() {
  local port="$1"

  if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use. Stop the existing process or choose a different port before running start:local."
    exit 1
  fi
}

require_port_free "$API_PORT"
require_port_free "$WEB_PORT"

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then
    kill "$API_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "${WEB_PID:-}" ]]; then
    kill "$WEB_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

node "$ROOT_DIR/scripts/run-with-env.mjs" pnpm --filter @pulse/api start &
API_PID=$!

node "$ROOT_DIR/scripts/run-with-env.mjs" pnpm --filter @pulse/crm-web exec next dev --port "$WEB_PORT" &
WEB_PID=$!

wait "$API_PID" "$WEB_PID"
