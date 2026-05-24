# Dependency-Free UAT Readiness Plan

Date: 2026-05-24

## Target

Get Pulse CRM to roughly 70-75% practical readiness before Acumatica sandbox access and real production data are available. The goal is not to fake ERP truth. The goal is to make every Pulse-owned workflow usable enough that Dynamic AQS can test flow, language, permissions, and usability now.

## Principle

If the source of truth is Acumatica, Widen export, Shopify export, or a signed migration workbook, Pulse should show the boundary clearly and stop before pretending the data is final. If the source of truth is CRM workflow, task ownership, visibility, review, file sharing, or audit evidence, Pulse should build and test it now.

## Build-Now Scope

| Slice | What Dynamic can test now | Completion target before access |
| --- | --- | --- |
| UAT data pack | Realistic dealers, TM/RD ownership, affinity, ownership/PE, hybrid, independent, catalog views, products, assets, dealer portal status | Seeded with `pnpm seed:uat`; demo data is clearly marked `UAT` |
| Product/catalog usability | Catalog views first, product setup second, categories/families explained as organization only | Users should understand who sees what without knowing schema terms |
| Digital assets | Approved dealer-safe assets, stable asset records, product assignment, external-link placeholder behavior, share-link workflows | Usable for file library and dealer/customer sharing tests |
| Dealer portal | Login, dashboard, account context, catalog browsing, product detail, favorite/open asset events, internal support/preview | Dealer flow works with seeded catalog/account data |
| Leads | Intake, OCR/manual capture, duplicate review, routing, queue, readiness, CRM customer-record boundary | Avoid claiming ERP order/customer truth |
| Territory | TM/RD scoping, assignment, transfer, account ownership, map/list flows | Provider route optimization remains parked |
| Training | Scheduling, check-in/out, proof upload, certification/recertification queues, reporting scopes | External training provider coexistence remains parked |
| Consignment | Site master, document register, ROSE audit scheduling/execution, evidence upload, variance/PO follow-up shell | Warehouse, inventory, transfer/receipt, PO, financial truth remain parked |
| Mobile | Login, lead inbox/detail, route/check-in, training execution, ROSE audit, asset cache/share, notifications shell, offline queue visibility | Offline media durability and route optimization remain later hardening |

## Parked Boundaries

| Boundary | Why parked | Resume when |
| --- | --- | --- |
| Product CSV final import/apply | Prototype CSV can inform preview, but cannot become production product truth without certified SKU, inventory ID, UOM, item class, item status, sellable state, pricing, and reconciliation rules | Acumatica sandbox access, representative product samples, and signed mappings are available |
| Price class and pricing display | Price class is ERP-governed and can create serious commercial mistakes if guessed | Acumatica pricing endpoint behavior and dealer pricing rules are certified |
| Acumatica first-order handoff | Orders, inventory, customer IDs, pricing, warehouse, tax, invoices, and payments are ERP truth | Sandbox access and endpoint certification are complete |
| Consignment warehouse/inventory/PO execution | Warehouse setup, inventory movements, transfer/receipt, PO, and settlement are ERP truth | Warehouse and inventory mappings plus recovery rules are signed |
| Real Widen/legacy asset migration | Legacy metadata may be inconsistent; migration strategy is not fully confirmed | Export sample, metadata map, redirect/link strategy, and curated manifest are approved |
| Route optimization | Provider, billing, geocode quality, optimization rules, and map quota decisions are not final | Provider and billing owner are approved |
| Production identity/security hardening | UAT can use controlled accounts, but production needs MFA/lockout/secret rotation/monitoring signoff | Before external pilot or production launch |

## UAT Seed Data

Use:

```bash
pnpm db:migrate
pnpm seed:uat
```

This creates dependency-free demo data:

- `UAT Nexstar Comfort` as an affinity-only dealer.
- `UAT Redwood HVAC` as an ownership/PE-only dealer.
- `UAT Hybrid Dealer` as both affinity and ownership/PE.
- `UAT Independent Air` as independent.
- One UAT region, one UAT territory, one TM, one RD, and one shipping center.
- Four dealer catalog views: standard, affinity, ownership/PE, independent.
- Two published dealer-visible products with approved asset assignments.
- Active catalog rules for affinity, ownership/PE, independent, hybrid-review, and fallback catalog resolution.
- Active catalog snapshots for the four UAT catalog views.
- Dealer portal account records and dealer login users marked active.
- One scheduled UAT training session for TM/RD field execution.

Seeded UAT credentials:

| Persona | Email | Password |
| --- | --- | --- |
| Super Admin seed operator | `uat.seed@pulse.local` | `PulseUatInternal123!` |
| Territory Manager | `tammy.tm@pulse.local` | `PulseUatInternal123!` |
| Regional Director | `riley.rd@pulse.local` | `PulseUatInternal123!` |
| Affinity dealer | `owner+nexstar@pulse-uat.local` | `PulseUatDealer123!` |
| Ownership/PE dealer | `owner+redwood@pulse-uat.local` | `PulseUatDealer123!` |
| Hybrid dealer | `owner+hybrid@pulse-uat.local` | `PulseUatDealer123!` |
| Independent dealer | `owner+independent@pulse-uat.local` | `PulseUatDealer123!` |

The seed is intentionally marked `UAT` and should not be mistaken for migrated production data.

Validation gate:

```bash
pnpm --filter @pulse/api test:uat-readiness
```

This proves the seed creates usable internal/dealer personas, published catalog state, rule-based dealer visibility, hybrid review blocking, active snapshots, and a scheduled training session without Acumatica.

## QA Persona Matrix

| Persona | Must test |
| --- | --- |
| Super Admin | Create/edit catalog views, preview legacy product file, publish catalog snapshot, manage users/roles, view parked boundaries |
| Regional Director | Territory visibility, training reporting, reassignment scope, dealer/account context |
| Territory Manager | Lead follow-up, route/check-in, account detail, training execution, consignment ROSE audit, mobile sync |
| Dealer User | Portal login, dashboard, account center, catalog visibility, product detail, asset open/favorite/share |
| Dynamic Support User | Internal preview/support flow for dealer portal and account context without corrupting dealer records |

## Readiness Verdict

Before Acumatica and real data, Pulse should be judged as:

- **Internal UAT ready** when seeded data supports the core user journeys and Browser/Playwright regression passes.
- **Pilot ready** only after Dynamic signs off module language, permissions, and UAT data flows.
- **Production ready** only after Acumatica, migration, identity/security, monitoring, backups, rollback, and external-user support gates are complete.
