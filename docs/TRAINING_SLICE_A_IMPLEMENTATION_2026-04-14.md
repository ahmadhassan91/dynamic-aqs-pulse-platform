# Training Slice A Implementation

Date: 2026-04-14

## What Is Live

Training Slice A is now implemented in the production repo as the first real training foundation layer.

Live scope:

- seeded training catalog with governed categories, types, templates, and cadence policies
- current certification seeds:
  - `IAQ Certification Curriculum`
  - `Product Installations`
- account-centric training programs with default cadence and TM/RD ownership carry-forward
- account training history with overdue detection
- site visit versus formal training distinction in the data model and read models
- prototype-aligned `/training` route in `crm-web`
- customer detail `Training` tab under the approved prototype shell
- dedicated module regression suite

## Decisions Preserved

These remain the active implementation baseline:

1. Training is `account-centric`, not lead-centric.
2. Training is operationally tied to territory ownership.
3. Training is `segment-aware` so commercial can be added later without redesign.
4. Pulse owns workflow truth; external calendar providers reflect it later.
5. `Site visit` and `training session` are separate activity types.
6. Current certification seeds are `IAQ Certification Curriculum` and `Product Installations`.

## What Is Intentionally Not In This Slice

These items are still parked:

- Outlook / Microsoft Graph scheduling sync
- Teams / WebEx provider wiring
- mobile check-in / check-out execution
- photo proof and certificate artifact handling
- contest / giveaway linkage
- external training-site coexistence or sync

## Why This Slice Matters

This gives us the stable catalog and account history layer that later scheduling, mobile execution, certification tracking, and reporting can build on without reshaping the core schema.

## Recommended Next Training Slice

`Training Slice B: Scheduling + Session Execution`

That next slice should add:

- training session creation/update flows
- trainer assignment
- calendar views inside Pulse
- session outcomes and follow-up tasks
- mobile-ready session state APIs
