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

BACKUP_DIR="${APP_ROOT}/backups"
mkdir -p "${BACKUP_DIR}"
if command -v pg_dump >/dev/null 2>&1 && [[ -n "${DATABASE_URL:-}" ]]; then
  BACKUP_FILE="${BACKUP_DIR}/${RELEASE_SHA}-pre-migrate.dump"
  echo "Creating pre-migration database backup: ${BACKUP_FILE}"
  pg_dump "${DATABASE_URL}" --format=custom --file="${BACKUP_FILE}"
  chmod 0640 "${BACKUP_FILE}"
else
  echo "Skipping pre-migration backup because pg_dump or DATABASE_URL is unavailable." >&2
fi

pnpm --filter @pulse/db migrate:deploy

ln -sfn "${RELEASE_DIR}" "${APP_ROOT}/current"

sudo systemctl daemon-reload
sudo systemctl restart pulse-api
sudo systemctl restart pulse-web
sudo systemctl reload nginx

sudo systemctl --no-pager --full status pulse-api | sed -n '1,18p'
sudo systemctl --no-pager --full status pulse-web | sed -n '1,18p'

for attempt in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT:-4000}/api/v1/health/ready" >/dev/null; then
    break
  fi
  sleep 2
  if [[ "${attempt}" == "30" ]]; then
    echo "API readiness smoke failed after restart." >&2
    exit 1
  fi
done

curl -fsS "http://127.0.0.1:${PORT:-4000}/api/v1/health/ready"
curl -fsS "http://127.0.0.1:${WEB_PORT:-3000}/" >/dev/null
auth_status="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT:-4000}/api/v1/auth/me")"
if [[ "${auth_status}" != "401" ]]; then
  echo "Expected /api/v1/auth/me to return 401 without a token, got ${auth_status}." >&2
  exit 1
fi
