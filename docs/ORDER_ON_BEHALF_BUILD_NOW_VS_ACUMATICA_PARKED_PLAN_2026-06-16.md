# Order On-Behalf Build-Now Vs Acumatica-Parked Plan

Date: 2026-06-16

Delivery plan for the in-app, on-behalf-of-customer ordering feature (a Territory Manager places an
order *for* a customer from the field) without waiting for Acumatica access. It implements the
requirement captured in `docs/client-scope-confirmation-2026-04-20/08_MOBILE_FIELD_APP_PRD.md`
(FR-MOB-047, open question OQ-MOB-10), the ordering channel in
`docs/client-scope-confirmation-2026-04-20/12_DEALER_PORTAL_ORDERING_PRD.md`, and the system-of-record
boundary in `docs/client-scope-confirmation-2026-04-20/15_ACUMATICA_INTEGRATION_PRD.md` (FR-ACU-024,
SRC-ACU-009). It mirrors the structure of `docs/CONSIGNMENT_BUILD_NOW_VS_ACUMATICA_PARKED_PLAN_2026-04-30.md`.

Business priority: CG twice called this "critical" (Session 10); Don asked for it verbatim. It is the
TM-in-field channel of four order-entry paths the business described — dealer-portal self-service,
staff email, TM-in-field (this feature), and phone/in-person.

## Build Status (2026-06-18)

**ORD-P1 + ORD-P2 + ORD-P3 SHIPPED** (commit 0682328, branch `codex/entra-calendar-governance`) — the durable backend foundation:
- **ORD-P1** — `OrderDraft` + `OrderDraftLine` Prisma models + migration `20260618170704_add_order_drafts`. Money is integer cents; `subtotalCents` is an explicitly best-effort estimate (BaseProduct has no price). **Status enum simplified to `DRAFT → SUBMITTED → FULFILLED | CANCELLED`** rather than the originally-sketched `SENT_TO_ERP → PLACED/REJECTED` — those ERP-coupled states belong to the parked Acumatica slices; `FULFILLED` is the manual back-office stand-in until the order boundary is wired, `CANCELLED` is the abandon path.
- **ORD-P2** — `@pulse/contracts/orders` (summary/detail/line + create/update/submit/cancel request types; lowercase status-key union mirroring the Prisma enum), registered in the contracts barrel + `package.json` exports.
- **ORD-P3** — governed API module `apps/api/src/modules/orders/` (service + http, wired into `server.ts`). New `orders` module-key + `order.view`/`order.create`/`order.submit` actions; TM/RD record-scoping reuses account scope (own-created OR); lifecycle transitions use atomic `updateMany` status guards; line builder caps qty/price and guards cumulative subtotal against INT4 overflow; full audit incl. changed header fields. **Regression contract delivered**: `apps/api/test/orders.regression.test.mjs` (8 cases). Verified green alongside RBAC (12) + auth-admin (2) + contracts type-check, after an adversarial multi-lens review.

**ORD-P4 SHIPPED** (commit 4e4f649) — mobile capture UI. "Order drafts" section + "New order" entry point on the account screen (refreshes on focus); capture screen (`apps/mobile/app/order-draft.tsx`) with catalog + custom lines, quantity steppers, ship-to picker, customer PO + office notes, Save-draft / Submit, and a read-only + Cancel view for submitted orders; a debounced catalog-search sheet backed by a self-contained `GET /api/v1/order-products` (added under the `orders` module, gated `order.create`, so a TM searches products without the full `product_management` workspace — fix for a review finding that the picker would 403 for every TM). Pure form logic in `src/lib/order-draft-form.ts` (10 unit tests). Verified: mobile typecheck clean, 123 mobile unit tests, 9 API regression cases.

**ORD-P6 SHIPPED** (commit 53e594c) — web back-office triage queue. A status-filtered queue of submitted order drafts at `/orders` (crm-web), gated to the `orders` module + `order.view`; office staff open a review modal (account, lines, notes, ship-to) and **Mark fulfilled** (keyed into Acumatica) or **Cancel** with a reason. Files: `apps/crm-web/src/components/orders/OrderTriageQueue.tsx`, `src/lib/pulse-api-ext-orders.ts`, `src/app/orders/`, plus an "Orders" sidebar entry. Required syncing the frontend `auth-catalog.ts` mirror to the backend (`orders` module + `order.*` actions). Review fix: cancel now requires `order.submit` (backend + UI) so the two triage actions share one capability. Verified: api build + 9 orders regression cases, crm-web typecheck + eslint clean, two-reviewer adversarial pass.

**NOT yet built:** ORD-P5 (first-order signal into `convertLeadOnFirstOrder`). The Acumatica-side slices remain parked per below.

## Decision

Build the Pulse-owned on-behalf **order intent** now (a CRM-owned `OrderDraft` the TM assembles and
submits for back-office placement, with status tracked in Pulse). Park the actual Acumatica order
placement, ERP customer creation, and authoritative price/tax/total until Dynamic AQS provides
Acumatica sandbox access, certified `SalesOrder`/`Customer`/`StockItem` endpoint behavior, a real
product/price sync, signed field mappings, and the on-behalf business rules (OQ-MOB-10).

The draft never claims to *be* the ERP order — it is a clearly-labeled captured intent until the
Acumatica order boundary is wired.

## Why We Are Parking Some Items

Acumatica is the system of record for orders, order numbers, and finance (SRC-ACU-009: "customer
created in Acumatica only when first order is placed; Pulse pushes customer data to Acumatica;
numbers/orders stay in Acumatica"). Verified in code as of 2026-06-16:

- There is **no orders module** today — neither `apps/api/src/modules/orders` nor
  `packages/contracts/src/orders.ts` exist.
- The Acumatica client (`packages/acumatica/src/client.ts`) is a generic REST scaffold pointed at the
  placeholder host `https://example.acumatica.local`, with no `createSalesOrder`/`createCustomer`
  methods.
- `BaseProduct` (`packages/db/prisma/schema.prisma`, model `BaseProduct`) has **no price field** and
  `sourceOfTruthSystem = ACUMATICA`; `product-management` blocks legacy CSV from becoming
  dealer-facing/orderable truth before Acumatica reconciliation.
- The first-order seam already exists as an explicit stub: `convertLeadOnFirstOrder`
  (`apps/api/src/modules/leads/readiness.ts`) throws *"firstOrderConfirmedAt is required until the
  Acumatica order boundary is wired."*
- `apps/api/src/modules/accounts/service.ts` already renders orders/invoices/pricing as parked-until-Acumatica.

Building a fake order placement, fake ERP customer creation, or fake authoritative pricing inside Pulse
would create double truth — exactly what the codebase deliberately avoids. The parked items are not
rejected scope; they are resumable integration slices so build can continue on capture, workflow,
visibility, audit, and back-office structure while the dependency is pending.

## Build Now

| Slice | Name | What We Build Now | Key Files When Implemented |
| --- | --- | --- | --- |
| `ORD-P1` | Order draft model | `OrderDraft` + `OrderDraftLine` Prisma models owned by the CRM: `accountId`, `createdByUserId` (the TM acting on-behalf), status enum `DRAFT → SUBMITTED → SENT_TO_ERP → PLACED/REJECTED`, billing/shipping refs (reuse `AccountLocation`), line items referencing existing `BaseProduct` by SKU/`acumaticaInventoryId` + quantity + capture notes, an indicative-only note (NO authoritative price/tax/total), `submittedAt`, nullable `acumaticaOrderRef` for later reconciliation | `packages/db/prisma/schema.prisma` |
| `ORD-P2` | Orders contract | `packages/contracts/src/orders.ts` — Create/Update/AddLine/Submit/List/Get `OrderDraft` request+response types, price-less and indicative-only, mirroring `leads.ts`/`accounts.ts`; registered in the contracts index | `packages/contracts/src/orders.ts`, `packages/contracts/src/index.ts` |
| `ORD-P3` | Orders API module | `apps/api/src/modules/orders` (`service.ts` + `http.ts`) following the leads/accounts pattern: RBAC via `assertModuleAccess`/`assertActionAccess`, TM book-scoping (a TM only orders for accounts in their book), audit via `buildAuditEntryData`. Product picker reads published price-less `BaseProduct`s. Submit transitions status + writes audit; it does **not** call Acumatica | `apps/api/src/modules/orders/` |
| `ORD-P4` | Mobile capture | "Order on behalf" entry point on `apps/mobile/app/account/[id].tsx`, an order-draft screen (line add / qty / notes / address pick), and `api.ts` client functions (`createOrderDraft`/`addLine`/`submitOrderDraft`/`listAccountOrderDrafts`). Offline-friendly draft like the existing voice-note capture | `apps/mobile/app/account/[id].tsx`, `apps/mobile/src/lib/api.ts` |
| `ORD-P5` | First-order signal | When an `OrderDraft` for a still-lead account is SUBMITTED, allow it to satisfy `convertLeadOnFirstOrder`'s `firstOrderConfirmedAt` internally (replacing the manual date) — behind a feature flag so it stays a CRM intent, not an ERP confirmation. Replaces the `readiness.ts` stub WITHOUT claiming ERP placement | `apps/api/src/modules/leads/readiness.ts`, `apps/api/src/modules/orders/` |
| `ORD-P6` | Back-office triage | A crm-web queue for office staff to review/triage submitted drafts and key them into Acumatica manually until the API is live (mirror `LeadFinanceQueue`) | `apps/crm-web/src/components/orders/` |

## Park Now

| Slice | Name | What Is Parked | Dependency |
| --- | --- | --- | --- |
| `ORD-K1` | Acumatica SalesOrder + Customer create | Extend the `packages/acumatica` client with `createSalesOrder()`/`createCustomer()` against real certified endpoints; only then can a draft actually be PLACED and a brand-new customer auto-created in the ERP (the `readiness.ts` stub stays a stub for true ERP placement) | Acumatica sandbox/instance, certified `SalesOrder`/`Customer` endpoints, credentials, signed field mappings |
| `ORD-K2` | Product / price / tax / shipping truth | Authoritative line pricing, tax, and freight cannot be computed in-app — `BaseProduct` has no price and legacy CSV is blocked from becoming orderable truth. The draft stays explicitly indicative/price-less until this lands | Acumatica product + price sync (`PULSE_PRODUCT_IMPORT_ACUMATICA_*` fed real data) |
| `ORD-K3` | Acumatica-as-source order reflection | "Orders reflected from Acumatica" — an inbound sync/webhook + an Order read model fed FROM Acumatica; populate `acumaticaOrderRef` on reconciliation | Same ERP access + a sync worker (the `accounts/service.ts` parked placeholder) |
| `ORD-K4` | Daily order digest | Once-a-day digest of the day's placed orders for TMs (Mobile PRD §13). Explicitly NOT a per-order email (a per-order Acumatica alert once buried Brett under ~30 emails) | Depends on ORD-K3 (orders reflected from Acumatica) |

## Resume Plan When Access Arrives

When the Acumatica sandbox, certified `SalesOrder`/`Customer`/`StockItem` endpoints, and the
product/price sync land:

1. Wire `createSalesOrder()`/`createCustomer()` into Submit so the draft transitions
   `SUBMITTED → SENT_TO_ERP → PLACED/REJECTED`, populating `acumaticaOrderRef`. First-order submission
   also creates the Acumatica customer and pushes contact data (SRC-ACU-009).
2. Enable real price/tax/freight on the draft (or a confirmation step) once product/price truth exists;
   only then may the UI show authoritative totals.
3. Add the inbound Acumatica → Pulse order reflection (ORD-K3) and turn on the daily digest (ORD-K4).
4. Replace the `ORD-P5` feature-flagged internal first-order signal with the real ERP placement
   confirmation as the lead-conversion trigger.

## First Implementation Slice

`ORD-P1` + `ORD-P2` + `ORD-P3` — the durable backend foundation (model + contract + governed API),
then `ORD-P4` (mobile capture). `ORD-P5` and `ORD-P6` follow once the draft lifecycle is solid.

## Acceptance Criteria For First Slice

- `OrderDraft`/`OrderDraftLine` persist with the full status lifecycle; lines reference real
  published `BaseProduct`s by SKU.
- Create/AddLine/Update/Submit/List/Get flow through the governed Pulse API with RBAC
  (`assertModuleAccess`/`assertActionAccess`), TM book-scoping, and audit entries.
- Submit transitions status and writes an audit entry; it does **NOT** call Acumatica.
- The draft never computes or displays an authoritative price/tax/total, and never sets
  `Account.lastOrderAt` (or any "order placed" truth) as if an ERP order occurred.
- A new `orders` regression suite is added; the existing accounts/leads/consignment regression suites
  stay green.

## Critical Honesty Constraint

The buildable draft must remain a clearly-labeled **intent**. It must not compute or display an
authoritative price/tax/total, and must not set `Account.lastOrderAt` as if an ERP order occurred —
until the Acumatica order-create API is live. The existing code deliberately avoids "pretending
Acumatica truth," and this feature must respect that line.

## Open Decisions (client / product)

- `OQ-MOB-10` — is an in-app order submission screen required at launch, post-launch, or deferred to
  the dealer portal, and which API governs it?
- On-behalf business rules — who may order for whom, credit/finance gating (using existing
  `CisFinanceDecision` `creditLine`/`paymentTerms`), and whether a price is ever shown to the TM. These
  must be confirmed before the draft semantics are finalized.

## Regression Contract Status

`Delivered (ORD-P1–P3, 2026-06-18)` — `packages/contracts/src/orders.ts` and
`apps/api/test/orders.regression.test.mjs` (8 cases) now exist and pass; the Acumatica-side slices
(`ORD-K1`..`ORD-K4`) remain parked with no fabricated ERP references, consistent with FR-ACU-024 and the
consignment Acumatica boundary.
