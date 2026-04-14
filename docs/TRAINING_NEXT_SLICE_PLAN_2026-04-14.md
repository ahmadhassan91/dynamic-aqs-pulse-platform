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

`Training Slice A: Catalog + Programs + Account History Shell` is now implemented in the production repo.

Live baseline:

- seeded training catalog with governed categories, types, templates, and cadence policies
- certification seeds for `IAQ Certification Curriculum` and `Product Installations`
- account-centric training programs with TM/RD ownership carry-forward
- overdue detection and account training history reads
- prototype-aligned `/training` workspace plus customer-detail `Training` tab
- dedicated module regression suite

## Recommended Next Slice

Build `Training Slice B: Scheduling + Session Execution`

This is the highest-value next slice now because Slice A already gives us the stable catalog, cadence, and account-history foundation we needed before taking on scheduling, session outcomes, and mobile-ready execution flows.

## Slice B Scope

### Backend

- `TrainingSession`
- `TrainingSessionAttendee`
- `TrainingSessionOutcome`
- `TrainingSessionNote`
- `TrainingFollowUpTask`
- `TrainingTrainerProfile` expansion for real trainer assignment
- account-scoped session-history read model
- mobile-ready session status API surface

### Web

Use the same approved prototype shell and existing training/territory patterns.

Ship:

- training session create/update flow
- trainer assignment workflow
- account-level session timeline
- basic calendar/list views inside Pulse
- follow-up task visibility from the account training record

### Regression coverage

Add a dedicated module suite for:

- session scheduling and rescheduling
- trainer assignment permissions
- attendee/status transitions
- site-visit versus formal-training session behavior
- follow-up task generation
- parked dependency boundary behavior when Outlook/provider sync is not connected

## Explicitly Out Of Scope For Slice B

- live Outlook sync
- Teams/WebEx meeting creation
- certification-site import
- mobile check-in/check-out execution
- proof photo upload
- certificate generation
- contest ROI attribution

## Slice C After That

`Training Slice C: Mobile Execution + Certification`

- mobile check-in/check-out
- required checkout notes
- voice note payload support
- proof capture
- certification lifecycle
- overdue widget / exception reporting

## Slice D After That

`Training Slice D: Outlook Sync + External Coexistence`

- Microsoft Graph / Outlook reflection
- provider-specific meeting-link synchronization
- external training-site coexistence or sync boundary
- certification-site import decisions

## What We Still Need Later

- Microsoft Graph / Outlook prerequisites
- external training-site future-state decision
- deeper technician participant rules
- commercial county/overlay territory logic when commercial activates
