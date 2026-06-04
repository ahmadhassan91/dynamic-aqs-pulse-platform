# UX-01 Slice E Implementation - Detail Progressive Disclosure

Date: 2026-05-26

Status: `Implemented - CRM/dealer automated and visual QA passed; mobile device visual QA pending`

## Purpose

Slice E continues the cross-module simplification work after the default module pages were cleaned up. The focus is detail pages and selected-record panels:

> Once a user selects a record, the screen should still answer: what is this, what is wrong, and what can I do next?

History, source trace, audit evidence, migration detail, and setup controls remain available, but they should not be the first thing a Dynamic AQS operator has to parse.

## Agent Audit Inputs

Five targeted audits were used before implementation:

| Agent | Scope | Main Recommendation |
| --- | --- | --- |
| Product detail | Product readiness and dealer catalog detail | Add a top attention/readiness signal; promote `Check readiness`, `Edit content`, `Attach file`, and `Edit visibility`; keep Acumatica/source details secondary. |
| Digital assets | Selected asset detail | Reorder selected asset detail as Share -> Usage -> Details -> Replace File -> History; move Widen/source trace to an advanced source section. |
| Accounts | Customer/account detail | Keep Profile, Contacts, and Locations primary; move Activity & Docs, Payment Methods, Training, and Dealer Portal under More/contextual cards. |
| Calendar/Admin | Calendar detail rail and admin default | Remove duplicated right-rail attention cards, gate Outlook sync to supported event families, and make Audit Monitor the home for audit detail. |
| Mobile | Field app More/Sync/Voice Notes | Relabel preview OCR, condense Sync Status, avoid raw API/internal copy, and remove duplicated Today/More entry points. |

## Implementation

### Product Detail

- Rebuilt the detail header with `WorkbenchHeader`, `WorkbenchMetricStrip`, and `WorkbenchAttentionPanel`.
- Added top-level readiness items for missing dealer content, missing product files, missing dealer visibility, and blocked readiness checks.
- Moved dealer-facing content editing into a modal.
- Moved product file attachment into a modal.
- Gated readiness, publish, and asset-link actions behind existing permission checks.
- Added product detail to visual QA fixtures and screenshots.

### Digital Assets

- Reordered selected asset detail into task-based sections:
  - Share
  - Usage
  - Details
  - Replace File
  - History
  - Source trace
- Renamed technical labels to user-facing file/share language.
- Stopped showing raw storage/source URLs in the default history table.
- Moved Widen/source/migration trace to an advanced bottom section.

### Accounts

- Reduced account-detail primary tabs to Profile, Contacts, and Locations.
- Moved Activity & Docs, Payment Methods, Training, and Dealer Portal into a More menu while keeping deep-link panel behavior intact.
- Updated Playwright coverage to exercise Dealer Portal through the More menu.

### Calendar

- Removed duplicated Today/Upcoming right-rail summary cards.
- Adjusted header copy so discovery/training scheduling is clearly supported while visits/audits are reviewed from linked workflows.
- Gated Outlook sync actions to lead and training event families only.

### Admin

- Removed passive Audit Snapshot from the admin overview.
- Added an Audit Monitor navigation card and renamed the activity surface to Audit Monitor.

### Mobile

- Relabeled business-card OCR as a review action instead of implying final automation.
- Condensed Sync Status by removing the raw CRM API URL and replacing dense counters with a simple pill row.
- Changed Voice Notes copy from device-session language to CRM-sync language.
- Removed the duplicate More quick action from Today.
- Added line wrapping to long share URLs.

## Verification

Commands run:

```bash
pnpm --filter @pulse/crm-web typecheck
pnpm --filter @pulse/mobile typecheck
pnpm --filter @pulse/crm-web lint
pnpm --filter @pulse/mobile lint
pnpm --filter @pulse/crm-web test:e2e
pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.visual.config.mjs
```

Results:

- CRM web typecheck: passed
- Mobile typecheck: passed
- CRM web lint: passed
- Mobile lint: passed
- CRM Playwright e2e: `11 passed`
- CRM/dealer visual Playwright: `2 passed`

Visual evidence:

- Internal CRM route screenshots: `output/playwright/ux-01-slice-e/internal-report.json`
- Dealer persona screenshots: `output/playwright/ux-01-slice-e/dealer-report.json`
- Product detail screenshot added: `output/playwright/ux-01-slice-e/product-detail-full.png`

## Remaining UX-01 Gate

Do not close UX-01 yet. The remaining proof is mobile device visual QA for:

- Today
- Route
- More
- Asset Library
- Voice Notes
- Training
- Consignment
- Sync Status

Known follow-up candidates from visual inspection:

- Product detail still repeats some actions in header, attention rows, and section headers. It is much clearer than before, but a later polish pass can choose one command home per action.
- Calendar still has Today/Upcoming metrics and attention rows that can feel repetitive for sparse data; acceptable for now because the right rail duplication is removed.
- Digital Assets empty-state is clean, but selected-asset screenshots need seeded asset data in a later evidence pass.
