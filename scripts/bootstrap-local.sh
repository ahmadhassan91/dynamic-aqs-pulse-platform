#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

node "$ROOT_DIR/scripts/run-with-env.mjs" pnpm --filter @pulse/db generate
# Local startup should reconcile checked-in migrations, not prompt for schema-authoring resets.
node "$ROOT_DIR/scripts/run-with-env.mjs" node "$ROOT_DIR/scripts/repair-local-dev-migrations.mjs"
node "$ROOT_DIR/scripts/run-with-env.mjs" pnpm --filter @pulse/db migrate:deploy
node "$ROOT_DIR/scripts/run-with-env.mjs" pnpm --filter @pulse/contracts build
node "$ROOT_DIR/scripts/run-with-env.mjs" pnpm --filter @pulse/db build
node "$ROOT_DIR/scripts/run-with-env.mjs" pnpm --filter @pulse/api build
