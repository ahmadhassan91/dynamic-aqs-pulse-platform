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
- Node API skeleton with health endpoints
- queue/worker scaffold
- Acumatica client/error normalization scaffold

## Quick Start

```bash
pnpm install
pnpm build
PORT=4000 \
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pulse \
ACUMATICA_BASE_URL=https://example.acumatica.local \
pnpm --filter @pulse/api start
```

For local bootstrapping, copy `.env.example` into your preferred env file and replace placeholder values as real infrastructure becomes available.

The existing `dynamic-aqs-crm` repo remains the:
- discovery repo
- roadmap repo
- prototype repo
- stakeholder reference baseline
