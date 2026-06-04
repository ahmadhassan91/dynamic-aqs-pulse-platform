# UX-01 Slice A - Role-Based Workbench First Pass

Date: 2026-05-25

Status: `Implemented - awaiting browser/UAT visual pass`

## Scope

This slice starts the UX-01 Role-Based Workbench Optimization goal by applying the common principle across the developed CRM and mobile surfaces:

- default to the work surface instead of a broad overview
- keep one clear primary path
- move setup, reporting, migration, or parked dependency detail behind a quieter tab, toggle, or advanced section
- preserve backend-wired actions and audit/traceability access

## Implemented Changes

### Shared CRM Workbench Components

Added reusable CRM workbench primitives:

- `WorkbenchHeader`
- `WorkbenchMetricStrip`
- `WorkbenchAttentionPanel`
- `WorkbenchAdvancedSection`

Evidence:

- `apps/crm-web/src/components/ui/Workbench.tsx`

### Navigation

Aligned active navigation wording with the simplified operator flow:

- Product Management now points to `Catalog Readiness`, `Categories`, `Families`, `Dealer Views`, and `Admin Setup`.
- Digital Assets now points to `Asset Library`, `Share Sets`, `Needs Attention`, and `Advanced Import`.

Evidence:

- `apps/crm-web/src/components/layout/Navigation.tsx`

### Leads And Calendar

- Leads now defaults to the `Pipeline` work surface instead of the broad overview.
- Extra lead intake/routing explanation is hidden on the default pipeline view but remains available on other tabs.
- Calendar keeps `Schedule & Send Invite` as the primary action.
- Outlook/sync setup moved behind an explicit `Calendar Setup` toggle.

Evidence:

- `apps/crm-web/src/components/leads/LeadWorkspace.tsx`
- `apps/crm-web/src/components/calendar/CalendarWorkspace.tsx`

### Training

- Training now defaults to `Sessions`.
- First-screen metrics reduced from nine broad counts to four action-oriented counts.
- `Exceptions & Recertification` renamed to `Needs Attention`.
- Compliance reporting moved into a separate `Reports` tab.
- Catalog setup renamed to `Admin Setup`.

Evidence:

- `apps/crm-web/src/components/training/TrainingWorkspace.tsx`

### Product Management, Digital Assets, And Dealer Portal

- Product Management now defaults around `Catalog Readiness`.
- Standalone `Readiness` and `Publish` product tabs were consolidated into the primary readiness table and admin evidence.
- Legacy product file preview and source reconciliation moved to `Admin Setup`.
- Dealer catalog view matching internals moved behind `Advanced matching details`.
- Digital Assets now uses operator wording: `Add File Link`, `Upload Files`, `Share Sets`, `Needs Attention`, and `Advanced Import`.
- Asset detail keeps share and product usage prominent while Widen/source/version/storage details move behind advanced trace sections.
- Dealer Portal parked-commerce messaging is quieter and consolidated toward Account Health.

Evidence:

- `apps/crm-web/src/components/product-management/ProductManagementWorkspace.tsx`
- `apps/crm-web/src/components/product-management/ProductDetailWorkspace.tsx`
- `apps/crm-web/src/components/digital-assets/DigitalAssetsWorkspace.tsx`
- `apps/crm-web/src/components/dealer/DealerCatalog.tsx`
- `apps/crm-web/src/components/dealer/DealerCatalogProductDetail.tsx`
- `apps/crm-web/src/components/dealer/DealerAccountCenter.tsx`

### Consignment, Accounts, And Admin

- Consignment defaults to `Needs Attention`.
- Due audits, mailbox work, and site exceptions are surfaced as the operator lane.
- Dashboard-style consignment content moved under `Reports`.
- Customer list now includes a needs-attention queue for risk, missing territory, missing contacts, or missing locations.
- Customer detail opens with profile/action focus while readiness and parked dependency detail are expandable.
- Admin wording is now grouped around `User & Access`, `Access Profiles`, `Audit Monitor`, `Integrations`, and `Business Rules`.
- Catalog rules are reframed as Business Rules while technical input detail remains accessible.

Evidence:

- `apps/crm-web/src/components/consignment/ConsignmentWorkspace.tsx`
- `apps/crm-web/src/components/customers/CustomerList.tsx`
- `apps/crm-web/src/components/customers/CustomerDetail.tsx`
- `apps/crm-web/src/components/admin/AdminWorkspace.tsx`
- `apps/crm-web/src/components/admin/AdminCatalogRulesWorkspace.tsx`

### Mobile

- Bottom tabs compressed to `Today`, `Route`, and `More`.
- Leads, Accounts, Voice Notes, Consignment, Training, OCR, Sync Status, and Asset Library remain reachable.
- Today now has a first-screen field action hierarchy for Route, Sync, Scan Card, Voice Note, ROSE Audit, and Training.
- The old Asset tab is now `More`, with capture/review actions, work queue launchers, and the existing Asset Library below.

Evidence:

- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/app/(tabs)/assets.tsx`

## Verification

Passed:

```bash
pnpm --filter @pulse/crm-web typecheck
pnpm --filter @pulse/crm-web lint
pnpm --filter @pulse/mobile typecheck
pnpm --filter @pulse/mobile lint
git diff --check
```

## Quality Gate Notes

- Prototype shells and existing routes were preserved.
- No implemented API-backed flow was replaced with mock behavior.
- Parked dependencies remain visible where they affect trust.
- Audit/RBAC/source evidence remains available behind tabs, advanced sections, reports, or detail views.
- The slice reduces default clutter without claiming Acumatica, Widen migration, route optimization, pricing, inventory, true impersonation, or full offline conflict resolution are complete.

## Remaining UX-01 Work

This is a broad first pass, not completion of UX-01.

Next recommended slice:

1. Browser/Playwright visual QA of each changed module as Super Admin, TM/RD, Ops, Dealer, and Mobile field user.
2. Refine any screens where the first viewport still exceeds UX-01 rules.
3. Move from wording/default improvements into deeper layout convergence on the shared workbench components.
4. Add regression coverage for tab routing defaults and hidden-but-reachable module routes.
