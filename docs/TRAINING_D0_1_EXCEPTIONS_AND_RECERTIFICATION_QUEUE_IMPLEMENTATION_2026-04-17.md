# Training D0.1: Exceptions + Recertification Queue

## What Landed

This slice adds the first centralized training-ops read model without waiting on Outlook, Teams/WebEx, or the external training site.

Live now:

- expiring certification queue
- expired certification queue
- overdue training cadence queue
- unresolved execution exception queue
- TM / RD owner filters where the current schema supports them
- TM / RD actor scoping for the same queue
- prototype-aligned `Exceptions & Recertification` tab inside `/training`

## Files Changed

- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/contracts/src/training.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/training/service.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/training/http.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/training.regression.test.mjs`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/training/TrainingWorkspace.tsx`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/TRAINING_NEXT_SLICE_PLAN_2026-04-14.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/DELIVERY_PROGRESS_TRACKER.md`

## Backend Notes

The new queue lives behind `GET /api/v1/training/ops`.

It is intentionally read-model-first:

- no certification revoke / renew mutation yet
- no external provider sync
- no calendar/provider dependency
- no schema migration required

The queue is built from current account, program, session, and certification truth already in the schema.

Actor behavior:

- `TERRITORY_MANAGER` is automatically scoped to their own TM-owned records
- `REGIONAL_DIRECTOR` is automatically scoped to their own RD-owned records
- broader training/admin actors can apply optional `ownerTmUserId` and `ownerRdUserId` filters

## Frontend Notes

`/training` now has an `Exceptions & Recertification` tab with:

- TM filter
- RD filter
- expiry-window filter
- four operational tables backed by the new queue endpoint

The tab is intentionally practical instead of decorative. It is meant to help training ops, TMs, and RDs work the queue quickly.

## Regression Coverage Added

Expanded suite:

- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/training.regression.test.mjs`

New critical paths:

- centralized queue surfaces expiring certifications
- centralized queue surfaces expired certifications
- centralized queue surfaces overdue cadence items
- centralized queue surfaces unresolved execution exceptions
- TM actor scope is enforced
- RD actor scope is enforced
- training-ops owner filters work on the same queue

## Still Open

This slice does **not** close the whole training module yet.

Still open:

- certification revocation / renewal operations
- recertification actions beyond visibility
- richer TM / RD coaching rollups
- reporting / export views
- proof file transport and storage
- Outlook/provider sync and reconciliation
- external training-site coexistence decisions

## Recommended Next Training Slice

Best next non-provider slice:

- `Training D0.2: certification operations + reporting`

Best next provider-bound slice when prerequisites are ready:

- `Training D1: Outlook sync + external coexistence`
