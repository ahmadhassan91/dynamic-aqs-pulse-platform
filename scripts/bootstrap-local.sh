#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

node "$ROOT_DIR/scripts/run-with-env.mjs" pnpm --filter @pulse/db generate
node "$ROOT_DIR/scripts/run-with-env.mjs" pnpm --filter @pulse/db migrate:dev
node "$ROOT_DIR/scripts/run-with-env.mjs" pnpm --filter @pulse/contracts build
node "$ROOT_DIR/scripts/run-with-env.mjs" pnpm --filter @pulse/db build
node "$ROOT_DIR/scripts/run-with-env.mjs" pnpm --filter @pulse/api build
