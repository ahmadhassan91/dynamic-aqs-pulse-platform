# Consignment Requirements Map

Date: 2026-04-30

This map copies the latest consignment scope into the Pulse development repo and separates what can be built now from what is intentionally parked behind Acumatica or other external decisions.

Source PRD:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/client-scope-confirmation-2026-04-20/05_CONSIGNMENT_PRD.md`
- Original planning source: `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/CONSIGNMENT_MANAGEMENT_PRD.md`

Primary evidence:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/25 Feb 2026 Session 5.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Fri 27th  Feb Session 6.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/17th March  session 10-To-Be consognment and App.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asispricingdocuments/Consignment Overview.docx.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asispricingdocuments/DAQS Consignment Program Onboarding Doc V1 (1).docx.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asispricingdocuments/Consign Docs and forms overview-V1.docx.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Consignment/Warehouse_Visit_Tracking_Master.xlsx - Main (1).csv`

## Boundary Rule

Pulse can build workflow, visibility, documents, audit capture, reconciliation control, mailbox work items, and reporting scaffolds now.

Pulse must not fake Acumatica-owned truth. Warehouse creation, transfer/receipt truth, inventory on hand, posted POs/sales orders, invoices, credit memos, and financial settlement remain parked until Acumatica sandbox access, certified endpoints, sample records, and signed field mappings are available.

## Current Coverage Map

| Requirement Area | Status | Build Now In Pulse | Parked Dependency / Reason | Re-entry Trigger |
| --- | --- | --- | --- | --- |
| Consignment enrollment from lead/account | `Implemented / Partial` | Durable account/location-linked consignment sites and account read model counts are implemented; lead-to-account promotion remains a later workflow connection | None | Extend lead conversion handoff after the account activation slice is stable |
| Pre-warehouse onboarding pipeline | `Implemented / Partial` | Onboarding, ready-for-warehouse, baseline-pending, active, and exited states are implemented with activation gating; abandoned-onboarding reporting remains partial | None | Add reporting/export view over parked and abandoned states |
| Samantha/Ops alert boundary | `Build Now` | Only queue Samantha/Ops warehouse setup work after `ready_for_warehouse` | Real outbound delivery provider can remain parked; create alert/work-item records now | Notification provider approval |
| Agreement and document register | `Implemented / Partial` | Agreement and BLUE status/version/current-reference behavior are implemented and regression-covered; remaining form families use the same register shell pending workflow-specific UI | E-sign vendor flow parked | E-sign provider and legal policy decision |
| Account/customer consignment indicator | `Implemented / Partial` | Account consignment read model exposes participation plus active/onboarding/exited counts for customer drilldown | UI placement is live/partial depending account workspace surface | Account UI polish and cross-link validation |
| Consignment site master | `Implemented` | Site record, account/location link, TM/RD ownership, contact/status fields, real warehouse reference capture/editing, scoped reads, and audit entry creation are implemented | Live Acumatica warehouse validation parked | Acumatica warehouse endpoint and field mapping |
| BLUE baseline workflow | `Implemented / Partial` | BLUE signed/approved evidence establishes baseline and next-audit date; expected line import remains manual/parked | Acumatica transfer/receipt inventory truth parked | Transfer/receipt endpoint certification |
| ROSE 90-day audit scheduler | `Implemented / Partial` | 90-day cadence helpers, audit completion reset, route/service regressions, and durable `ConsignmentAudit` calendar source are implemented; provider sync/status depth remains later | Outlook/provider sync already handled separately by calendar boundary | Deepen calendar provider status/audit visibility after shared-calendar pilot hardening |
| On-site ROSE audit capture | `Implemented / Partial` | Audit shell, expected/manual lines, actual count, variance, completion, and reconciliation status are implemented | Authoritative SKU/barcode inventory list from Acumatica parked | SKU/barcode/product mapping signoff |
| Audit vs reconciliation split | `Implemented` | Separate audit status and reconciliation status are implemented; audit can complete while reconciliation remains open | None | Reconciliation workflow depth slice |
| True-up and discrepancy cases | `Implemented / Partial` | ROSE variance now creates a true-up review case/work item first; back-office users record outcome, reason, optional PO reference, and notes before any PO follow-up starts; owner/escalation reporting remains partial | In-transit/open PO/receipt matching from Acumatica parked | Acumatica order/transfer/sales fixtures |
| 5-business-day PO clock | `Implemented / Partial` | Business-day helper and PO follow-up work item now start only after true-up confirms `po_required`; escalation policy remains partial | PO auto-create/link in Acumatica parked | PO/sales-order endpoint certification |
| Shared mailbox work queue | `Partial` | Pulse work items now split true-up review from manual PO follow-up and parked warehouse/PO/PURPLE/SAND boundaries, with site detail showing recent work items and discrepancy cases | Mailbox API ingestion/provider automation parked | Mailbox provider decision/access |
| PURPLE adjustment workflow | `Implemented / Partial` | Structured adjustment request, current/add/remove/new total, reason/notes, PURPLE document link, approval work item, and Pulse manual baseline update after approval are implemented | Posted inventory adjustment in Acumatica parked | Inventory adjustment endpoint certification |
| SAND exit workflow | `Implemented / Partial` | Notice, planned exit, final reconciliation, return/retained quantities, settlement reference, closure status, SAND document link, exit work item, and `exiting` -> `exited` transition are implemented | Invoices, credit memos, posted settlement parked | Finance/Acumatica settlement endpoint access |
| Reporting and Samantha workbook replacement | `Build Now To Available Data` | Site, audit, reconciliation, PO clock, work-item, and manually/imported baseline reports with export | Live sales/inventory/revenue truth parked | Acumatica sales/inventory read models |
| Mobile offline audit and barcode scan | `Build Later In Pulse` | Can design around stored audit lines and manual fallback | Barcode standard/product identity and mobile offline policy need approval | Barcode decision and mobile slice start |
| Dealer/customer consignment visibility | `Decision` | Keep internal-only in Phase 1 | Not all dealers should see consignment; portal visibility needs explicit approval | Dealer portal consignment policy decision |

## UX-05 Slice E Trace - 2026-06-04

This slice keeps Samantha/Ops workflow visible without exposing Acumatica mechanics on the default CRM screen. The goal is a simple operator queue for work Pulse can own now: due ROSE audits, manual follow-up, site issues, and document/setup readiness.

| Requirement area | Slice E response | Evidence | Boundary kept honest |
| --- | --- | --- | --- |
| Samantha/Ops alert boundary and shared mailbox style follow-up | `/consignment` now defaults to one ranked `Next Site Work` list that combines due audits, follow-ups, and site issues | `apps/crm-web/src/components/consignment/ConsignmentWorkspace.tsx`, `apps/crm-web/e2e/ux-depth.spec.mjs` | Mailbox provider automation remains parked; Pulse-owned work items are shown instead |
| ROSE 90-day audit scheduler and on-site audit capture | Due/overdue audits appear as the first-class work row, and site detail exposes a single `Finish audit` decision modal | `ConsignmentWorkspace.tsx`, `apps/crm-web/src/components/consignment/ConsignmentSiteDetail.tsx` | Authoritative SKU/barcode inventory remains parked until product/Acumatica mappings are certified |
| Audit vs reconciliation split | The modal separates `No issue` completion from `Log site issue`, preserving the manual reconciliation path only when needed | `ConsignmentSiteDetail.tsx`, `apps/api/src/modules/consignment/service.ts` | PO creation/posting remains a manual/parked Acumatica boundary |
| Reporting and Samantha workbook replacement over available data | Reports remain reachable behind More rather than being mixed into the first screen | `ConsignmentWorkspace.tsx` | Live sales/inventory/revenue truth remains parked until Acumatica read models are certified |
| Parked warehouse/setup boundary | UI copy now uses `Setup handoff` instead of leading with Acumatica terminology | `apps/api/src/modules/consignment/service.ts` | Warehouse creation, transfer/receipt, PO, and financial truth stay parked |

## UX-07 Slice J Trace - 2026-06-05

This slice tightens the Consignment operator experience after the first queue/detail pass. It keeps the module aligned to Samantha's operational control model: Pulse can guide site work, document evidence, ROSE audit actions, setup confirmations, and follow-up ownership, while Acumatica remains the source of truth for warehouse, transfer/receipt, inventory, PO, and financial posting.

| Requirement area | Slice J response | Evidence | Boundary kept honest |
| --- | --- | --- | --- |
| Samantha/Ops alert boundary and shared work queue | `Next site work` remains one ranked table; work item subjects are translated to `Site setup needs confirmation` or `Site issue needs review` instead of parked-provider language | `apps/crm-web/src/components/consignment/ConsignmentWorkspace.tsx`, `apps/crm-web/e2e/ux-depth.spec.mjs` | Mailbox/provider automation remains parked; Pulse-owned work items stay visible |
| Consignment site master and readiness | Status labels now use `Setup ready` / `Setup pending`; all-site search remains behind More and is covered by six-column table assertions | `ConsignmentWorkspace.tsx`, `apps/crm-web/e2e/ux-depth.spec.mjs` | Warehouse creation and validation remain Acumatica-owned |
| ROSE 90-day audit action | Active audit detail shows only the valid `Finish audit` action for audit-capable users; stale completed setup actions are removed from `More`. Live UAT records with Agreement/BLUE evidence and `activeSince` now route operators to ROSE work instead of redoing setup. | `apps/crm-web/src/components/consignment/ConsignmentSiteDetail.tsx`, `apps/crm-web/e2e/flows.spec.mjs`, deployed Slice J live smoke | Audit completion can open a site issue, but PO posting remains parked |
| Agreement / BLUE / readiness evidence | Site detail keeps current work and snapshot first, then places cadence, readiness, form counts, documents, audit history, and reviewed field notes behind one `Site details and evidence` disclosure | `ConsignmentSiteDetail.tsx`, `apps/crm-web/e2e/ux-depth.spec.mjs` | Evidence is traceable without pretending signed/e-sign or ERP workflows are automated |
| Permission-aware operator UI | `Create Site` requires `consignment.manage`; agreement/BLUE actions require `consignment.document_manage`; ROSE actions require `consignment.audit` | `ConsignmentWorkspace.tsx`, `ConsignmentSiteDetail.tsx` | Backend remains the enforcement authority; UI avoids encouraging role-level 403s |
| Parked Acumatica wording | Default and detail clutter checks now fail if Acumatica, ERP, inventory, PO, purchase order, manual variance, warehouse confirmation, warehouse setup waiting, or approved handoff leak into first paint | `apps/crm-web/e2e/ux-clutter.spec.mjs` | Parked dependency is documented and hidden from daily work, not removed from the system boundary |

## UX-07 Slice P Trace - 2026-06-06

This slice closes the biggest product-grade gap in the current consignment build: a ROSE variance should not automatically become a PO chase. Pulse now reflects Samantha's operating sequence: finish the ROSE audit, review the variance against real-world timing and known open work, then start the 5-business-day PO follow-up clock only if the back-office true-up confirms it is needed.

| Requirement area | Slice P response | Evidence | Boundary kept honest |
| --- | --- | --- | --- |
| Audit vs reconciliation split | Completing ROSE with a variance now leaves the audit completed but opens reconciliation as a true-up review, not a PO follow-up | `apps/api/src/modules/consignment/service.ts`, `apps/api/test/consignment.regression.test.mjs` | Audit completion is not treated as financial/order truth |
| True-up and discrepancy cases | Added true-up outcome capture: `po_required`, `resolved_no_po`, or `write_off`, with reason, optional customer PO reference, and notes | `packages/contracts/src/consignment.ts`, `apps/api/src/modules/consignment/http.ts`, `apps/crm-web/src/components/consignment/ConsignmentSiteDetail.tsx` | In-transit/open PO/receipt matching remains manual until Acumatica reads are certified |
| 5-business-day PO clock | The PO clock starts only after true-up confirms `po_required`; retries do not create duplicate PO follow-up work items | `apps/api/test/consignment.regression.test.mjs` | Acumatica PO/order posting remains parked; Pulse tracks the manual follow-up clock and optional external reference |
| Samantha/Ops work queue | Queue labels now show `True-up review needed` / `Review true-up` before PO follow-up, so operators see the next real job | `apps/crm-web/src/lib/pulse-api.ts`, `apps/crm-web/src/components/consignment/ConsignmentWorkspace.tsx` | Mailbox/provider automation remains parked; Pulse-owned work items stay visible |
| Process vocabulary | Site detail restores BLUE, ROSE, PURPLE, and SAND labels so the screen matches the documented consignment forms instead of generic form names | `apps/crm-web/src/components/consignment/ConsignmentSiteDetail.tsx` | PURPLE/SAND execution depth is still a later manual-boundary slice |

## Build-Now Slice Order

| Slice | Name | Status | Acceptance Criteria |
| --- | --- | --- | --- |
| CSG-1 | Site master and account flag | `Implemented` | Account profile/read model can show consignment participation; site list works without Acumatica access |
| CSG-2 | Onboarding and agreement register | `Implemented / Partial` | A customer can move to `ready_for_warehouse` without pretending a warehouse exists; full abandoned-onboarding reporting remains later |
| CSG-3 | Ops work queue and parked warehouse boundary | `Implemented / Partial` | Warehouse setup remains visible as parked/blocked; automation provider delivery remains parked |
| CSG-4 | ROSE scheduler and calendar source | `Implemented / Partial` | Completing an audit schedules the next ROSE due date; calendar now prefers durable `ConsignmentAudit` records with lead-backed hints only as fallback |
| CSG-5 | Audit/reconciliation foundation | `Implemented` | Audit can be complete while reconciliation is open |
| CSG-6 | PO follow-up clock | `Implemented / Partial` | True-up confirmation starts the manual PO follow-up clock/work item; variance alone opens a review, and escalation/mailbox automation remains parked |
| CSG-7 | PURPLE and SAND manual workflows | `Implemented / Partial` | Baseline-changing and exit events are tracked without ERP posting; remaining depth is evidence attachments, reporting, and Acumatica-certified posting |
| CSG-8 | Reporting scaffold | Samantha workbook replacement over Pulse-owned data, drilldowns, export-ready views | TM/Ops/RD/Exec can see site, audit, due, discrepancy, and PO status |

## Explicitly Parked Acumatica Items

| Parked Item | Why Parked | What To Build Now Instead | Resume From |
| --- | --- | --- | --- |
| Acumatica warehouse creation | Warehouse setup has financial/setup fields and restricted Acumatica permissions; endpoint behavior is not certified | `warehouse_pending` state, Acumatica warehouse ID placeholder, admin exception notes | Add warehouse sync adapter and validation once sandbox samples arrive |
| TR transfer order and receipt truth | Initial deployment and receipt are ERP-owned non-revenue inventory movements | Manual/imported transfer reference fields and readiness placeholders | Add transfer/receipt read model sync and contract tests |
| Inventory balance and SKU/barcode truth | Acumatica is inventory/product source of truth; barcode standard not signed off | Manual/imported baseline lines with stale-data/source notes | Add inventory snapshot sync after SKU mapping |
| Sales order / PO / invoice / credit memo posting | Financial truth and posted docs belong in Acumatica | PO follow-up state and external reference placeholders | Link or create ERP records only after endpoint certification |
| Live sales/inventory value reporting | Samantha reports use Acumatica exports; live numbers require certified reads | Report Pulse-owned statuses and imported/manual snapshots with freshness labels | Replace imported/manual values with read models |

## Resume Checklist When Acumatica Access Arrives

1. Confirm sandbox credentials, auth method, IP allow-list, rate limits, and tenant/company scope.
2. Obtain sample records for warehouse, location, TR transfer order, transfer receipt, inventory balance, sales order/PO, invoice, and credit memo.
3. Complete field mapping for customer ID, location ID, warehouse ID, SKU/product identity, transfer/receipt references, PO/order references, and credit memo references.
4. Record fixtures and build adapter contract tests before connecting production workflows.
5. Add sync status fields, last-synced timestamps, stale-data warnings, retry/dead-letter behavior, and manual recovery ownership.
6. Move parked rows in this map from `Parked` to active slices only after endpoint behavior is proven.

## Primary Regression Targets

- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/api build`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/api test:consignment`
- cross-checks when touched: account visibility tests, calendar event tests, RBAC denial tests

## Regression Status

The consignment regression suite now uses `apps/api/test/consignment.regression.test.mjs` as the DB-backed API/service entry point and `apps/api/test/consignment.service.regression.test.mjs` for deterministic cadence helpers. It follows the existing API harness and is shaped around the current contract/service paths:

- `packages/contracts/src/consignment.ts`
- `apps/api/src/modules/consignment/service.ts`
- `apps/api/src/modules/consignment/http.ts`
- `apps/api/src/modules/calendar/events.ts` for the consignment ROSE calendar event source

The suite covers site master creation, account read-model participation and counts, current document behavior, activation gating, onboarding state transitions, route/API create-read-filter-gate behavior, RBAC denial, TM/RD scoped reads and mutation denial, ROSE 90-day audit scheduling reset, operational queue audit-status filtering, true-up-gated PO follow-up creation, and the parked Acumatica warehouse boundary.

Current verification state:

- `pnpm --filter @pulse/api test:consignment` passes after building contracts/config/db/API, running the deterministic service helper suite, and running the 13 DB-backed consignment regressions.
- Durable consignment calendar event coverage now reads durable `ConsignmentAudit` records first and keeps lead-backed hints only as fallback for pre-site conversion visibility.
