# Training Next Slice Plan

## Decisions Locked On 2026-04-14

These are the decisions we should treat as the current baseline unless source-of-truth changes later:

1. Training is `account-centric`, not lead-centric.
2. Training belongs operationally with territory work and field execution.
3. Training must be `segment-aware` so commercial can be added later without redesign.
4. Pulse owns training workflow truth; Outlook reflects it later.
5. Meeting/calendar provider must stay abstract.
6. `Site visit` and `training session` are separate activity types.
7. Mobile execution is part of the module, not an afterthought.
8. Current known certification programs are:
   - `IAQ Certification Curriculum`
   - `Product Installations`
9. The older PRD wording that ties onboarding training to `credit approval` should not be treated as final implementation truth; the safer lifecycle anchor is post-conversion / customer activation.

Primary references:

- [TRAINING_MODULE_STRUCTURE_AND_COMMERCIAL_READINESS_2026-04-14.md](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/TRAINING_MODULE_STRUCTURE_AND_COMMERCIAL_READINESS_2026-04-14.md)
- [TRAINING_DISCOVERY_VALIDATION_2026-04-14.md](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/TRAINING_DISCOVERY_VALIDATION_2026-04-14.md)
- [TRAINING_SLICE_A_IMPLEMENTATION_2026-04-14.md](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/TRAINING_SLICE_A_IMPLEMENTATION_2026-04-14.md)

## Current Status

`Training Slice A: Catalog + Programs + Account History Shell`, `Training Slice B: Scheduling + Session Execution`, and `Training Slice C: Mobile Execution + Certification` are now implemented in the production repo.

Live baseline:

- seeded training catalog with governed categories, types, templates, and cadence policies
- certification seeds for `IAQ Certification Curriculum` and `Product Installations`
- account-centric training programs with TM/RD ownership carry-forward
- overdue detection and account training history reads
- real training session scheduling, rescheduling, completion, cancellation/no-show, and follow-up task flows
- mobile-ready execution flow with explicit check-in, required checkout notes, proof metadata, and certification outcomes
- account certification records plus execution exception read models
- prototype-aligned `/training` workspace plus customer-detail `Training` tab
- dedicated module regression suite covering scheduling/execution edge cases

## Recommended Next Slice

If provider prerequisites are available:

- build `Training Slice D1: Outlook Sync + External Coexistence`

If provider prerequisites are still parked:

- build `Training Slice D0: Reporting + Certification Ops`

This keeps training moving without forcing a blocked provider integration.

## Slice D1 Scope

`Training Slice D1: Outlook Sync + External Coexistence`

- Microsoft Graph / Outlook reflection
- provider-specific meeting-link synchronization
- external training-site coexistence or sync boundary
- certification-site import decisions

## Explicitly Out Of Scope For Slice D1 Until Prerequisites Arrive

- hardcoded provider selection before Dynamic AQS confirms the calendar/meeting stack
- replacing the current external training site outright
- ROI/contest attribution modeling

## Optional Provider-Free Depth Before D1

- training overdue dashboard depth
- certification expiry / recertification queue
- richer TM / RD / leadership training exception views
- deeper account/territory training reporting

## What We Still Need Later

- Microsoft Graph / Outlook prerequisites
- external training-site future-state decision
- deeper technician participant rules
- commercial county/overlay territory logic when commercial activates
