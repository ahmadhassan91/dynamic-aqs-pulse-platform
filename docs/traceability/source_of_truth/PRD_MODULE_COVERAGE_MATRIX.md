## PRD Module Coverage Matrix

Date: 2026-03-30

This matrix translates the current PRD pack into the 20-module WBS structure. It is based on:
- `docs/roadmap/PRD_COMPLETENESS_AUDIT_2026-03-29.md`
- `docs/roadmap/PRD_CONSOLIDATION_COMPLETE.md`
- `docs/roadmap/prds/`

Key conclusion:
- All 20 WBS modules are covered somewhere in the PRD pack.
- The pack is not 1:1 with the WBS. It uses 15 master PRDs plus supplements and shared documents.
- Several modules are covered only partially or through shared artifacts rather than a standalone development-ready PRD.

Readiness legend:
- `Ready` = good enough to start build with normal clarification flow
- `Mostly Ready` = usable, but still needs targeted elaboration
- `Partial` = scope exists, but not strong enough for build handoff
- `Needs Expansion` = explicit audit gap before development
- `Coverage Only` = referenced in supporting docs, but no strong standalone PRD baseline

| WBS Module | Primary PRD Assets | Coverage Shape | Readiness | Notes |
| --- | --- | --- | --- | --- |
| Program Foundation & Solution Architecture | `FOUNDATION_SECURITY_ADMIN_PRD.md`, `FOUNDATION_SECURITY_ADMIN_SUPPLEMENT.md` | Shared foundational coverage | Partial | Covered through foundation/admin/security docs, not its own standalone module PRD. |
| Security, Identity, Environments & DevOps | `FOUNDATION_SECURITY_ADMIN_PRD.md`, `FOUNDATION_SECURITY_ADMIN_SUPPLEMENT.md`, `ROLE_BASED_VISIBILITY_REQUIREMENTS.md` | Shared foundational coverage | Partial | BA closure pass added governance, entitlement, sandbox, and sensitive-data controls; remaining gaps are mostly security-policy decisions rather than missing core scope. |
| QA, UAT, Rollout & Adoption | `FULL_RELEASE_PLAN.md`, `PRD_COMPLETENESS_AUDIT_2026-03-29.md` | Program/release documentation | Coverage Only | Delivery and rollout logic exists, but not as a dedicated standalone product PRD. |
| Master Data, Admin Settings & Configuration | `FOUNDATION_SECURITY_ADMIN_PRD.md`, `FOUNDATION_SECURITY_ADMIN_SUPPLEMENT.md` | Shared foundational coverage | Partial | Covered inside foundation/admin documents, not separated as an independent PRD. |
| Acumatica Integration & Data Migration | `ACUMATICA_INTEGRATION_PRD.md` | Standalone PRD | Ready | One of the strongest modules in the audit. |
| Territory Management & Field Routing | `TERRITORY_MANAGEMENT_PRD.md` | Standalone PRD | Mostly Ready | BA closure pass added schedule-first routing, mixed-stop planning, overlay ownership, authorship preservation, and office-side map usage. |
| Mobile Field App | `MOBILE_APP_PRD.md`, `MOBILE_APP_SUPPLEMENT.md` | PRD + supplement | Ready | One of the strongest modules in the audit. |
| Communication, Notifications & Alerts | `ALERTS_NOTIFICATIONS_COMMUNICATION_PRD.md` | Standalone PRD | Mostly Ready | BA closure pass added stage-transition, credit-hold, consignment-cadence, order, and mobile-assignment alert detail; remaining gaps are primarily routing/escalation policy choices. |
| Lead Capture & Lead Management | `LEAD_CAPTURE_MANAGEMENT_PRD.md` | Standalone PRD | Ready | Strong development-start candidate. |
| CIS, Credit & Onboarding Workflow | `CIS_CREDIT_ONBOARDING_PRD.md` | Standalone PRD | Mostly Ready | Audit rates this as mostly usable, but not fully complete. |
| Customer, Account, Contact & Multi-Location Management | `CUSTOMER_ACCOUNT_CONTACT_PRD.md` | Standalone PRD | Partial | Covered, but not yet development-ready. |
| Dealer Portal Replacement for Shopify | `DEALER_PORTAL_REQUIREMENTS.md`, `DEALER_PORTAL_ENHANCEMENT_PLAN.md` | PRD + enhancement plan | Partial | Covered, but still below code-ready level. |
| Pricing & ERP-Dependent Commercial Rules | `PRICING_COMMERCIAL_RULES_PRD.md` | Standalone PRD | Mostly Ready | BA closure pass clarified ERP truth, wildcard pricing, PO-backed checkout, base-price display, fallback class handling, and invoice pushback boundaries. |
| Training Management | `TRAINING_MANAGEMENT_PRD.md` | Standalone PRD | Mostly Ready | BA closure pass added catalog governance, cadence exceptions, mobile structured capture, contest/value tracking, and role-based KPI views. |
| Reports & Analytics | `REPORTING_REQUIREMENTS_MASTER.md` | Standalone PRD | Ready | One of the strongest modules in the audit. |
| Commercial CRM Enablement | `MODULE_BY_MODULE_PRD_PACK.md` | Shared pack coverage | Coverage Only | Covered at pack level, but no strong standalone PRD for this module. |
| Product Management & Dealer Catalog Governance | `PRODUCT_MANAGEMENT_PRD.md`, `PRODUCT_MANAGEMENT_ENHANCEMENT_PLAN.md` | PRD + enhancement plan | Mostly Ready | Audit rates Product as usable but still short of fully ready. |
| Digital Assets & Document Handling | `DIGITAL_ASSETS_DOCUMENTS_PRD.md` | Standalone PRD | Mostly Ready | BA closure pass added Widen-behavior preservation, mandatory metadata, link-first sharing, access-mode separation, and mobile quick-share expectations. |
| Consignment Management | `docs/client-scope-confirmation-2026-04-20/05_CONSIGNMENT_PRD.md`, `CONSIGNMENT_STAKEHOLDER_SWIMLANE.md` | Copied working PRD + source swimlane | Mostly Ready | BA closure pass clarified warehouse-setup sequence, BLUE/PURPLE semantics, shared-mailbox operations, on-site audit mode, and formal exit handling. Pulse-owned workflow, audit, document, calendar, and dashboard scope is build-ready; Acumatica execution for warehouse, inventory, transfer/receipt, PO, and financial truth is parked until sandbox access and certified mappings are available. |
| Executive Dashboard | `REPORTING_REQUIREMENTS_MASTER.md`, `WEB_DASHBOARD_SUPPLEMENT.md` | Shared reporting coverage | Partial | Covered through reporting/dashboard artifacts, not a clean standalone PRD. |

## Summary

- `Ready`: 4 modules
- `Mostly Ready`: 8 modules
- `Partial`: 6 modules
- `Needs Expansion`: 0 modules
- `Coverage Only`: 2 modules

## Practical Interpretation

- Scope coverage exists across the whole program.
- You do not yet have a complete standalone development-ready PRD against every WBS module.
- The biggest remaining gaps are no longer broad missing scope; they are policy decisions, module separation, and final traceability/detail closure.
- The clearest items still needing stakeholder decisions are now concentrated in Security policy, territory assignment precedence, alert escalation policy, training website/contact model, Widen replacement timing, and selected consignment policy choices.

## Recommended Next Step

Create a 1:1 WBS-to-PRD traceability matrix with these columns:
- `WBS Module`
- `WBS Story / Task`
- `PRD File`
- `PRD Section`
- `Coverage Status`
- `Open Questions`
- `Action Required`
