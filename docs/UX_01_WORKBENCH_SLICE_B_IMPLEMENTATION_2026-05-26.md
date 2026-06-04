# UX-01 Slice B - Shared Workbench Convergence

Date: 2026-05-26

Status: `Implemented and Playwright verified`

## Scope

This slice continued the UX-01 cleanup by moving the developed CRM module pages closer to the shared role-based workbench contract.

The main intent was to reduce first-screen clutter without removing traceability, audit evidence, parked-dependency visibility, or backend-wired actions.

## Research Applied

External UX guidance reinforced the direction:

- Tableau dashboard guidance says dashboards should be built for a clear audience and purpose, with a limited number of high-value views instead of every available metric.
- Salesforce Lightning Design System data guidance recommends tables for larger record sets, while tiles/cards should stay limited to short lists.
- IBM progressive disclosure guidance recommends showing only the essentials for the current task first, then revealing deeper detail as the user needs it.

## Implemented Changes

### Leads And Calendar

- Leads now uses the shared `WorkbenchHeader`, `WorkbenchMetricStrip`, and `WorkbenchAttentionPanel`.
- Lead attention now focuses on overdue initial contact, CIS follow-up, and first-order-ready leads.
- Calendar now has a cleaner workbench header, schedule-oriented metrics, and a concise attention lane for today, upcoming commitments, and Outlook readiness.

Evidence:

- `apps/crm-web/src/components/leads/LeadWorkspace.tsx`
- `apps/crm-web/src/components/calendar/CalendarWorkspace.tsx`

### Territory And Training

- Territory remained on the simplified layout from the prior territory-specific pass.
- Training now uses the shared workbench header and metric strip.
- Certification track badges were replaced by quiet policy text.
- Training keeps Sessions as the default, with Today, Needs Attention, Reports, and Admin Setup separated.

Evidence:

- `apps/crm-web/src/components/training/TrainingWorkspace.tsx`

### Product Management, Digital Assets, And Dealer Portal

- Product Management advanced matching, source/migration, and admin trace detail now use the shared `WorkbenchAdvancedSection`.
- Product detail keeps dealer-readiness visible while moving source and version trace into advanced sections.
- Digital Assets keeps library/share flows prominent while moving Widen/source/storage trace into advanced sections.
- Dealer Portal copy is quieter and points account-service dependency status to Account Health.

Evidence:

- `apps/crm-web/src/components/product-management/ProductManagementWorkspace.tsx`
- `apps/crm-web/src/components/product-management/ProductDetailWorkspace.tsx`
- `apps/crm-web/src/components/digital-assets/DigitalAssetsWorkspace.tsx`
- `apps/crm-web/src/components/dealer/DealerCatalog.tsx`
- `apps/crm-web/src/components/dealer/DealerCatalogProductDetail.tsx`
- `apps/crm-web/src/components/dealer/DealerAccountCenter.tsx`

### Consignment, Accounts, And Admin

- Consignment workspace and site detail now use shared workbench sections for daily work vs ERP handoff/audit detail.
- Customer list and customer detail now keep next-action and account context prominent while readiness/handoff/dependency detail is collapsed.
- Admin workspace and catalog business rules now use the shared workbench pattern for clearer setup vs operator separation.

Evidence:

- `apps/crm-web/src/components/consignment/ConsignmentWorkspace.tsx`
- `apps/crm-web/src/components/consignment/ConsignmentSiteDetail.tsx`
- `apps/crm-web/src/components/customers/CustomerList.tsx`
- `apps/crm-web/src/components/customers/CustomerDetail.tsx`
- `apps/crm-web/src/components/admin/AdminWorkspace.tsx`
- `apps/crm-web/src/components/admin/AdminCatalogRulesWorkspace.tsx`

### Mobile

- The mobile bottom tabs remain compressed to `Today`, `Route`, and `More`.
- Today labels and More-screen groupings were tightened for field language: route work, ROSE audits, voice notes, sync, OCR, training, leads, accounts, and assets.

Evidence:

- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/app/(tabs)/assets.tsx`
- `docs/UX_01_WORKBENCH_SLICE_B_QA_NOTES_2026-05-26.md`

## Test Harness Updates

The CRM e2e tests were updated to match the new UX contract:

- `New Intake` is now selected as a top-level workbench action instead of through the old Overview tab.
- Training assertions now expect `Training Workbench` and explicitly open the `Today` panel.
- Account readiness assertions open the collapsed readiness/handoff advanced section before checking readiness detail.
- RD/TM and dealer catalog persona tests now use isolated browser contexts, matching real independent user sessions and avoiding in-memory auth bleed between personas.

Evidence:

- `apps/crm-web/e2e/flows.spec.mjs`

## Verification

Passed:

```bash
pnpm --filter @pulse/crm-web typecheck
pnpm --filter @pulse/crm-web lint
pnpm --filter @pulse/mobile typecheck
pnpm --filter @pulse/mobile lint
pnpm --filter @pulse/crm-web test:e2e
git diff --check
```

Playwright result:

```text
11 passed (42.9s)
```

## Remaining UX-01 Work

Slice B does not close UX-01. Remaining work should focus on:

1. Browser screenshot review of the heaviest pages after the shared workbench convergence.
2. Further table compaction where wide operational tables still carry too many columns.
3. Persona UAT script execution with Dynamic-style tasks, not only route smoke tests.
4. A final pass to ensure every default module surface stays within the one-primary-CTA and 4-6 first-screen metric budget.
