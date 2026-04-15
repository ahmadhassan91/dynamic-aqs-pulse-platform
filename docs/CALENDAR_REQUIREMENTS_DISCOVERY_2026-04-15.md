# Calendar Requirements Discovery

Date: 2026-04-15

## Why This Discovery Exists

The approved prototype already showed a centralized Pulse calendar, but the prototype was mock-driven and mixed together real operational need with provider promises that were not yet implemented.

This note captures the meeting-backed requirements we should treat as the current baseline for the production calendar module.

## Discovery Summary

The meeting evidence is consistent on the core need:

1. Pulse needs a centralized operating calendar.
2. That calendar should give internal users one place to see discovery calls, training, visits, and later audits.
3. Pulse should own the workflow truth for scheduling activity.
4. Outlook should be treated as a later sync/reflection layer, not the initial system of record.
5. The first production slice should be provider-free, but still fully real and backend-wired.

## Prototype Signals Confirmed

The prototype route and component structure showed the right product direction:

- `/calendar`
- month / week / list style calendar behavior
- filters across activity types
- centralized visibility instead of forcing users to jump between modules

What was not acceptable to carry forward from the prototype:

- fake calendar events
- mock stores
- fake Outlook-linked actions
- detached generic scheduling UI not tied to governed workflows

## Meeting-Backed Requirements

### Centralized visibility is a real business need

Meeting evidence consistently says Dynamic AQS wants one place where leadership and operations can see what is happening this day, week, month, and historically.

Key themes from meetings:

- no unified calendar today
- blind spots on trainer schedules
- double-entry pain between CRM and Outlook
- need for weekly visibility, not just a generic full calendar
- need to see upcoming training, discovery, and visits in one place

## Required event families for the centralized calendar

The current evidence supports these event families as first-class calendar categories:

- `discovery_call`
- `virtual_training`
- `account_training`
- `on_site_visit`
- `consignment_audit`

The prototype also signaled these categories, and the later meetings reinforced that this shared calendar needs to show both training and visit-style operational work.

## Current source-of-truth ownership

The safest production interpretation is:

- Lead module owns discovery scheduling truth.
- Training module owns training/session scheduling truth.
- Territory and later field modules can contribute visit/audit events as those slices harden.
- Calendar is a central read model and operations view over those source workflows.

This means Slice A should not invent a separate generic scheduling engine before the source modules are ready.

## Required views

The current baseline should include:

- `month`
- `week`
- `list`

The meetings especially emphasized weekly operational visibility. Month and list are still important because the prototype, training needs, and later mobile expectations all point in that direction.

## Scheduling and provider interpretation

There is strong meeting evidence that users want Outlook integration and invite behavior, including:

- create in Pulse
- reflect to Outlook
- later possibly pull from Outlook too

But for the production dependency boundary, the correct interpretation is:

- Slice A: Pulse-owned centralized calendar read model over real CRM workflows
- Later provider slice: Outlook / Microsoft Graph sync and invite reflection

This keeps the first slice honest and avoids fake provider behavior.

## Production decisions locked from this discovery

These decisions should now be treated as the current implementation baseline:

1. Calendar is a real Pulse module, not just a training sub-screen.
2. Calendar is a centralized operations view across modules.
3. Pulse owns the workflow truth first.
4. Provider sync comes later.
5. Source modules remain the place where scheduling/editing logic lives in the first slice.
6. The centralized calendar should stay prototype-aligned in route structure and visual rhythm.

## What is intentionally not claimed yet

The following are still real future slices, not done in the first calendar implementation:

- Outlook / Graph sync
- Teams / WebEx invite generation
- provider conflict management
- generic create-anything calendar modal
- bidirectional calendar reconciliation
- consignment-audit live feed

## Source Notes

Primary meeting signals came from:

- `Discovery Session 1 - 16th Feb 2026`
- `24 Feb 2026 Discovery session 4`
- `13th March Discovery Session 9`
- `Dan Meeting - Introductory Discovery Meeting`

Primary PRD signals came from:

- `TRAINING_MANAGEMENT_PRD.md`
- `MOBILE_APP_PRD.md`
- `IMPLEMENTATION_REQUIREMENTS_AUDIT_2026-03-14.md`
