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

## Next Steps

- connect `DATABASE_URL`
- run `pnpm --filter @pulse/db generate`
- add seed scripts and migration workflow
- wire the package into the backend app once the backend package exists

