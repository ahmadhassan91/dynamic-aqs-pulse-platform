# Lead Import Governance Implementation

Date: 2026-04-15

## Scope

This slice hardened the production lead import path beyond simple column mapping.

The implementation now supports:
- persisted import review runs
- duplicate-aware review across existing leads and accounts
- within-file duplicate detection
- explicit row decisions before commit
- idempotent run commit behavior
- skipped-row visibility in final results

## What Changed

### Backend

- Added `LeadImportRun` and `LeadImportRunRow` persistence to track review and commit state
- Added import-run status and row-status enums to the schema
- Added a durable `review -> fetch run -> commit run` flow instead of a one-shot transient import only
- Preserved the legacy direct-import endpoint as a compatibility wrapper
- Added within-file duplicate detection so repeated rows in the same upload do not silently create duplicate leads

### Contracts

- Expanded lead import contracts to carry:
  - `runId`
  - run status
  - persisted review rows
  - skipped rows
  - explicit commit payloads
- Added `skip` as a first-class duplicate decision

### Web

- `/leads/import` now operates on a persisted review run
- users can map source columns to Pulse fields, review duplicates, choose `create new`, `use existing`, or `skip`, and then commit the run
- the completed step now surfaces skipped rows instead of hiding them

## Production Guardrails Added

- unresolved duplicate rows are no longer allowed to drift through the governed commit path
- repeated commits on the same run are idempotent
- within-file duplicate rows are visible before import, not discovered after pollution
- payloads stored for import governance now use bounded JSON guardrails

## Regression Coverage

Verified in:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/leads.import.regression.test.mjs`

Coverage includes:
- duplicate review against existing leads and accounts
- required duplicate decisions before commit
- `use_existing` and `create_new` behaviors
- within-file duplicate detection
- skip decisions
- persisted run fetch and idempotent re-commit behavior

## Remaining Next Depth

This slice intentionally does not yet include:
- merge/update semantics for customer/account matches
- saved mapping templates
- broader shared dedupe across manual intake and later customer maintenance

Those remain later governance slices after sign-off on cross-entity duplicate rules.
