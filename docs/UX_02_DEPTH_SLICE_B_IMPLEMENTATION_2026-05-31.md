# UX-02 Depth Slice B Implementation

Date: 2026-05-31

Status: `Implemented - detail/modals/persona depth QA passed`

## Scope

This slice continues `UX-02 Practical Workbench Hardening` after the default-page budget passed in Slice A.

Slice B focuses on the second-click experience:

- lead and account detail pages
- product and digital asset setup/detail modals
- consignment site detail workflow actions
- Territory Manager / Regional Director scoped territory workspaces
- mobile field app workbench copy and next-action clarity

## Agent Team

| Agent | Scope | Result |
| --- | --- | --- |
| Worker A | Leads and accounts | Simplified lead detail header actions, moved edit into More, converted account contact/location row buttons into row menus, tightened empty states and modals. |
| Worker B | Product and digital assets | Simplified category/family setup, dealer view modal flow, product detail modals, asset upload/share-set/detail panels, and kept Widen/migration language in Advanced Import/source trace. |
| Worker C | Consignment | Promoted one recommended site next step, moved other workflow actions into More, collapsed repeated evidence-history empties, and kept Acumatica warehouse handoff explicitly parked. |
| Worker D | Territory TM/RD | Made non-admin territory copy role-aware, relabeled non-admin secondary path to Work Queues, hid setup hygiene counts for users without setup permission, and added RD/TM e2e assertions. |
| Worker E | Mobile parity | Simplified Today/More/Assets/Voice Notes/Sync Status copy, clarified next actions, and kept parked mobile dependencies explicit. |

## CRM Web Changes

### Lead and Account Detail

- Lead detail now has one primary action: `Log Call`.
- `Edit lead details` moved under the shared `More` menu.
- `Back to Pipeline` became a plain link.
- Contact and location repeated row buttons moved into shared row action menus.
- Contact/location empty states now use one useful `EmptyStateMessage`.
- Contact/location modals now follow a more natural field order.

### Product and Digital Assets

- Product category/family table row actions moved into row menus.
- Family status/sort and similar setup fields moved behind advanced disclosure.
- Dealer View modal is ordered around audience, visibility, brand/region, then save/cancel.
- Product detail edit/attach/visibility modals now use task-first copy and simpler field order.
- Digital Asset rows/cards are directly selectable instead of repeating Open/Details buttons.
- Share-set rows use row menus.
- Widen/legacy wording remains in Advanced Import and source trace areas.

### Consignment

- Site detail promotes one recommended next step based on site state/readiness:
  agreement, BLUE baseline, activation, schedule ROSE, or complete ROSE.
- Other backend-wired actions moved under `More`.
- Repeated document/audit/mobile-note empty panels collapse into one evidence-history empty state.
- Acumatica warehouse copy is limited to `Parked until Acumatica access` where it prevents confusion.

### Territory TM/RD

- Non-admin territory users see scoped work and owned territory language instead of setup-heavy admin copy.
- `Admin Config` is hidden for TM-style users and replaced with `Work Queues` in the More menu.
- Setup hygiene counts are hidden when the user cannot manage territory setup.
- Read-only territory users get explicit context that records/history are available but setup/reassignment is restricted.

## Mobile Changes

- Today screen leads with priority leads and one primary route-plan action.
- More screen uses clearer primary actions per section: Voice Notes, Lead Inbox, and Asset Library.
- Asset copy says approved sharing, not Widen/backend language.
- Voice Notes now says `Sync for office review` and clarifies what the field user should do next.
- Sync Status now separates phone-only updates, retryable work, office-review items, and parked background sync/conflict/push/deep-link/cache dependencies.

## New QA Gate

Added:

- `apps/crm-web/e2e/ux-depth.spec.mjs`
- `apps/crm-web/e2e/playwright.depth.config.mjs`

The depth gate captures:

- dialog button count
- dialog primary-button count
- dialog empty-message count
- TM/RD territory default visible buttons and tabs
- screenshots under `output/playwright/ux-02-depth/`
- JSON reports for dialog and persona checks

## Verification

Passed:

```bash
node --check apps/crm-web/e2e/ux-depth.spec.mjs
node --check apps/crm-web/e2e/playwright.depth.config.mjs
node --check apps/crm-web/e2e/flows.spec.mjs
node --check apps/crm-web/e2e/ux-visual.spec.mjs
pnpm --filter @pulse/crm-web typecheck
pnpm --filter @pulse/crm-web exec playwright test --config e2e/playwright.depth.config.mjs
pnpm --filter @pulse/crm-web exec playwright test e2e/flows.spec.mjs --config e2e/playwright.config.mjs --grep "navigation|internal workspace auth|RD and TM personas|dealer catalog personas"
pnpm --filter @pulse/crm-web exec playwright test --config e2e/playwright.visual.config.mjs
pnpm --filter @pulse/mobile test
```

Worker-verified:

```bash
pnpm --filter @pulse/mobile typecheck
```

Local note: a redundant parent-session mobile typecheck rerun did not finish promptly and was stopped after several minutes; the mobile worker had already run the same typecheck successfully, and the parent-session mobile test suite passed 34/34.

## QA Results

CRM depth gate:

```text
2 passed
```

CRM flow/persona regression:

```text
6 passed
```

CRM/dealer visual budget:

```text
1 passed
Internal CRM routes: 14/14 passing
Dealer Portal routes: 11/11 passing
```

Mobile tests:

```text
34/34 passing
```

Depth report summary:

| Check | Result |
| --- | --- |
| Lead edit dialog | 2 buttons, 0 empty messages |
| Product dealer content dialog | 2 buttons, 0 empty messages |
| Digital asset upload dialog | 3 buttons, 1 empty message |
| Consignment create site dialog | 2 buttons, 0 empty messages |
| Calendar scheduler dialog | 1 button, 0 empty messages |
| RD territory default | 2 visible buttons, 3 visible tabs |
| TM territory default | 2 visible buttons, 3 visible tabs |

Evidence output:

- `output/playwright/ux-02-depth/internal-dialog-report.json`
- `output/playwright/ux-02-depth/persona-workspace-report.json`
- `output/playwright/ux-02-depth/*.png`
- `output/playwright/ux-02/internal-report.json`
- `output/playwright/ux-02/dealer-report.json`

## Remaining UX-02 Work

- Capture mobile simulator screenshots for the updated Today/More/Assets/Voice Notes/Sync Status surfaces.
- Run a deployed Browser UAT pass as TM/RD and dealer personas once the current branch is deployed.
- Continue applying the same depth rules to any new module detail surfaces as they are added.
- Keep Acumatica product/inventory/order/payment and true offline/push/route-optimization dependencies parked until source access and rules are certified.
