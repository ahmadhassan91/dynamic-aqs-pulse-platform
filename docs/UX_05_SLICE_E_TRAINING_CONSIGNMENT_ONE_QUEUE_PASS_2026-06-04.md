# UX-05 Slice E - Training And Consignment One-Queue Pass

Date: 2026-06-04

Status: `Implemented - static/type/mobile/service QA passed; local browser/DB QA blocked by host resource pressure`

## Purpose

Training and Consignment were functionally real, but their default pages still felt like dashboards: duplicate count cards, attention panels, setup tabs, report tabs, and repeated next-action surfaces competed with the work Dynamic AQS needs to do first.

This slice enforces the UX-05 rule:

> One work queue first. Reports, setup, history, and dependency notes stay behind More, advanced sections, or detail views.

## Implemented

| Area | Change |
| --- | --- |
| Training default | `/training` now resolves to `Priority Queue` by default unless a valid deep tab is requested. |
| Training count surfaces | Removed the top metric strip, attention panel, unresolved-exception badge, per-panel queue count badges, and coaching mini-metrics. Queue chips are the only first-screen count surface. |
| Training labels | Renamed operator labels to `Scheduled Sessions`, `Account Coverage`, `Coverage Summary`, `Compliance Reports`, `Catalog Setup`, `Proof Review`, `Overdue Cadence`, and `Session Issues`. |
| Training setup | Catalog administration is now one `Catalog Setup` stepper: `Category -> Training Type -> Template`, using existing backend create handlers. |
| Mobile training signal | Mobile next-action provider now fetches bounded live Training session signals and passes `trainingDueCount` into the existing next-action engine. Other mobile tabs do not fetch this extra Training signal. |
| Consignment default | `/consignment` now defaults to one ranked `Next site work` list instead of visible tabs, `Today's Priorities`, and a metric strip. |
| Consignment ranking | Due audits, follow-ups, and site issues are deduped by site. The highest-priority reason is shown first and additional reasons are summarized quietly as `more items`. |
| Consignment reports/sites | Reports and all-site search remain reachable from More; reporting metrics moved out of default first paint. |
| Consignment site detail | Removed the duplicate `Recommended Next Step` card so the header primary action is the only next-action surface. |
| Finish audit | `Finish audit` now opens a small modal with `No issue` and `Log site issue`; it no longer assumes every completed audit creates a site issue. |
| Operator copy | The readiness label `Acumatica warehouse setup boundary` is now plain `Setup handoff` while preserving the parked dependency boundary. |

## Requirement Trace

| Requirement | Covered By |
| --- | --- |
| Centralized training workspace | `TrainingWorkspace.tsx` now lands on the Priority Queue, keeping scheduling, proof review, recertification, and exceptions in one operator workbench. |
| Training priority / exception reporting | Queue chips surface recertification, coaching, proof review, overdue cadence, and session issues without duplicate metric panels. |
| Admin-managed training catalog | `Catalog Setup` stepper preserves category, type, and template create flows without three simultaneous setup forms. |
| Proof / certification queue surfacing | `Proof Review` remains backend-wired through the operational exceptions queue and certification ops modal. |
| ROSE due audits | `Next site work` ranks overdue/due-soon audit work from consignment site cadence data. |
| Consignment follow-ups | `Next site work` includes Pulse work queue items and converts technical subjects into operator-friendly copy. |
| Consignment site issues | `Next site work` includes open discrepancy/suspended/exiting site issues without exposing PO/manual-variance copy by default. |
| Site-detail primary workflow action | `ConsignmentSiteDetail.tsx` keeps action sequencing in the header primary action and removes the duplicate card. |
| Audit completion split | `Finish audit` modal supports clean completion (`No issue`) or variance follow-up (`Log site issue`). |

## Parked Boundaries

- Training external training-site replacement, Outlook/Teams/WebEx policy, provider-backed storage, printable certification authority, participant depth, voice-to-text, contests/giveaways, and value-delivered tracking remain parked or later-slice decisions.
- Consignment Acumatica-owned truth remains parked. Pulse must not fake warehouse creation, transfer/receipt truth, inventory on hand, posted POs/sales orders, invoices, credit memos, or financial settlement.
- The consignment UI can show CRM-owned setup/readiness/workflow state, but ERP-owned words and facts stay out of the default daily work path.
- Mobile Training `trainingDueCount` is a bounded live signal only; it does not change Outlook/provider sync, external training-site policy, or offline conflict resolution.

## QA Evidence

Focused gates for this slice:

- `node --check apps/crm-web/e2e/prepare-e2e.mjs && node --check apps/crm-web/e2e/ux-depth.spec.mjs && node --check apps/crm-web/e2e/ux-clutter.spec.mjs && node --check apps/crm-web/e2e/flows.spec.mjs`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/mobile test -- mobile-training-policy.test.ts mobile-next-action.test.ts`
- `pnpm --filter @pulse/api test -- consignment.regression.test.mjs`

Browser QA target added:

- `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.depth.config.mjs -g "UX-05 slice E"`

Current run results on 2026-06-04:

- Passed: `node --check apps/crm-web/e2e/prepare-e2e.mjs && node --check apps/crm-web/e2e/ux-depth.spec.mjs && node --check apps/crm-web/e2e/ux-clutter.spec.mjs && node --check apps/crm-web/e2e/flows.spec.mjs`
- Passed: `pnpm --filter @pulse/crm-web typecheck`
- Passed: `pnpm --filter @pulse/mobile test -- mobile-training-policy.test.ts mobile-next-action.test.ts` (`42/42`)
- Passed: `node --test apps/api/test/consignment.service.regression.test.mjs` (`2/2`)
- Passed: `git diff --check`
- Blocked locally: production-build Playwright config reached app startup after ad-hoc signing Prisma engines, but `next build` was killed with exit `137` under host pressure.
- Blocked locally: DB-backed `apps/api/test/consignment.regression.test.mjs` and `apps/crm-web/e2e/prepare-e2e.mjs` could not start because `prisma migrate deploy` was killed with `SIGKILL`.
- Host evidence: the machine had very high load and low free memory/disk during the run (`Load Avg` above 60, about `230M` unused physical memory, and about `3.8G` to `5.0G` free on the Data volume).

The Browser/Playwright assertion proves:

- Training Ops lands on `Priority Queue`.
- Training queue chips are visible while duplicate top count surfaces are absent.
- Consignment default shows one `Next site work` table.
- Consignment default does not show old tabs, reporting metrics, or Acumatica/ERP/PO/manual-variance copy.
- Consignment site detail `Finish audit` opens `No issue` / `Log site issue`.

## Next Slice

Move to UX-05 Slice F: Dealer Portal Start Here and files-first flow.
