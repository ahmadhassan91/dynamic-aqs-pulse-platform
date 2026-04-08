# @pulse/db

Prisma/PostgreSQL foundation for the Pulse platform.

This package owns:
- Prisma schema
- migrations
- seed strategy
- generated DB client access
- shared data-access patterns

## Core Principles

- PostgreSQL is the system of record.
- Schema changes must be additive first.
- Governed business data stays relational and explicit.
- JSONB is for low-risk variable metadata only.
- Commercial-safe extension tables are preferred over core schema drift.

## Flexibility Strategy

- Core entities keep governed fields as first-class relational columns.
- Unknown legacy payloads are captured in `SourceRecordSnapshot` so we can import first and normalize later.
- Migration runs and per-record outcomes are tracked in `MigrationRun` and `MigrationRunRecord` for rehearsal, reconciliation, and rollback evidence.
- Low-risk optional legacy attributes live in one-to-one extension tables such as `AccountExtension`, `AccountLocationExtension`, and `ContactExtension`.
- When a field becomes governed, we promote it from extension JSON into an explicit column using expand/backfill/switch/contract.

## Next Steps

- connect `DATABASE_URL`
- run `pnpm --filter @pulse/db generate`
- add seed scripts and migration workflow
- wire the package into the backend app once the backend package exists
