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

## Recommended Next Slice

Build `Training Slice A: Catalog + Programs + Account History Shell`

This is the highest-value next slice because it gives us the stable foundation for later scheduling, mobile execution, and certification without taking an unnecessary dependency on Outlook/Teams/WebEx decisions.

## Slice A Scope

### Backend

- `TrainingCategory`
- `TrainingType`
- `TrainingTemplate`
- `TrainerProfile`
- `TrainingCadencePolicy`
- `AccountTrainingProgram`
- `AccountTrainingRequirement`
- `TrainingSummaryReadModel` or equivalent account-scoped query layer

### Web

Use the same approved prototype shell and existing training/territory patterns.

Ship:

- training catalog admin view
- account training history tab
- account training program summary
- overdue / due-soon indicators at account level

### Regression coverage

Add a dedicated module suite for:

- category/type/template seeding
- custom presentation allowance
- segment-aware filtering
- overdue calculation from cadence policy
- account training history reads
- site-visit vs training distinction

## Explicitly Out Of Scope For Slice A

- live Outlook sync
- Teams/WebEx meeting creation
- certification-site import
- mobile check-in/check-out execution
- proof photo upload
- certificate generation
- contest ROI attribution

## Slice B After That

`Training Slice B: Scheduling + Session Execution`

- `TrainingSession`
- `TrainingSessionAttendee`
- `TrainingSessionOutcome`
- `TrainingSessionNote`
- `TrainingFollowUpTask`
- basic calendar views in Pulse
- mobile-ready APIs for agenda and session status

## Slice C After That

`Training Slice C: Mobile Execution + Certification`

- mobile check-in/check-out
- required checkout notes
- voice note payload support
- proof capture
- certification lifecycle
- overdue widget / exception reporting

## What We Still Need Later

- Microsoft Graph / Outlook prerequisites
- external training-site future-state decision
- deeper technician participant rules
- commercial county/overlay territory logic when commercial activates
