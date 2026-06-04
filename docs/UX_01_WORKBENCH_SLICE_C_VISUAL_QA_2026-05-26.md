# UX-01 Slice C - Visual QA Checklist

Date: 2026-05-26

Status: `Implemented - automated QA passed, manual screenshot checklist prepared`

Scope: cross-module UX-01 Slice C cleanup plus visual QA checklist. This note does not close UX-01; it records the Slice C implementation and the remaining manual screenshot pass needed before UX-01 can be closed.

## Slice B State Reviewed

Slice B already moved the active CRM surfaces toward the shared workbench contract:

- Leads, Calendar, Training, Consignment, Accounts, Admin, Product Management, Digital Assets, and detail pages now use shared workbench primitives where appropriate.
- Product, Digital Assets, Dealer Portal, Consignment, Accounts, and Admin moved more source/audit/migration/dependency detail into advanced sections.
- CRM Playwright regression passed `11/11`.
- Mobile bottom navigation is compressed to `Today`, `Route`, and `More`.

## Mobile Slice C Cleanup

The Today screen had two notification entry points: the tab header bell and a second in-screen bell beside Sign out. Slice C removes the in-screen bell so mobile keeps one consistent notification entry point in the header.

Preserved:

- Header notification bell and sync badge
- Today, Route, and More tab model
- Today quick actions for Route, Sync, Scan card, Voice notes, ROSE audit, and Training
- More hub for capture/review, work queues, and Asset Library

## CRM Slice C Cleanup

Implemented low-risk clutter reductions across the active CRM workbench surfaces:

- Leads keeps `New Intake` as the visible primary CTA; routing, latest-intake, import, forms, queues, and export actions are grouped in `More actions`.
- Calendar keeps `Schedule & Send Invite` as the visible primary CTA; setup and Outlook status move to `More`, and event filters are compacted into the toolbar select.
- Territory report tables are compacted from wide spreadsheet-style columns into grouped summary columns.
- Consignment now puts the operator work queue before metrics.
- Accounts list columns are narrowed by compacting contacts, locations, source, and status.
- Admin shortcuts and catalog rule template setup are quieter.
- Product Management and Digital Assets reduce default implementation language and keep Widen/source/migration detail in advanced areas.

Preserved:

- Backend-wired actions and routes.
- Role visibility and RBAC gates.
- Audit/source/migration/dependency evidence behind advanced sections, tabs, or detail surfaces.

## Cross-Module Visual QA Checklist

Use this checklist while taking screenshots. A page fails Slice C if the default first viewport makes users inspect setup, audit, migration, or dependency detail before finding today's next action.

| Surface | Persona | Default Route | Must Pass | Watch For |
| --- | --- | --- | --- | --- |
| Leads | Super Admin / Ops / TM | `/leads` | Pipeline or actionable lead work appears before analytics; one clear `New Intake` action; attention lane is visible. | Duplicate CTAs, import/governance panels above work queue, too many badges. |
| Calendar | Super Admin / TM | `/calendar` | Schedule and today's commitments are primary; Outlook setup is quiet unless opened. | Setup/status panels dominating the calendar. |
| Territory | RD / TM | `/territories` | Routing posture, needs-attention summary, and scoped work are visible without a long metric wall. | Wide tables, duplicated regional rollups, watchlist cards growing too tall. |
| Training | RD / TM | `/training` | Sessions and due training are first; reports/admin remain discoverable but secondary. | Certification/catalog setup crowding today's work. |
| Product Management | Product / Marketing Admin | `/product-management` | Catalog readiness and dealer visibility are understandable without schema terms. | Families/categories/rules wording confusing non-technical users. |
| Digital Assets | Product / Marketing Admin / TM | `/digital-assets` | Library, share sets, and shareable customer links are first-class. | Widen/S3/CloudFront internals shown before asset tasks. |
| Dealer Portal | Dealer User | `/dealer/dashboard`, `/dealer/catalog`, `/dealer/account` | Dealer can browse catalog/files and understand account health without internal parked-boundary copy repeating everywhere. | Internal rule names, storage language, repeated order/pricing warnings. |
| Consignment | Ops / TM | `/consignment` | Audits due, PO follow-ups, and site issues appear before broad reports or ERP handoff detail. | Acumatica boundary panels repeated above operator queue. |
| Accounts | Ops / TM | `/customers` and account detail | Search/list and account next action are primary; readiness and handoff evidence are collapsible. | Readiness/UAT/dependency detail hiding the account task. |
| Admin | Super Admin | `/admin` and business rules | User/access/integration/business-rule tasks are grouped by admin intent. | One large generic admin dashboard with unrelated setup cards. |
| Mobile | Territory Manager | Expo app tabs | Bottom nav stays `Today`, `Route`, `More`; Today shows field priorities and contextual capture; More is a hub, not a module browser. | Duplicate notification entry points, too many top-level tabs, engineering sync language. |

## First-Viewport Acceptance Rules

For each screenshot, record pass/fail against these rules:

- One primary CTA maximum.
- No more than 4-6 first-screen metrics.
- One Needs Attention lane or obvious exception summary.
- Daily operator work appears before reports/admin/setup.
- Repeated records over 10 items use compact rows, tables, or queues.
- Parked dependencies are visible but not repeated as dominant panels.
- Audit/source/migration detail is accessible, not default clutter.
- Language uses Dynamic business terms: lead, account, territory, ROSE, training, catalog, assets, dealer, share link.

## Verification Executed

Passed on 2026-05-26:

```bash
command -v npx >/dev/null 2>&1
pnpm --filter @pulse/crm-web typecheck
pnpm --filter @pulse/crm-web lint
pnpm --filter @pulse/mobile typecheck
pnpm --filter @pulse/mobile lint
pnpm --filter @pulse/crm-web test:e2e
git diff --check
```

CRM Playwright result:

```text
11 passed
```

## Manual Screenshot Commands

Run these when taking the remaining visual evidence screenshots:

```bash
command -v npx >/dev/null 2>&1
```

Use the Playwright CLI wrapper for manual visual review:

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
export PLAYWRIGHT_CLI_SESSION=ux01-slice-c
export PULSE_VISUAL_BASE_URL="http://127.0.0.1:3000"
export PULSE_VISUAL_ADMIN_EMAIL="<admin-email>"
export PULSE_VISUAL_ADMIN_PASSWORD="<admin-password>"
"$PWCLI" --help
```

Start the local CRM stack in another terminal:

```bash
WEB_PORT=3000 PORT=4000 pnpm start:local
```

Then capture the visual checklist from the repo root. Snapshot first, then sign in with locator-backed commands so the script does not depend on transient element refs:

```bash
mkdir -p output/playwright/ux-01-slice-c
"$PWCLI" open "$PULSE_VISUAL_BASE_URL/auth/login" --headed
"$PWCLI" snapshot
"$PWCLI" run-code "await page.getByLabel('Email').fill(process.env.PULSE_VISUAL_ADMIN_EMAIL ?? '')"
"$PWCLI" run-code "await page.getByLabel('Password').fill(process.env.PULSE_VISUAL_ADMIN_PASSWORD ?? '')"
"$PWCLI" run-code "await page.getByRole('button', { name: /sign in/i }).click()"
"$PWCLI" snapshot
```

Internal CRM route review:

```bash
"$PWCLI" open "$PULSE_VISUAL_BASE_URL/leads"
"$PWCLI" snapshot
"$PWCLI" run-code "await page.screenshot({ path: 'output/playwright/ux-01-slice-c/leads.png', fullPage: true })"
"$PWCLI" open "$PULSE_VISUAL_BASE_URL/calendar"
"$PWCLI" snapshot
"$PWCLI" run-code "await page.screenshot({ path: 'output/playwright/ux-01-slice-c/calendar.png', fullPage: true })"
"$PWCLI" open "$PULSE_VISUAL_BASE_URL/territories"
"$PWCLI" snapshot
"$PWCLI" run-code "await page.screenshot({ path: 'output/playwright/ux-01-slice-c/territories.png', fullPage: true })"
"$PWCLI" open "$PULSE_VISUAL_BASE_URL/training"
"$PWCLI" snapshot
"$PWCLI" run-code "await page.screenshot({ path: 'output/playwright/ux-01-slice-c/training.png', fullPage: true })"
"$PWCLI" open "$PULSE_VISUAL_BASE_URL/product-management"
"$PWCLI" snapshot
"$PWCLI" run-code "await page.screenshot({ path: 'output/playwright/ux-01-slice-c/product-management.png', fullPage: true })"
"$PWCLI" open "$PULSE_VISUAL_BASE_URL/digital-assets"
"$PWCLI" snapshot
"$PWCLI" run-code "await page.screenshot({ path: 'output/playwright/ux-01-slice-c/digital-assets.png', fullPage: true })"
"$PWCLI" open "$PULSE_VISUAL_BASE_URL/consignment"
"$PWCLI" snapshot
"$PWCLI" run-code "await page.screenshot({ path: 'output/playwright/ux-01-slice-c/consignment.png', fullPage: true })"
"$PWCLI" open "$PULSE_VISUAL_BASE_URL/customers"
"$PWCLI" snapshot
"$PWCLI" run-code "await page.screenshot({ path: 'output/playwright/ux-01-slice-c/customers.png', fullPage: true })"
"$PWCLI" open "$PULSE_VISUAL_BASE_URL/admin"
"$PWCLI" snapshot
"$PWCLI" run-code "await page.screenshot({ path: 'output/playwright/ux-01-slice-c/admin.png', fullPage: true })"
```

Dealer portal route review should use a dealer persona, not the internal admin session:

```bash
export PULSE_VISUAL_DEALER_EMAIL="<dealer-email>"
export PULSE_VISUAL_DEALER_PASSWORD="<dealer-password>"
"$PWCLI" --session ux01-slice-c-dealer open "$PULSE_VISUAL_BASE_URL/dealer/login" --headed
"$PWCLI" --session ux01-slice-c-dealer snapshot
"$PWCLI" --session ux01-slice-c-dealer run-code "await page.getByLabel('Email').fill(process.env.PULSE_VISUAL_DEALER_EMAIL ?? '')"
"$PWCLI" --session ux01-slice-c-dealer run-code "await page.getByLabel('Password').fill(process.env.PULSE_VISUAL_DEALER_PASSWORD ?? '')"
"$PWCLI" --session ux01-slice-c-dealer run-code "await page.getByRole('button', { name: /sign in/i }).click()"
"$PWCLI" --session ux01-slice-c-dealer snapshot
"$PWCLI" --session ux01-slice-c-dealer open "$PULSE_VISUAL_BASE_URL/dealer/dashboard"
"$PWCLI" --session ux01-slice-c-dealer snapshot
"$PWCLI" --session ux01-slice-c-dealer run-code "await page.screenshot({ path: 'output/playwright/ux-01-slice-c/dealer-dashboard.png', fullPage: true })"
"$PWCLI" --session ux01-slice-c-dealer open "$PULSE_VISUAL_BASE_URL/dealer/catalog"
"$PWCLI" --session ux01-slice-c-dealer snapshot
"$PWCLI" --session ux01-slice-c-dealer run-code "await page.screenshot({ path: 'output/playwright/ux-01-slice-c/dealer-catalog.png', fullPage: true })"
"$PWCLI" --session ux01-slice-c-dealer open "$PULSE_VISUAL_BASE_URL/dealer/account"
"$PWCLI" --session ux01-slice-c-dealer snapshot
"$PWCLI" --session ux01-slice-c-dealer run-code "await page.screenshot({ path: 'output/playwright/ux-01-slice-c/dealer-account.png', fullPage: true })"
```

Mobile verification should stay focused on type/lint plus simulator screenshots by the mobile owner:

```bash
pnpm --filter @pulse/mobile typecheck
pnpm --filter @pulse/mobile lint
```

## Remaining Non-Dependent UX Gaps

These do not need Acumatica, Widen migration execution, route optimization, or real production data access:

1. Wide CRM tables still need a second pass where risk/status columns can be merged without losing scanability.
2. Product Management still needs visual confirmation that Categories, Families, Dealer Views, and Admin Setup read as plain catalog workflow, not data-model setup.
3. Digital Assets should be visually checked with enough seeded assets to prove bulk/share/library states do not become form-heavy again.
4. Dealer Portal needs persona screenshots for affinity, ownership/PE, independent, and hybrid catalog boundaries.
5. Mobile needs iOS/Android screenshot QA after this Today bell cleanup to confirm Today, Route, and More stay within the field-assistant contract.
6. Admin should be checked for role/permission setup clarity once the next access-control slice touches it.

## UI That Should Be Removed Instead Of Shipped

None identified in the owned mobile files after removing the duplicate Today bell. Any future concept-only mobile route should stay hidden behind `href: null` until the action is backend-wired and QA-covered.
