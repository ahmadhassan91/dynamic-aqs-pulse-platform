# Consignment Build-Now Vs Acumatica-Parked Plan

Date: 2026-04-30

This is the delivery plan for starting Consignment without waiting for Acumatica access. It uses the copied PRD at `docs/client-scope-confirmation-2026-04-20/05_CONSIGNMENT_PRD.md` and the requirements map at `docs/requirements-mapping/CONSIGNMENT_REQUIREMENTS_MAP_2026-04-30.md`.

## Decision

Build the Pulse-owned workflow foundation now. Park Acumatica-owned execution and posted financial/inventory truth until Dynamic AQS provides sandbox access, sample data, certified endpoint behavior, and signed field mappings.

## Why We Are Parking Some Items

Acumatica is the system of record for consignment warehouse setup, inventory balance, TR transfer orders, transfer receipts, sales orders/POs, invoices, credit memos, and posted settlement. Building fake versions of those inside Pulse would create double truth and would make Samantha's reporting less trustworthy, not more.

The parked items are not rejected scope. They are documented as resumable integration slices so development can continue on workflow, visibility, audit, document, and reporting structure while waiting for the dependency.

## Build Now

| Slice | Name | What We Build Now | Key Files When Implemented |
| --- | --- | --- | --- |
| `CSG-P1` | Site master | `Implemented` - durable `ConsignmentSite` linked to `Account` and `AccountLocation`; status, TM/RD, address/contact, warehouse reference placeholder, active/exited/onboarding state | `packages/db/prisma/schema.prisma`, `packages/contracts/src/consignment.ts`, `apps/api/src/modules/consignment/` |
| `CSG-P2` | Account flag | `Implemented / Partial` - account read model exposes consignment participation and active/onboarding/exited counts; UI drilldown remains polish/validation work | `packages/contracts/src/accounts.ts`, `apps/api/src/modules/accounts/`, `apps/crm-web/src/components/customers/` |
| `CSG-P3` | Document/form register | `Implemented / Partial` - agreement/BLUE register has status/version/current-reference behavior; broader form-family workflow shells remain later | `packages/contracts/src/consignment.ts`, `apps/api/src/modules/consignment/`, `apps/api/src/modules/documents/` |
| `CSG-P4` | Onboarding readiness | `Implemented / Partial` - readiness, activation gates, and blocked warehouse boundary are live; abandoned-state reporting remains later | `apps/api/src/modules/consignment/`, `apps/api/src/queue/` |
| `CSG-P5` | Role visibility | `Implemented` - TM assigned-site reads, RD scope, Ops/Admin management, Exec view-only behavior, and denial regressions are covered | `packages/contracts/src/auth.ts`, `apps/api/src/modules/consignment/` |
| `CSG-P6` | Audit scheduler/calendar | `Implemented / Partial` - 90-day ROSE cadence, audit reset, and durable `ConsignmentAudit` calendar reads are implemented; provider sync/status depth remains later | `apps/api/src/modules/calendar/`, `packages/contracts/src/calendar.ts` |
| `CSG-P7` | Web dashboard shell | Backend-fed consignment list/detail, readiness cards, form status, next/last audit, parked-Acumatica badges | `apps/crm-web/src/app/consignment/`, `apps/crm-web/src/components/consignment/` |
| `CSG-P8` | UAT/regression pack | Backend tests for site master, account flag/read model, form register, onboarding, scheduler, RBAC, and parked dependency behavior | `apps/api/test/consignment.regression.test.mjs`, `pnpm --filter @pulse/api test:consignment` |

## Park Now

| Parked Slice | Dependency | Why Parked | Resume Trigger |
| --- | --- | --- | --- |
| Live warehouse creation/sync | Acumatica warehouse APIs | Warehouse setup has ERP setup and financial implications; Samantha confirmed this should normally be Acumatica-first | Sandbox access, endpoint certification, field mapping, admin exception policy |
| TR transfer and receipt sync | Acumatica transfer/order/receipt APIs | Initial deployment cannot be truthfully marked received from Pulse alone | Sample transfer/receipt records and adapter contract tests |
| Inventory balance and barcode/SKU truth | Acumatica inventory/product APIs plus barcode policy | Audit expected quantities and scan matching need authoritative item identity | SKU/barcode mapping and inventory balance endpoint certification |
| PO/sales order link or creation | Acumatica sales order / PO flow | The 5-day PO clock can be tracked in Pulse, but posted PO/order truth is ERP-owned | PO/order endpoint certification and partial-PO policy |
| Invoice, credit memo, settlement, write-off | Acumatica finance truth | Pulse can track closure evidence, not post financial settlement without ERP contract | Finance policy plus invoice/credit memo endpoint certification |
| Live sales/inventory value reporting | Acumatica reporting/read models | Samantha's workbook currently depends on ERP exports; Pulse can report workflow state now, not live financial/inventory truth | Certified sales/inventory read models and freshness SLA |
| Mailbox automation | Email/provider access | Pulse can model work items manually first; ingestion/send automation needs provider access | Approved mailbox provider and service account |
| E-signature | Vendor/legal policy | Upload/manual status can work now; legal e-sign ceremony needs provider/policy | E-sign provider and retention/legal decision |

## Resume Plan When Access Arrives

1. Add Acumatica fixtures for warehouse, transfer order, receipt, inventory balance, sales order/PO, invoice, and credit memo.
2. Build adapter contract tests before changing user-facing behavior.
3. Add read-model tables or fields with `sourceRef`, `syncStatus`, `lastSyncedAt`, `lastError`, and stale-data warnings.
4. Replace manual/placeholder ERP references one boundary at a time: warehouse, transfer/receipt, inventory snapshot, PO/order, finance settlement.
5. Update the requirements map and delivery tracker row from `Parked` to `In Progress` only for the specific certified endpoint.

## First Implementation Slice

Start with `CSG-P1 + CSG-P2 + CSG-P3` as one backend-first foundation:

- site master
- account/location consignment flag and drilldown
- document/form register

This slice creates the durable anchor for every later workflow while keeping Acumatica truth clearly parked.

## Acceptance Criteria For First Slice

- A consignment site can be created for an account/location without an Acumatica warehouse ID, but it cannot be marked active without required readiness evidence or an explicit admin exception.
- Account detail can show whether the customer participates in consignment and link to related site records.
- Agreement and BLUE/ROSE/PURPLE/SAND form events can be created, updated, listed, and audited.
- TM/RD/Ops visibility is enforced by API tests, not UI hiding alone.
- User-facing copy shows Acumatica-backed fields as pending/unavailable instead of fabricated.

## Regression Contract Status

The API regression scaffold at `apps/api/test/consignment.regression.test.mjs` is now executable against the current consignment module paths, with helper cadence coverage in `apps/api/test/consignment.service.regression.test.mjs`. The current suite covers:

- site master and account consignment read model
- document/form register
- onboarding readiness transitions
- RBAC denial
- ROSE audit scheduling
- parked Acumatica boundary without fabricated ERP references
- route/API create, list, readiness, document, activation-gate, and account read-model behavior
- activation gating, current-document behavior, TM/RD scope denial, account read-model counts, and operational queue audit-status filtering

Verification status on 2026-04-30:

- `pnpm --filter @pulse/api test:consignment` passes after building contracts/config/db/API, running the deterministic service helper suite, and running the 12 DB-backed consignment regressions.
- Durable calendar event coverage now prefers `ConsignmentSite` / `ConsignmentAudit` records, with lead-backed hints only as fallback where no durable site exists.
