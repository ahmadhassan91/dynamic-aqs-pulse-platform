# Training D0.3: Proof Transport + Reporting Depth

**Date:** 2026-04-18  
**Repo:** `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform`  
**Branch:** `codex/entra-calendar-governance`

## Scope

This slice extends the existing training operations and reporting foundation with the next CRM-owned capabilities that do not depend on Outlook, Graph, or external training-site contracts.

Delivered:

- dedicated recertification queue endpoint with expiry-window filtering
- TM/RD coaching workload read model
- territory training-penetration rollups inside the existing territory command center
- real proof-file byte transport for training session execution
- shared Pulse local document-storage foundation for proof uploads

## What Is Now Live

### Recertification queue

New backend read model:

- `GET /api/v1/training/recertification`

The queue returns:

- certifications expiring within a requested window
- account context
- owner context
- days-until-expiry ordering

The same scope rules used elsewhere continue to apply:

- TMs see only their records
- RDs see only their records
- broader training/admin actors can filter by owner

### Coaching workload

New backend read model:

- `GET /api/v1/training/coaching`

This provides a role-aware view of:

- upcoming sessions
- open follow-up tasks
- overdue certifications
- workload counts for the current TM or RD

The approved prototype shell stays intact, but the `Exceptions & Recertification` tab now carries real coaching context instead of only exception queues.

### Territory training penetration

The territory dashboard now includes training-specific rollups derived from current CRM truth:

- total accounts
- trained accounts
- active programs
- penetration percent

These rollups are exposed through the existing territory dashboard response and rendered in the command-center UI without introducing a separate territory-reporting stack.

### Proof transport

Training proof is no longer metadata-only.

New backend mutation:

- `POST /api/v1/training/sessions/:sessionId/proof`

This now stores:

- file name
- mime type
- sha256
- storage key
- uploader
- document type

The session execution modal now uploads proof files directly into Pulse during completion, and completed sessions carry proof-document summaries instead of only attachment counts.

## Storage Boundary

This slice deliberately introduces a shared Pulse-owned storage helper instead of a provider-specific blob contract.

Current state:

- real byte flow exists in development and test
- metadata is persisted in the database
- files are stored under the Pulse app storage root

This is a production-safer step than leaving proof as metadata-only, but it is still intentionally a local/shared storage foundation, not yet:

- S3-backed object storage
- provider-signed upload URLs
- external document-service integration

That provider-backed storage step remains parked until the broader document-handling/storage boundary is finalized.

## Files Changed

- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/config/src/env.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/contracts/src/training.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/contracts/src/territories.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/db/prisma/schema.prisma`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/db/prisma/migrations/20260418190000_training_proof_reporting_depth/migration.sql`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/documents/storage.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/training/service.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/training/http.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/territories/service.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/training.recertification.regression.test.mjs`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/training.penetration.regression.test.mjs`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/training.proof-upload.regression.test.mjs`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/territories.regression.test.mjs`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/lib/pulse-api.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/training/TrainingWorkspace.tsx`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/training/TrainingSessionExecutionModal.tsx`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/territories/TerritoryCommandDashboard.tsx`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/territories/TerritoryManagement.tsx`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/DELIVERY_PROGRESS_TRACKER.md`

## Regression Coverage Added

New focused suites:

- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/training.recertification.regression.test.mjs`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/training.penetration.regression.test.mjs`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/training.proof-upload.regression.test.mjs`

Extended suite:

- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/territories.regression.test.mjs`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/training.regression.test.mjs`

Critical paths covered:

- recertification queue ordering and scoping
- territory training-penetration rollups
- proof upload byte persistence and metadata capture
- training session summaries carrying proof documents
- territory dashboard reflecting training penetration

## Verification

Relevant commands for this slice:

- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/config build`
- `pnpm --filter @pulse/db build`
- `pnpm --filter @pulse/api build`
- `node --test --test-concurrency=1 apps/api/test/training.recertification.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/training.penetration.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/training.proof-upload.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/territories.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/training.regression.test.mjs`
- `pnpm --filter @pulse/api test`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web build`
- `pnpm --filter @pulse/crm-web test:e2e`

## Open / Parked

Still intentionally out of scope here:

- Outlook/provider-backed training calendar reconciliation
- external training-site coexistence rules
- provider-backed object/blob storage for training proof
- printable certification artifacts
- richer home/calendar coaching cards outside the training workspace
- renewal lifecycle semantics beyond the current expiry/queue model

## Best Next Training Slice

If provider prerequisites are still parked:

- `Training D0.4: coaching surface depth + leadership exports`

If provider prerequisites are available:

- `Training D1: Outlook Sync + External Coexistence`
