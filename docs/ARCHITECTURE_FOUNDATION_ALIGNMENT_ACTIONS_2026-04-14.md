# Architecture Foundation Alignment Actions

**Date:** 2026-04-14  
**Source:** team review note for architecture/foundation alignment

## Overall Response

The feedback is directionally right.

The platform foundation is strong, but a few calls should be made deliberately now so the repo stays clean as more modules land.

## Decisions To Lock

### 1. Auth/session transport

We should lock one deliberate web auth transport model and reconcile docs plus implementation around it.

Working decision:

- keep the current auth/session domain model
- keep the current alpha implementation for now
- plan a stricter BFF / httpOnly-cookie web transport before broader production rollout

This is a **planned hardening change**, not a reason to rewrite the auth core.

### 2. API boundary standard

We should standardize request parsing and validation before every module evolves its own handler style.

Working decision:

- keep route handlers thin
- use one consistent parsing/validation/error pattern per module
- avoid route-heavy regex sprawl becoming the de facto standard

### 3. Lead service decomposition

The `leads` boundary is still correct, but internal service size is already a real maintenance risk.

Working decision:

- keep `leads` as one module boundary
- split internals by domain area:
  - intake
  - workflow
  - lifecycle
  - duplicate review
  - readiness / conversion

### 4. Doc authority discipline

The roadmap only helps if code and docs stay reconciled.

Working decision:

- any intentional implementation divergence from the roadmap must be documented in-repo in the same slice
- major module decisions should leave a short implementation note, not only chat history

### 5. Test/bootstrap harness

Module regression direction is strong, but the repo still needs a cleaner and more predictable startup/test harness as coverage grows.

Working decision:

- keep module-level suites as the standard
- continue improving deterministic seeding and reset behavior
- avoid ad hoc one-off test setup per module

## Follow-up Slice Recommendation

Build a short foundation-alignment slice after the current domain slice pressure settles:

1. Auth/session transport decision note and implementation boundary cleanup
2. API handler standardization helpers
3. Lead service decomposition
4. Regression harness cleanup
5. Doc reconciliation pass for active modules

## What Is Not A Current Concern

These are not foundation blockers right now:

- missing CI/CD polish
- missing observability stack
- incomplete mobile implementation
- incomplete deployment packaging
- non-final security hardening

Those matter later, but they are not the wrong things to optimize before module architecture stays clean.
