# Training Slice C Implementation

**Date:** 2026-04-14  
**Scope:** Mobile-ready execution, certification outcomes, proof metadata, and training exception visibility

## What We Shipped

Training Slice C is now live in the production repo.

Implemented:

- explicit session check-in flow
- required checkout notes for completion
- proof metadata capture hooks (`proofNotes`, `proofAttachmentCount`, `proofCapturedAt`)
- certification outcomes on training sessions
- certification record issuance for awarded certification-track sessions
- account-level certification history visibility
- training execution exception read models
- prototype-aligned execution and certification visibility in `/training`
- customer-detail training history now showing certifications and open execution exceptions

## Decisions Locked

These are now implementation decisions unless source-of-truth changes later:

1. `check-in` and `completion` belong to the same session model rather than a separate mobile-only workflow.
2. Checkout notes are required whenever a session is completed.
3. Certification decisions live on the completed session and only issue a certification record when the outcome is `awarded`.
4. `Site visit` activity kinds cannot award certifications even if the training type is certification-capable.
5. Execution exceptions are first-class operational read models, not ad hoc UI warnings.
6. Proof metadata is stored as workflow-safe metadata only; provider/file transport still comes later.

## Backend Coverage

Backend now supports:

- `POST /api/v1/training/sessions/:sessionId/check-in`
- richer `POST /api/v1/training/sessions/:sessionId/complete`
- certification issuance via `TrainingCertificationRecord`
- session execution-state summaries
- execution exception summaries on training session/account reads

Schema additions:

- `TrainingCertificationRecord`
- `TrainingSession.checkedInAt`
- `TrainingSession.checkedOutAt`
- `TrainingSession.checkoutNotes`
- `TrainingSession.proofNotes`
- `TrainingSession.proofAttachmentCount`
- `TrainingSession.proofCapturedAt`
- `TrainingSession.certificationOutcome`

Migration:

- `20260414085325_training_mobile_execution_certification_slice_c`

## Frontend Coverage

Prototype-aligned routes/components now support:

- `/training` session filters for `checked_in` and `exceptions`
- execution exception review from the main training workspace
- session execution modal with:
  - check-in
  - completion with required checkout notes
  - certification outcome capture
  - proof metadata capture
- customer-detail certification history and execution exception review

## Regression Coverage

Training regression suite now covers:

- idempotent session check-in
- checked-in session filtering
- required checkout notes
- certification award issuance
- proof metadata persistence
- pending certification decision exceptions
- site-visit rejection for certification awards

## What Is Still Parked

These are intentionally not part of Slice C:

- Outlook / Microsoft Graph sync
- Teams / WebEx meeting creation
- file-provider / real proof upload transport
- external training-site coexistence implementation
- certification-site import

## Recommended Next Slice

`Training Slice D: Outlook Sync + External Coexistence`

That slice should only start once Outlook/provider prerequisites are available. If those prerequisites are still parked, the next active delivery slice should move back to the downstream dealer path rather than forcing provider-bound training work early.
