# Territory And Training Roadmap To Dependency Boundary

Date: 2026-04-14

## Why This Exists

Territory and Training are at different maturity levels:

- Territory has a real backend kernel, but the map and operational depth are still below
  prototype parity.
- Training is further along and is close to its first external dependency boundary.

This note makes the next slices explicit so the implementation repo stays honest about
what is finished, what is still active, and what waits on provider decisions.

## Territory Roadmap

### Current Position

Implemented already:

- region / territory / shipping-center kernel
- TM / RD visibility and owner model
- default assignment
- manual override
- assignment history
- backend-wired `/territories` and `/territory_map`

Still missing relative to the approved prototype and PRD:

- true interactive geographic map
- richer map overlays and filters
- account/location propagation
- broader territory reporting
- field-execution territory workflow depth

### Roadmap

#### Territory Slice T1: Map Parity

Goal:
- replace the current atlas-style map experience with a true interactive territory map

Build:
- interactive geographic territory map
- customer and lead pins
- map-side status colors
- territory / region / shipping-center overlays
- pin click to account or lead detail
- filters for territory-relevant operational state

Dependency status:
- **No external blocker required to start**

#### Territory Slice T2: Propagation And Ownership Maintenance

Goal:
- make territory truth consistent across lead, account, and location lifecycle

Build:
- account/location propagation
- transfer and override visibility
- territory-aware customer views
- ownership consistency checks

Dependency status:
- **No external blocker**

#### Territory Slice T3: Reporting And Exception Views

Goal:
- give TM, RD, and leadership the territory health visibility described in discovery

Build:
- TM workload views
- RD regional rollups
- training overdue by territory
- consignment exceptions by territory
- unassigned/conflict queues
- broader territory-owner operational reporting

Dependency status:
- **No external blocker**

#### Territory Slice T4: Field-Execution Foundation

Goal:
- prepare territory for the mobile field workflow without locking provider choices too
  early

Build:
- schedule-first agenda read model
- route-stop model
- arrival context
- check-in/check-out hooks
- activity classification and notes capture
- navigation handoff contract

Dependency status:
- **Partly unblocked now**
- keep optimization and GPS strictness abstract

#### Territory Slice T5: Provider-Connected Routing

Goal:
- complete the advanced geo/routing behavior

Build:
- production map/routing provider integration
- route optimization
- GPS tolerance/geofencing
- native directions / provider-specific behavior
- richer sales overlay if backed by ERP/source systems

Dependency status:
- **Blocked by provider decisions and some downstream data sources**

### Territory Completion View

Territory is **not complete yet**.

The realistic target is:
- complete **T1-T3**
- complete as much of **T4** as is provider-free
- then stop at the provider boundary

## Training Roadmap

### Current Position

Implemented already:

- catalog and training types
- templates
- cadence policies
- trainer assignment
- account-centric programs
- scheduling
- session execution
- check-in / check-out
- certification outcomes
- certification history
- mobile-safe execution contracts
- prototype-aligned `/training`

Known certification seeds:

- `IAQ Certification Curriculum`
- `Product Installations`

### Training Is Further Along Than Territory

Training is already close to its first real dependency boundary.

What is still optional and provider-free:

- richer reporting and dashboards
- certification expiry and recertification queues
- exception read models for TM/RD/leadership
- deeper customer/territory-linked training visibility

What becomes provider-dependent:

- Outlook calendar sync
- bidirectional scheduling reflection
- Teams/WebEx/provider meeting behavior
- external training-site coexistence or sync

### Roadmap

#### Training Slice D0: Reporting And Certification Ops

Goal:
- deepen training value without waiting on Outlook or the external training site

Build:
- training overdue dashboard depth
- certification expiry tracking
- recertification queue
- TM/RD/leadership reporting views
- territory/account exception rollups

Dependency status:
- **No external blocker**

#### Training Slice D1: Outlook And External Coexistence

Goal:
- connect the current training core to calendar/provider systems

Build:
- Microsoft Graph / Outlook reflection
- sync conflict handling
- provider-aware meeting link behavior
- external training-site coexistence boundary
- certification-site import decisions

Dependency status:
- **Blocked by provider prerequisites**

#### Training Slice E: Mobile Surface Expansion

Goal:
- finish the mobile-facing UI layer once mobile work is reactivated

Build:
- mobile scheduling view parity
- mobile execution screens
- proof capture polish
- certification capture parity on mobile

Dependency status:
- depends on mobile resumption, not on Outlook itself

### Training Completion View

Training is **not basic anymore**.

It is already strong through the CRM-owned and mobile-ready backend boundary.
The next major blocker is provider connectivity, not core domain modeling.

## Recommended Active Sequencing

1. `Territory Slice T1: Map Parity`
2. `Territory Slice T2: Propagation And Ownership Maintenance`
3. `Territory Slice T3: Reporting And Exception Views`
4. `Training Slice D0: Reporting And Certification Ops` only if we want more
   provider-free training depth before Outlook prerequisites arrive
5. `Training Slice D1` once Outlook/external training prerequisites are supplied

## Decisions Locked By This Note

1. Territory should remain an active build track.
2. Training is not the same level of incompleteness as Territory.
3. The next best territory slice is **Map Parity**.
4. Training can optionally deepen reporting now, but its main next integration slice is
   provider-bound.
5. We should complete Territory to its first real dependency blocker before treating the
   module as settled.

## Related References

- [TERRITORY_REDISCOVERY_AND_DEPENDENCY_BOUNDARY_2026-04-14.md](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/TERRITORY_REDISCOVERY_AND_DEPENDENCY_BOUNDARY_2026-04-14.md)
- [TRAINING_NEXT_SLICE_PLAN_2026-04-14.md](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/TRAINING_NEXT_SLICE_PLAN_2026-04-14.md)
- [TRAINING_MODULE_STRUCTURE_AND_COMMERCIAL_READINESS_2026-04-14.md](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/TRAINING_MODULE_STRUCTURE_AND_COMMERCIAL_READINESS_2026-04-14.md)
- [DELIVERY_PROGRESS_TRACKER.md](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/DELIVERY_PROGRESS_TRACKER.md)
