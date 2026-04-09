# Dynamic AQS Pulse Platform

Production engineering monorepo for the Dynamic AQS Pulse platform.

This repo is intentionally separate from the legacy discovery/prototype repo so we can:
- keep stakeholder prototype history intact
- build a clean production foundation
- evolve backend, web, and mobile in one coordinated workspace

## Monorepo Layout

```txt
apps/
  api/        Node.js modular monolith backend
  crm-web/    Next.js CRM web app
  mobile/     React Native / Expo mobile app

packages/
  contracts/  shared API contracts and DTOs
  db/         Prisma schema, migrations, and data access helpers
  config/     shared config, env validation, lint/ts settings
  ui/         shared UI primitives if we choose to extract them
  auth/       shared auth and RBAC utilities
  acumatica/  shared Acumatica client and integration adapters
  testing/    shared test helpers and fixtures

infra/
  env/        environment templates and ops notes
  ci/         CI/CD and deployment support assets
```

## Principles

- PostgreSQL is the core system of record.
- One shared relational core, commercial-safe from day one.
- Additive schema evolution only.
- Keep the prototype UI value, but rewire data/auth plumbing behind real adapters.
- Backend foundation and contracts come before ERP-connected business behavior.

## Current Status

This repo now has the first production foundation in place:
- monorepo workspace and package boundaries
- shared auth/contracts foundation
- Prisma/PostgreSQL core schema package
- Node API skeleton with database-aware health endpoints
- persistent `pg-boss` queue/worker foundation
- Acumatica client/error normalization scaffold
- migration run, raw snapshot, and staging foundation for legacy import rehearsal
- raw-to-canonical migration normalization path
- authenticated account/contact/location core API slice
- reference data seed and admin API foundation
- delivery progress tracker for execution visibility

## Quick Start

```bash
pnpm install
pnpm build
createdb pulse_platform_dev
PORT=4000 \
DATABASE_URL=postgresql://$USER@localhost:5432/pulse_platform_dev \
PG_BOSS_CONNECTION_STRING=postgresql://$USER@localhost:5432/pulse_platform_dev \
ACUMATICA_BASE_URL=https://example.acumatica.local \
pnpm --filter @pulse/api start
```

For local bootstrapping, copy `.env.example` into your preferred env file and replace placeholder values as real infrastructure becomes available.

Useful endpoints once the API is running:
- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`
- `GET /api/v1/health/db`
- `GET /api/v1/health/queue`
- `POST /api/v1/jobs/health-check`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET /api/v1/accounts`
- `POST /api/v1/accounts`
- `GET /api/v1/accounts/:id`
- `GET /api/v1/accounts/:id/locations`
- `POST /api/v1/accounts/:id/locations`
- `GET /api/v1/accounts/:id/contacts`
- `POST /api/v1/accounts/:id/contacts`
- `GET /api/v1/reference/business-segments`
- `PATCH /api/v1/reference/business-segments/:id`
- `GET /api/v1/reference/lead-sources`
- `POST /api/v1/reference/lead-sources`
- `PATCH /api/v1/reference/lead-sources/:id`

Business endpoints use bearer-token auth and shared request authorization helpers so new modules can reuse the same session/RBAC path instead of re-implementing token parsing per route.

Migration endpoints are available for rehearsal and import foundation work, but they are intentionally gated behind `MIGRATION_ADMIN_TOKEN` until the real auth/RBAC layer is in place.

Current migration flow:
- create a migration run with `POST /api/v1/migrations/runs`
- capture immutable per-run source evidence with `POST /api/v1/migrations/runs/:id/snapshots`
- normalize captured source evidence into canonical payloads with `POST /api/v1/migrations/runs/:id/normalize`
- stage captured records with `POST /api/v1/migrations/runs/:id/stage`
- inspect pipeline state with `GET /api/v1/migrations/runs/:id`

Capture is intentionally raw-only. Normalization is the step that writes canonical `normalizedPayload` for account, contact, and location records, which keeps source evidence separate from governed CRM tables and lets us absorb field clarification without corrupting operational data.

Reference data bootstrapping seeds the baseline business segments and lead sources on startup if they do not already exist. The lead stage/status model is intentionally not hardcoded yet, because that should come from the approved 7-stage seed assets rather than from guessed lifecycle logic.

The existing `dynamic-aqs-crm` repo remains the:
- discovery repo
- roadmap repo
- prototype repo
- stakeholder reference baseline

Execution tracking lives in [docs/DELIVERY_PROGRESS_TRACKER.md](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/DELIVERY_PROGRESS_TRACKER.md).
