# Territory Module PRD

## Document Control

| Field | Value |
|---|---|
| Module | Territory Management |
| Document Type | Master PRD |
| Version | 3.0 |
| Status | Enriched — traceability closure pass complete |
| Owner | Product / Field Operations |
| Sprint Sequence | Seq 01–03 (kernel), Seq 04–05 (map parity + reporting), ongoing |
| Priority | P0 |
| Date | 2026-06-09 |
| Meeting Traceability | Session 1 (Feb 16 2026), Session 6 (Feb 27 2026), Territory Rediscovery note (Apr 14 2026), April 20 scope review |
| Primary Companion Docs | `TERRITORY_REDISCOVERY_AND_DEPENDENCY_BOUNDARY_2026-04-14.md`, `00_README_AND_MEETING_AGENDA.md`, Leads PRD, Training PRD, Calendar PRD |

---

## 1. Source Inventory

| ID | Absolute Path | What It Sourced |
|----|--------------|-----------------|
| SRC-TR-001 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session 1 - 16th Feb 2026.md` | Strategic business objectives; pain points including lack of territorial visibility, disconnected CRM from Acumatica, no reporting by state/region (Dan: "I want to know all sales in Florida, South Carolina, and Georgia — CRM can't do that"), map-my-customer replacement need, TM adoption barriers, mobile field execution requirements |
| SRC-TR-002 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Fri 27th  Feb Session 6.md` | Consignment walkthrough confirming territory scoping of field operations; CRM scope boundaries (no financial logic in CRM); module scope discussion (territory kernel, training, consignment, dealer portal); map-my-customer replacement as explicit goal; TM and RD field roles; leadership and development team use of map for assignment decisions |
| SRC-TR-003 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/TERRITORY_REDISCOVERY_AND_DEPENDENCY_BOUNDARY_2026-04-14.md` | Territory kernel honest current state; what remains below prototype parity; four build slices (T1-T4); first real external dependency boundary; decisions locked (territory is still in progress; map parity is the next active slice; commercial-safe structure required) |
| SRC-TR-004 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/territories/service.ts` | Implemented service operations: `listRegions`, `createRegion`, `updateRegion`, `listShippingCenters`, `createShippingCenter`, `updateShippingCenter`, `listTerritories`, `createTerritory`, `updateTerritory`, `replaceTerritoryCoverage`, `getTerritoryPolicy`, `updateTerritoryPolicy`, `getTerritoryDashboard`, `getTerritoryMapWorkspace`, `reassignLeadTerritory`, `reassignAccountTerritory`, `bulkReassignLeadTerritories`, `bulkReassignAccountTerritories`, `listTerritoryAssignmentHistory`, `listTerritoryAssignableUsers`; route plan stop types; territory policy seeding |
| SRC-TR-005 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/territories/visibility.ts` | Visibility scoping: TM pre-handoff visibility flag; territory-manager lead scope; regional-director scope; global visibility for admin/leadership; `preHandoffTmVisibility` policy toggle wired |
| SRC-TR-006 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/territories/http.ts` | Exposed HTTP routes: `/api/v1/territories/policy`, `/api/v1/territories/regions`, `/api/v1/territories/shipping-centers`, `/api/v1/territories`, `/api/v1/territories/dashboard`, `/api/v1/territories/map`, `/api/v1/territories/assignment-history`, `/api/v1/territories/assignable-users`, `/api/v1/territories/reassign`, `/api/v1/territories/bulk-reassign` |
| SRC-TR-007 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/territories/TerritoryCommandDashboard.tsx` | Dashboard UI: stats, coverage, lifecycle, pipeline, training penetration, alert, workload, queue, region rollup, owner metrics, next-work items; tabs for workload/regions/owners; `canManageTerritorySetup` permission guard |
| SRC-TR-008 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/territories/TerritoryManagement.tsx` | Territory list and management UI; bulk reassign; override action with reason; assignment history timeline; territory/region/shipping-center CRUD forms; policy settings; calendar feed integration |
| SRC-TR-009 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/territories/TerritoryCoverageMapPage.tsx` | Map workspace UI; coverage/accounts/pipeline/all modes; MapLibre integration; shipping-center markers; route plan stops; training session check-in/check-out; pin click handler wired to TerritoryMapLibre |
| SRC-TR-010 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/territories/TerritoryMapLibre.tsx` | MapLibre GL implementation; state boundary GeoJSON overlays; territory color coding via `resolvePaperMapTerritoryStyle`; pin rendering; shipping-center markers; hover popups with territory/TM/RD/shipping-center detail; `showBoundaries` + `showPins` toggles |
| SRC-TR-011 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/territories/TerritoryOperationsPanel.tsx` | Operations panel: account/lead reassign actions; route plan stepper; bulk selection; override controls |

---

## 2. Overview

The Territory module is the **ownership, visibility, and field-operations kernel** for Pulse. It defines regions, territories, shipping-center alignment, TM and RD ownership, assignment overrides, and the map-based command center that tells the business who owns what and what needs attention next.

Territory is not a map page. It determines who sees leads, accounts, and training records; drives account and lead assignment; and provides the operational view needed for reassignment, route planning, coverage review, and exception handling.

Across discovery sessions Curry Galbraith confirmed: reporting must be filterable by state and region (Session 1); map functionality must serve both TMs in the field and development/leadership in the office (Session 1); the CRM's territory model must replace map-my-customer as the field navigation anchor (Session 6). Dan Harshbarger confirmed the present Dynamics CRM cannot produce a state-scoped sales report, which is the root reporting pain point the territory model is designed to eliminate.

---

## 3. In-Scope

- Region, territory, and shipping-center administration and governance
- TM and RD ownership assignment (state-based residential model, Phase 1)
- Lead and account assignment using approved territory rules
- Named-owner and Strategic Growth override handling
- Assignment history, override reasons, and audit trail
- Territory visibility rules for TM, RD, Strategic Growth, leadership, and admin roles
- Command-center views: coverage posture, lifecycle posture, pipeline posture, owner workload
- Interactive territory map with state boundaries, shipping-center context, and color coding
- Lead/account drill-through from the territory map
- Territory administration: reassignment, bulk transfer between territories
- Territory-linked visibility for training and calendar modules
- Route plan foundation for field execution (without provider-backed optimization)
- Pre-handoff TM visibility policy (configurable)
- Commercial-safe model structure (no county-geometry forced in Phase 1)

## 4. Out-of-Scope (Phase 1)

- County-level commercial territory geometry
- Polygon drawing and territory restructure tooling
- Route optimization provider selection and deep navigation integration
- White-space analytics and advanced heat-map reporting
- ERP-backed revenue trending beyond CRM-owned operational posture
- GPS geofencing and strict check-in tolerance (provider-bound)
- Live Acumatica-backed sales overlays inside the map

## 5. Parked Dependencies

| Item | Dependency |
|------|-----------|
| Provider-backed route optimization | Map tile / routing provider decision |
| GPS check-in geofence enforcement | Geocoding provider + tolerance policy decision |
| Native device navigation handoff | Provider-specific navigation behavior decision |
| Acumatica purchase/order overlay on map | Acumatica read-model integration certification |

---

## 6. Functional Requirements

### 6.1 Territory Structure and Governance

| ID | Requirement | Acceptance Criteria | Priority | Source | Build Status |
|----|-------------|---------------------|----------|--------|-------------|
| FR-TR-001 | The system shall support regions as explicit governed records with an assigned Regional Director user | Region can be created, updated, and listed; `directorUser` is an optional FK; list scoped by role | P0 | SRC-TR-003, SRC-TR-004 | Built |
| FR-TR-002 | The system shall support territories as explicit governed records linked to a region, with an assigned TM user and a shipping-center alignment | Territory created/updated with FK to region, `managerUser`, and `shippingCenter`; state coverage attached separately | P0 | SRC-TR-003, SRC-TR-004 | Built |
| FR-TR-003 | The system shall support shipping centers as explicit governed records with country, state, and city metadata | Shipping center CRUD; default seeding of NV, FL, NJ centers on first boot | P0 | SRC-TR-004 | Built |
| FR-TR-004 | The system shall support replacing the set of state-coverage records for a territory in a single atomic operation | `replaceTerritoryCoverage` removes existing coverage and inserts new list; audit entry written | P0 | SRC-TR-004 | Built |
| FR-TR-005 | The system shall enforce that each active covered state belongs to at most one territory unless a Dynamic AQS-approved overlay rule explicitly permits sharing | Business rule BR-TR-02; validation enforced at coverage replace time | P0 | SRC-TR-001, SRC-TR-003 | Partial — validation exists at service layer; UI-side conflict warning not confirmed |
| FR-TR-006 | The system shall maintain a territory policy record controlling configurable assignment behaviors | `TerritoryPolicy` seeded on boot; flags: `preHandoffTmVisibility`, `assignNationalTmLeadsByDefault`, `strategicGrowthRetainsOwnership` | P0 | SRC-TR-004, SRC-TR-005 | Built |

### 6.2 Assignment and Propagation

| ID | Requirement | Acceptance Criteria | Priority | Source | Build Status |
|----|-------------|---------------------|----------|--------|-------------|
| FR-TR-007 | The system shall resolve lead and account territory ownership from approved territory rules and persist TM + RD + territory + shipping-center assignments | Lead and account records carry `assignedTmUserId`, `assignedRdUserId`, `territoryId`, `shippingCenterId`, `territoryAssignmentMethod` | P0 | SRC-TR-004 | Built |
| FR-TR-008 | The system shall support reassigning a lead to a different territory or named owner, with a mandatory reason | `reassignLeadTerritory` requires `reason`; audit entry written with before/after state | P0 | SRC-TR-004, SRC-TR-008 | Built |
| FR-TR-009 | The system shall support reassigning an account to a different territory or named owner, with a mandatory reason | `reassignAccountTerritory` requires `reason`; audit entry written | P0 | SRC-TR-004 | Built |
| FR-TR-010 | The system shall support bulk reassignment of leads between territories in a single operation | `bulkReassignLeadTerritories` with reason; all affected leads updated atomically | P0 | SRC-TR-004, SRC-TR-008 | Built |
| FR-TR-011 | The system shall support bulk reassignment of accounts between territories in a single operation | `bulkReassignAccountTerritories` with reason; atomic | P0 | SRC-TR-004, SRC-TR-008 | Built — UX-TR-008 marked Done |
| FR-TR-012 | The system shall record full assignment history for every territory, lead, and account reassignment event, including prior owner, new owner, method, and reason | `listTerritoryAssignmentHistory` returns paginated history entries; entity type covers LEAD, ACCOUNT, TERRITORY | P0 | SRC-TR-004 | Built — UX-TR-002 verification pending (may be placeholder rendering only) |
| FR-TR-013 | The system shall support a named-owner override that supersedes default geographic TM ownership where Dynamic AQS approves | `TerritoryAssignmentMethod.MANUAL_OVERRIDE` persisted; visible in assignment history; `strategicGrowthRetainsOwnership` policy flag | P0 | SRC-TR-004, SRC-TR-005 | Built — UX-TR-010 marked Done |
| FR-TR-014 | The system shall propagate territory truth into account and lead downstream views consistently | Account and lead list scoping uses the same `territoryId` / `assignedTmUserId` truth wherever displayed | P0 | SRC-TR-003, SRC-TR-004 | Partial — propagation into account location lifecycle not finished per SRC-TR-003 |

### 6.3 Visibility and Role Scoping

| ID | Requirement | Acceptance Criteria | Priority | Source | Build Status |
|----|-------------|---------------------|----------|--------|-------------|
| FR-TR-015 | The system shall scope TM visibility to their assigned territory; TMs shall not see leads or accounts in other territories unless a pre-handoff policy flag is enabled | `buildTerritoryManagerLeadScope` enforces `assignedTmUserId` + stage/override gate; `preHandoffTmVisibility` flag overrides gate | P0 | SRC-TR-005 | Built |
| FR-TR-016 | The system shall scope RD visibility to all territories within their region | `buildRegionalDirectorScope` returns territory/lead/account scope for the RD's region | P0 | SRC-TR-005 | Built |
| FR-TR-017 | The system shall grant leadership, admin, and Strategic Growth roles global record visibility | `hasGlobalRecordVisibility` returns true for these roles; no territory scope filter applied | P0 | SRC-TR-005 | Built |
| FR-TR-018 | The system shall enforce the pre-handoff TM visibility policy from the territory policy record; changing the policy shall immediately affect all TM lead queries | `preHandoffTmVisibility` read from DB at query time; `PATCH /api/v1/territories/policy` updates it | P1 | SRC-TR-005 | Built |
| FR-TR-019 | The system shall apply territory truth consistently across list views, map views, dashboards, and downstream modules (training, calendar) | Training penetration in dashboard uses `trainingPrograms` scoped by territory; calendar feed respects territory scope | P0 | SRC-TR-003, SRC-TR-007 | Partial — calendar filter from CalendarWorkspace not yet territory-filterable (UX-TR-007 Open) |

### 6.4 Command Center and Reporting

| ID | Requirement | Acceptance Criteria | Priority | Source | Build Status |
|----|-------------|---------------------|----------|--------|-------------|
| FR-TR-020 | The system shall provide a territory command-center dashboard showing stats, coverage posture, lifecycle posture, pipeline posture, training penetration, alert queue, workload, region rollups, and owner metrics | `getTerritoryDashboard` returns `TerritoryDashboardResponse` with all required fields; accessible at `/api/v1/territories/dashboard` | P0 | SRC-TR-004, SRC-TR-007 | Built |
| FR-TR-021 | The system shall provide a next-work item queue on the command dashboard that surfaces the highest-priority operational items for the active user | `TerritoryNextWorkItem[]` passed to dashboard component; items carry tone, owner, gap label, and location label | P1 | SRC-TR-007 | Partial — items rendered but drill-through click handler missing (UX-TR-001 Open) |
| FR-TR-022 | The system shall provide region-level rollup rows on the command dashboard, expandable to show the territory list within each region | `regionRollups: TerritoryDashboardRegionRollupSummary[]` passed to dashboard | P1 | SRC-TR-007 | Partial — region rows rendered but not expandable to territory list (UX-TR-005 Open) |
| FR-TR-023 | The system shall expose owner workload metrics including per-TM account and lead counts, training overdue counts, and consignment exception counts | `TerritoryDashboardOwnerMetricSummary[]` in dashboard response | P1 | SRC-TR-004 | Built |
| FR-TR-024 | The system shall provide unassigned, conflict, and exception queues scoped to the viewing user's territory/region | `TerritoryDashboardQueueSummary` includes `territoriesMissingManager`, `territoriesMissingShippingCenter`, `regionsMissingDirector` | P0 | SRC-TR-007 | Built |
| FR-TR-025 | The system shall produce a territory-scoped training penetration summary showing training status distribution across accounts in the territory | `TerritoryDashboardTrainingPenetrationSummary` field in dashboard | P1 | SRC-TR-004 | Built |

### 6.5 Map and Operational View

| ID | Requirement | Acceptance Criteria | Priority | Source | Build Status |
|----|-------------|---------------------|----------|--------|-------------|
| FR-TR-026 | The system shall provide an interactive territory map that renders state boundaries with Dynamic AQS territory color coding | MapLibre GL renders GeoJSON state boundaries; `resolvePaperMapTerritoryStyle` applies approved territory colors | P0 | SRC-TR-003, SRC-TR-009, SRC-TR-010 | Built |
| FR-TR-027 | The system shall display shipping-center markers on the territory map | `shippingCenters` layer rendered in TerritoryMapLibre with `IconBuildingWarehouse`; clickable markers | P0 | SRC-TR-003, SRC-TR-010 | Built — no dedicated shipping-center filter layer (UX-TR-006 Open) |
| FR-TR-028 | The system shall display lead and account pins on the territory map with status color coding | `TerritoryMapPinSummary[]` rendered as markers; `onPinClick` handler wired | P0 | SRC-TR-003, SRC-TR-009, SRC-TR-010 | Built — UX-TR-009 marked Done |
| FR-TR-029 | The system shall support map modes for coverage-only, account pins, pipeline pins, and all combined | `MapMode` type: `coverage | accounts | pipeline | all`; mode selector in TerritoryCoverageMapPage | P1 | SRC-TR-009 | Built |
| FR-TR-030 | The system shall provide state hover tooltips on the map showing territory name, assigned TM, assigned RD, and shipping center | `HoveredStateSummary` popup rendered on MapLibre hover | P1 | SRC-TR-010 | Built |
| FR-TR-031 | The system shall provide a "state-level coverage only" context banner on the map to communicate Phase 1 scope to users | Banner indicating state-level precision | P1 | SRC-TR-003 | Not-built (UX-TR-004 Open) |
| FR-TR-032 | The system shall support office-side use of the map for assignment and coverage review decisions, not only field TM use | Map surface accessible to operations and leadership roles; filters and drill-through available to non-TM users | P0 | SRC-TR-001, SRC-TR-002, SRC-TR-003 | Built |
| FR-TR-033 | The system shall provide a route plan stop model on the map workspace without requiring provider-backed optimization | `TerritoryRoutePlanSummary` and `TerritoryRoutePlanStopSummary` types in contracts; stop model rendered in TerritoryCoverageMapPage | P2 | SRC-TR-003, SRC-TR-009 | Partial — data model exists; provider-backed optimization parked |

### 6.6 Administrative Actions

| ID | Requirement | Acceptance Criteria | Priority | Source | Build Status |
|----|-------------|---------------------|----------|--------|-------------|
| FR-TR-034 | The system shall allow authorized admins to create and edit region records | `createRegion`, `updateRegion` operations; guarded by `territory.admin` action access | P0 | SRC-TR-004, SRC-TR-006 | Built |
| FR-TR-035 | The system shall allow authorized admins to create and edit territory records, including updating state coverage | `createTerritory`, `updateTerritory`, `replaceTerritoryCoverage`; guarded by `territory.admin` | P0 | SRC-TR-004 | Built |
| FR-TR-036 | The system shall allow authorized admins to update territory policy settings | `updateTerritoryPolicy`; guarded by admin action access | P0 | SRC-TR-004 | Built |
| FR-TR-037 | The system shall expose a list of users assignable to territory TM/RD roles | `listTerritoryAssignableUsers` filtered to `TERRITORY_MANAGER` and `REGIONAL_DIRECTOR` role codes | P0 | SRC-TR-004 | Built |
| FR-TR-038 | The system shall provide an empty-state placeholder when a filtered territory list returns no results | UX improvement for zero-result filter state | P1 | (inferred) | Not-built (UX-TR-003 Open) |

### 6.7 Field Execution Foundation

| ID | Requirement | Acceptance Criteria | Priority | Source | Build Status |
|----|-------------|---------------------|----------|--------|-------------|
| FR-TR-039 | The system shall support training session check-in and check-out from within the territory map workspace | `checkInTrainingSessionRecord`, `completeTrainingSessionRecord` callable from TerritoryCoverageMapPage | P1 | SRC-TR-009 | Built |
| FR-TR-040 | The system shall provide a territory-scoped calendar feed on the territory management surface | `TerritoryCalendarFeed.tsx` component; `fetchCalendarWorkspace` called from TerritoryManagement | P1 | SRC-TR-008 | Built — calendar not filterable by territory from CalendarWorkspace (UX-TR-007 Open, different surface) |
| FR-TR-041 | The system shall provide a field agenda read model anchored to territory and schedule, without requiring GPS optimization | Route stop model in TerritoryCoverageMapPage; `TerritoryRoutePlanStopSummary` in contracts | P2 | SRC-TR-003 | Partial — data model only; full field agenda UI is a future slice |

---

## 7. Non-Functional Requirements

| ID | Requirement | Category | Source |
|----|-------------|----------|--------|
| NFR-TR-001 | Territory visibility scoping queries shall execute against indexed FK columns (`assignedTmUserId`, `territoryId`, `regionId`) so that filtered list results return within acceptable latency for a user's data volume | Performance | SRC-TR-005 (inferred standard) |
| NFR-TR-002 | Territory assignment changes shall be persisted with full before/after audit entries; no assignment mutation shall succeed without an audit record | Auditability | SRC-TR-003, SRC-TR-004 |
| NFR-TR-003 | Territory policy reads shall be non-cached at the query layer to ensure that a policy change (e.g. `preHandoffTmVisibility`) takes effect on the next request without requiring a service restart | Consistency | SRC-TR-005 |
| NFR-TR-004 | All territory administrative actions (create, update, replace coverage, update policy) shall be guarded by `territory.admin` action access; read operations shall be guarded by `territories` module access | Security / AuthZ | SRC-TR-005, SRC-TR-006 |
| NFR-TR-005 | The territory map shall remain responsive during state boundary rendering; GeoJSON tile loading shall not block interactive pan/zoom | Performance | SRC-TR-010 (inferred standard) |
| NFR-TR-006 | The system shall be structured to support commercial/county geometry in a later phase without requiring a schema migration that breaks the residential state-first model | Scalability | SRC-TR-003 |
| NFR-TR-007 | Territory-scoped data must degrade safely when a territory record has no assigned TM or RD (nulls permitted; dashboard queue surfaces these as hygiene issues) | Availability | SRC-TR-007 |
| NFR-TR-008 | Map pin click actions that navigate to lead or account records shall complete without full-page reload and shall preserve the user's current map position | Usability | SRC-TR-003 (inferred standard) |
| NFR-TR-009 | Bulk reassignment operations shall be executed in a database transaction; partial failures shall roll back the entire batch | Data Integrity | SRC-TR-004 (inferred standard) |
| NFR-TR-010 | Assignment history shall be immutable; no history record shall be updated or deleted after creation | Auditability | SRC-TR-004 (inferred standard) |

---

## 8. Assumptions

| ID | Assumption | Why It Matters |
|----|-----------|----------------|
| ASM-TR-001 | The Phase 1 residential territory truth is state-based and aligned to the approved Dynamic AQS paper map | Determines how the initial territory kernel is structured and how `replaceTerritoryCoverage` defines coverage |
| ASM-TR-002 | Shipping-center alignment is part of territory truth, not only a reporting attribute | Affects territory administration and the map operational layer |
| ASM-TR-003 | TM and RD ownership remain the core operational hierarchy for territory visibility | Determines command-center design and access patterns |
| ASM-TR-004 | Office users (development team, operations, leadership) use the territory map for assignment and coverage review decisions — not only TMs in the field | Confirmed in Session 1 by Michelle Hogan and Curry Galbraith |
| ASM-TR-005 | Named-owner and Strategic Growth overrides are explicit and auditable, not informal exceptions | `MANUAL_OVERRIDE` assignment method and `strategicGrowthRetainsOwnership` policy flag |
| ASM-TR-006 | The Phase 1 model must remain future-safe for commercial/county logic even though the first release is residential/state-first | Confirmed by Dan Harshbarger's direction in SRC-TR-003 |
| ASM-TR-007 | One account has one operational owner at a time; visibility and ownership are kept separate | Confirmed in SRC-TR-003: "one account should still have one operational owner at a time" |
| ASM-TR-008 | The assignment truth for Strategic Growth is an overlay on default geographic TM ownership, not a separate universe | Confirmed in SRC-TR-003 |

---

## 9. Open Questions

| ID | Question | Options to Confirm | Decision Owner |
|----|----------|-------------------|---------------|
| OQ-TR-001 | What is the exact precedence rule between Strategic Growth ownership and default geographic TM ownership? | geography first / SGT override first / conditional by lead type / conditional by stage | Dynamic AQS leadership |
| OQ-TR-002 | When does territory ownership become operationally binding for a lead? | at lead intake / after discovery / after CIS / after activation | Dynamic AQS leadership |
| OQ-TR-003 | What is the approved truth model for accounts with multiple locations? | account-level owner only / location-aware ownership / hybrid with primary owner | Dynamic AQS operations |
| OQ-TR-004 | Is a district layer required in the hierarchy? | no district / optional district / required district | Dynamic AQS leadership |
| OQ-TR-005 | How much map precision is required in Phase 1? | state-based only (current) / ZIP-aware / county-aware / custom shapes later | Dynamic AQS + architecture |
| OQ-TR-006 | What should the pre-handoff TM visibility rule be by default? | no visibility / visibility after certain stage / configurable by territory | Dynamic AQS leadership |
| OQ-TR-007 | What later-phase route-planning depth is expected? | operational map only / route planning included / provider-backed optimization later | Dynamic AQS + architecture |
| OQ-TR-008 | Which map tile and geocoding provider is approved for production use? | Mapbox / MapLibre + open tiles / Google Maps / other | Architecture + Dynamic AQS |

---

## 10. FR / NFR → SRC Traceability Matrix

| Requirement ID | SRC-TR-001 | SRC-TR-002 | SRC-TR-003 | SRC-TR-004 | SRC-TR-005 | SRC-TR-006 | SRC-TR-007 | SRC-TR-008 | SRC-TR-009 | SRC-TR-010 | SRC-TR-011 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| FR-TR-001 | | | X | X | | | | | | | |
| FR-TR-002 | | | X | X | | | | | | | |
| FR-TR-003 | | | | X | | | | | | | |
| FR-TR-004 | | | | X | | | | | | | |
| FR-TR-005 | X | | X | X | | | | | | | |
| FR-TR-006 | | | | X | X | | | | | | |
| FR-TR-007 | | | | X | X | | | | | | |
| FR-TR-008 | | | | X | | | | X | | | |
| FR-TR-009 | | | | X | | | | | | | |
| FR-TR-010 | | | | X | | | | X | | | |
| FR-TR-011 | | | | X | | | | X | | | |
| FR-TR-012 | | | | X | | | | | | | |
| FR-TR-013 | | | | X | X | | | | | | |
| FR-TR-014 | | | X | X | | | | | | | |
| FR-TR-015 | | | | | X | | | | | | |
| FR-TR-016 | | | | | X | | | | | | |
| FR-TR-017 | | | | | X | | | | | | |
| FR-TR-018 | | | | | X | | | | | | |
| FR-TR-019 | | | X | | | | X | | | | |
| FR-TR-020 | | | | X | | | X | | | | |
| FR-TR-021 | | | | | | | X | | | | |
| FR-TR-022 | | | | | | | X | | | | |
| FR-TR-023 | | | | X | | | | | | | |
| FR-TR-024 | | | | | | | X | | | | |
| FR-TR-025 | | | | X | | | | | | | |
| FR-TR-026 | | | X | | | | | | X | X | |
| FR-TR-027 | | | X | | | | | | X | X | |
| FR-TR-028 | | | X | | | | | | X | X | |
| FR-TR-029 | | | | | | | | | X | | |
| FR-TR-030 | | | | | | | | | | X | |
| FR-TR-031 | | | X | | | | | | | | |
| FR-TR-032 | X | X | X | | | | | | | | |
| FR-TR-033 | | | X | | | | | | X | | |
| FR-TR-034 | | | | X | | X | | | | | |
| FR-TR-035 | | | | X | | | | | | | |
| FR-TR-036 | | | | X | | | | | | | |
| FR-TR-037 | | | | X | | | | | | | |
| FR-TR-038 | | | | | | | | | | | (inferred) |
| FR-TR-039 | | | | | | | | | X | | |
| FR-TR-040 | | | | | | | | X | | | |
| FR-TR-041 | | | X | | | | | | X | | |

---

## §UX-GAPS — Audit 2026-06-08

Gaps identified during a full platform UX/requirements audit. Organised by sprint priority.
All items with **Can do now = Yes** have no external dependency.

### Sprint 1 — Quick Wins (S effort)

| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-TR-001 | Command dashboard next-work items have no drill-through click handler | TerritoryCommandDashboard.tsx | Yes | Open |
| UX-TR-002 | Assignment history rendering needs verification — may be placeholder only | TerritoryManagement.tsx | Yes | Open |
| UX-TR-003 | No empty state on filtered territory list | TerritoryManagement.tsx | Yes | Open |
| UX-TR-004 | No "state-level coverage only" context banner on map | TerritoryCoverageMapPage.tsx | Yes | Open |
| UX-TR-005 | RD region rows not expandable to territory list | TerritoryCommandDashboard.tsx | Yes | Open |
| UX-TR-006 | No shipping-center layer on territory map | TerritoryCoverageMapPage.tsx | Yes | Open |
| UX-TR-007 | Calendar not filterable by territory from within CalendarWorkspace | CalendarWorkspace.tsx | Yes | Open |

### Sprint 2 — Core Workflow (M effort)

| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-TR-008 | No bulk account transfer between territories with reason | TerritoryManagement.tsx | Yes | Done |
| UX-TR-009 | Map pins have no lead/account drill-through | TerritoryCoverageMapPage.tsx | Yes | Done |
| UX-TR-010 | No named-owner override action with reason field | TerritoryManagement.tsx | Yes | Done |
