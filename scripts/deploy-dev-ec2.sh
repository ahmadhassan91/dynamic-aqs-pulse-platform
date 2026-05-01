#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/pulse"
RELEASE_SHA="${GITHUB_SHA:-manual-$(date +%Y%m%d%H%M%S)}"
RELEASE_DIR="${APP_ROOT}/releases/${RELEASE_SHA}"

if [[ ! -d "${RELEASE_DIR}" ]]; then
  echo "Release directory not found: ${RELEASE_DIR}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source /etc/pulse/pulse.env
set +a

cd "${RELEASE_DIR}"

corepack enable
corepack prepare pnpm@10.7.0 --activate

pnpm install --frozen-lockfile
find packages apps -name 'tsconfig.tsbuildinfo' -delete
pnpm --filter @pulse/contracts build
pnpm --filter @pulse/config build
pnpm --filter @pulse/auth build
pnpm --filter @pulse/acumatica build
pnpm --filter @pulse/db generate
pnpm --filter @pulse/db build
pnpm --filter @pulse/api build
pnpm --filter @pulse/crm-web build

pnpm --filter @pulse/db migrate:deploy

ln -sfn "${RELEASE_DIR}" "${APP_ROOT}/current"

sudo systemctl daemon-reload
sudo systemctl restart pulse-api
sudo systemctl restart pulse-web
sudo systemctl reload nginx

sudo systemctl --no-pager --full status pulse-api | sed -n '1,18p'
sudo systemctl --no-pager --full status pulse-web | sed -n '1,18p'
