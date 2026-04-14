# Training Slice B Implementation

**Date:** 2026-04-14  
**Scope:** Scheduling, trainer assignment, session execution, and follow-up task management

## What We Shipped

Training Slice B is now live in the production repo.

Implemented:

- governed `TrainingSession` scheduling and rescheduling
- real trainer assignment with role-based eligibility checks
- account-scoped session listing and overdue visibility
- session completion flow with notes, completion summary, and optional follow-up creation
- session cancellation / no-show flow
- standalone follow-up task creation and completion
- prototype-aligned `/training` session workspace
- customer-detail training session management under the approved shell

## Decisions Locked

These are now implementation decisions unless the source-of-truth changes later:

1. Session scheduling stays account-centric.
2. `Site visit` and `training session` remain separate activity kinds.
3. Trainer assignment is limited to active users in approved training-delivery roles.
4. Session completion can generate follow-up work at the point of completion.
5. Outlook / provider sync remains parked; Pulse remains workflow truth.
6. The same execution model should be reused later by mobile instead of creating a second workflow.

## Backend Coverage

Backend now supports:

- `GET /api/v1/training/trainers`
- `GET /api/v1/training/sessions`
- `POST /api/v1/training/accounts/:accountId/sessions`
- `POST /api/v1/training/sessions/:sessionId/reschedule`
- `POST /api/v1/training/sessions/:sessionId/complete`
- `POST /api/v1/training/sessions/:sessionId/cancel`
- `POST /api/v1/training/sessions/:sessionId/follow-up-tasks`
- `POST /api/v1/training/follow-up-tasks/:taskId/complete`

Schema additions:

- `TrainingFollowUpTask`
- `TrainingSession.completionSummary`
- trainer/follow-up relations on `User` and `Account`

Migration:

- `20260414055053_training_session_execution_slice_b`

## Frontend Coverage

Prototype-aligned routes/components now support:

- training-wide session oversight in `/training`
- account-level schedule / reschedule / complete / cancel actions
- open follow-up visibility and completion
- reuse of the approved customer training tab instead of a standalone session screen

## Regression Coverage

Training regression suite now covers:

- catalog seeding and certification tracks
- catalog permissions
- default cadence inheritance
- overdue history calculations
- training account filters
- trainer directory eligibility
- rejection of ineligible trainers
- rejection of mismatched program/account scheduling
- cadence advancement on session completion
- no-show / cancel behavior
- follow-up task creation and completion
- overdue session filtering

## What Is Still Parked

These are intentionally not part of Slice B:

- Outlook / Microsoft Graph sync
- Teams / WebEx meeting creation
- mobile check-in / check-out execution
- proof uploads
- certificate issuance workflow
- external training-site coexistence implementation

## Recommended Next Slice

`Training Slice C: Mobile Execution + Certification`

That next slice should build on this session model rather than introducing a second training execution flow.
