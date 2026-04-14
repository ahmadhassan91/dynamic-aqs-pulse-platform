# Territory Rediscovery And Dependency Boundary

Date: 2026-04-14

## Purpose

This note refreshes Territory scope using:

- meeting-backed discovery
- the Territory PRD
- the approved prototype routes and behavior
- the current implementation state in the production repo

It exists because the current implementation has the territory kernel, but not full
prototype parity for the map and operational surfaces.

## Source Precedence

When territory sources disagree, use this order:

1. latest meeting-backed business decisions
2. active PRDs and source-of-truth docs
3. implementation tracker and committed code
4. approved prototype UI references

The prototype remains the UI/reference shell. It does not override later meeting
decisions or unresolved policy questions.

## Honest Current State

Territory is **not just basic**, but it is also **not yet complete to prototype parity**.

What is already real:

- region / territory / shipping-center kernel
- TM / RD ownership and visibility foundation
- state-based assignment rules
- manual override and assignment history
- named-owner override persistence
- `/territories` and `/territory_map` on the approved Pulse shell
- live dashboard / map / list workspace against backend territory data

What is still below the approved prototype expectation:

- the current "map" is a live coverage atlas/read model, not the richer geographic map
  experience implied by the prototype and PRD
- account/location propagation is not finished
- territory reporting is still thinner than the prototype/meeting vision
- field-routing and mobile territory execution are not complete

## What Discovery Confirms

### 1. Territory is an operational kernel, not a page

Discovery consistently ties territory to:

- lead routing
- customer ownership
- training follow-up
- consignment field work
- exception reporting
- TM / RD visibility
- mobile field execution

Territory cannot be treated as only a visualization module.

### 2. The map matters as a working tool

The meetings and PRD support:

- interactive territory map behavior
- customer pins and status indicators
- office-side assignment and coverage decisions
- quick visual reference for trend/risk context
- color-coded state/territory visibility for TMs and RDs

So yes, the map is still a real missing slice, not cosmetic polish.

### 3. Default geography is not the whole assignment model

Discovery confirms:

- residential starts state-first
- Strategic Growth is an overlay, not a separate universe
- one account should still have one operational owner at a time
- visibility and ownership should stay separate

That means we should keep policy configurable and preserve override history.

### 4. Territory extends into field execution

Discovery supports:

- customer context before arrival
- check-in / check-out
- training and site-visit capture
- overdue / exception visibility
- RD escalation and rollups

These are downstream slices, but they are part of the territory roadmap.

### 5. Commercial readiness is required, but not Phase 1 delivery

Dan's direction remains:

- residential-first delivery
- future-safe structure for commercial/county overlays later

So the production model must stay commercial-safe without forcing county geometry now.

## What We Can Still Complete Before Any External Dependency Blocks Us

We can safely build the following Territory depth **now** without waiting on outside
providers:

### Slice T1: Territory Map Parity

- real interactive map surface instead of the current atlas-style read model
- region / territory / shipping-center overlays
- customer and lead pins with status color coding
- map-side filters matching approved prototype intent
- click-through from pin or territory to account/lead detail
- office-side assignment use, not only TM-facing use

### Slice T2: Territory Propagation And Ownership Maintenance

- propagate territory truth into account and location lifecycle cleanly
- keep lead/account/location assignment state consistent
- preserve override and transfer history everywhere
- expose territory ownership clearly in customer-facing internal workspaces

### Slice T3: Territory Reporting And Exception Views

- territory health and workload views
- RD regional rollups
- unassigned / conflict / exception queues
- training overdue and consignment exception visibility scoped by territory/region
- broader territory-owner operational reporting

### Slice T4: Territory Field-Execution Foundation

- schedule-first field agenda read model
- route stop model without optimization provider lock-in
- account-arrival context panel
- check-in / check-out hooks
- activity classification and notes capture
- native navigation handoff contract

This slice can be partly built before provider work if we keep actual optimization and
GPS strictness abstract.

## The First Real Dependency Boundary

Territory does **not** hit its first serious external blocker at the current stage.
There is still meaningful CRM-owned work left.

The first real dependency boundary starts when we need:

- production map tile / geocoding / routing provider decisions
- route optimization provider behavior
- GPS check-in tolerance and geofencing rules
- native directions and provider-specific navigation behavior
- live Acumatica-backed sales / order overlays if we want true field performance and
  customer purchase trend views inside the map

So the practical boundary is:

- **T1-T3 can proceed now**
- **T4 can partly proceed now**
- **advanced routing / geo / optimization becomes provider-bound**

## Recommended Territory Build Order

1. `T1 Territory Map Parity`
2. `T2 Territory Propagation And Ownership Maintenance`
3. `T3 Territory Reporting And Exception Views`
4. `T4 Territory Field-Execution Foundation`
5. `T5 Provider-Connected Routing And Geospatial Depth`

## Decisions Locked By This Note

1. Territory is still `In Progress`, not complete.
2. The current implementation is a kernel-first territory slice, not full map parity.
3. The next active territory slice should be **Map Parity**, not a side feature.
4. Territory can still be advanced meaningfully before any third-party dependency blocks
   us.
5. Commercial-safe structure stays required, but county/commercial geometry remains a
   later slice.

## Related References

- [TERRITORY_MANAGEMENT_PRD.md](/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/TERRITORY_MANAGEMENT_PRD.md)
- [TERRITORY_VALIDATION_AND_BUILD_READINESS_2026-04-13.md](/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/plans/TERRITORY_VALIDATION_AND_BUILD_READINESS_2026-04-13.md)
- [DELIVERY_PROGRESS_TRACKER.md](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/DELIVERY_PROGRESS_TRACKER.md)
