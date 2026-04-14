# Lead Import Duplicate Review Implementation

Date: 2026-04-15

## What Landed

The lead import workstation now supports a governed duplicate-review lane after column mapping and before commit.

Implemented paths:
- `POST /api/v1/leads/import/review`
- `/leads/import` review UI for duplicate and invalid rows
- row-level duplicate decisions during import:
  - `create_new`
  - `use_existing`

## What The Review Lane Does

For each mapped row, Pulse now:
- normalizes the row against the governed lead-import rules
- flags invalid rows explicitly
- checks for potential duplicates across:
  - active in-flight leads
  - existing customer accounts
- returns candidate matches to the UI before import commit

This keeps bulk import closer to the demo expectation:
- users can upload CSV/XLSX
- map columns to Pulse target fields
- review duplicate risk before commit

## Current Boundary

This slice intentionally stops short of full merge/update semantics.

What is live:
- preview
- header mapping
- duplicate review
- explicit decision per duplicate row
- import commit with decision enforcement

What is still pending:
- true merge/update into an existing lead or account
- saved mapping templates
- duplicate review for manual-intake flows
- broader cross-entity dedupe kernel shared by all intake paths

## Regression Coverage

Added:
- `apps/api/test/leads.import.regression.test.mjs`

Covered paths:
- duplicate review across leads and accounts
- duplicate-decision requirement before commit
- honoring `use_existing` and `create_new`

## Why This Matters

The approved demo expectation was that import should work even when the source format varies, as long as the operator can map source columns to Pulse fields. This slice makes that flow materially safer for production use by inserting an auditable review lane instead of committing blindly after mapping.
