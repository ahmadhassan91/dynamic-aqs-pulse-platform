# Lead Import Governance Next Slice Plan

Date: 2026-04-15

## Why This Is The Next Lead Slice

Native forms are now config-driven and backend-enforced, so the next biggest production gap inside the lead intake boundary is governed bulk import.

This is not just a nicer import modal. The meetings make it clear that Dynamic AQS expects Pulse to handle:
- CSV and XLSX intake
- per-file header mapping
- recurring roster/member-list refreshes
- trade-show and referral batches
- duplicate review and ambiguous-match handling
- import-quality visibility that can be trusted operationally

## Discovery-Backed Requirements

Locked from meetings and prototype review:
- mixed file formats (`CSV`, `XLSX`) must stay supported
- header mapping is required before write
- roster imports are recurring refreshes, not append-only one-offs
- membership/roster presence should not silently become an active lead without governance
- duplicate matching must support assisted/manual resolution
- invalid core fields must be surfaced before commit
- operator outcome summaries must clearly show created, skipped, duplicate, and failed rows

## Current Production Gaps

1. Within-file dedupe is not modeled during review, so one file can review “clean” and still collide with itself during import.
2. Review state is not persisted; there is no `runId`, stable review snapshot, or resume path.
3. Duplicate decisions only support `create_new` and `use_existing`; there is no governed update/merge path.
4. Saved mapping templates do not exist.
5. Import provenance is too thin for recurring roster reconciliation.

## Proposed Slice Breakdown

### Slice 1: Stable Import Review Run

Add persisted import runs so review and import use the same snapshot.

Deliverables:
- `LeadImportRun`
- `LeadImportRunRow`
- stable `runId`
- persisted mappings
- persisted duplicate findings
- resume/reload import review in the UI

### Slice 2: Within-File Dedupe + Outcome Reporting

Add import review that detects:
- duplicate rows inside the same upload
- duplicate rows against existing leads
- duplicate rows against existing accounts/customers

UI outcome summary should explicitly show:
- created
- linked/used existing
- skipped
- failed
- duplicate rows needing decisions

### Slice 3: Governance Decisions

Expand duplicate decisions from:
- `create_new`
- `use_existing`

to later-governed support for:
- `skip`
- `update_existing` or `merge_into_existing`

Important:
- `update_existing` and `merge_into_existing` should not be implemented until field-level governance is ratified
- this slice can still ship value with persisted review runs + within-file dedupe + `skip`

### Slice 4: Saved Mapping Templates

Add reusable templates keyed by:
- source type
- affinity group / roster source
- uploader/admin scope

This should sit on top of stable run/mapping persistence, not before it.

## Recommended Build Order

1. persisted import run + review snapshot
2. within-file dedupe and explicit skipped-row outcomes
3. `skip` decision and better provenance
4. saved mapping templates
5. only later: merge/update semantics

## What We Should Not Fake

Do not pretend we already have:
- true merge/update governance
- automated monthly roster reconciliation
- file-history analytics

Those should only be marked done once the backend run model and decision model exist.
