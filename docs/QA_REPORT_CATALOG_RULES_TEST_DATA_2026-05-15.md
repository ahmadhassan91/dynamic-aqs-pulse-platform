# QA Report: Catalog Rules Test Data Cycle

Date: 2026-05-15

Environment: `https://pulse-crm.theclustox.com`

Release under test: `manual-20260515165229-catalog-full-activation`

## Scope

- Dealer catalog rule authoring/admin page.
- Catalog-rule reference dropdown data for affinity, ownership/PE, region, portal eligibility, and catalog views.
- Full-population activation guard using seeded test accounts.
- Dealer catalog protected-route behavior for an internal admin account.

## Test Data

Seed stamp: `20260515120603`

- Affinity group: `qa_affinity_20260515120603`
- Dealer catalog view: `QA Catalog 20260515120603`
- Rule set: `QA Activation Guard 20260515120603`
- Accounts: 100 matched active affinity accounts plus one unmatched active account.

Backend guard result:

- Sample preview: 100 sampled, 100 matched, 0 unmatched, 0 review required.
- Activation: blocked as expected because full-population validation found unmatched/review accounts outside the preview sample.
- Error returned: `Preview must be clean before publishing: 4 unmatched and 4 need review.`

## Browser Check

Tool: Codex Browser in-app browser.

Result: Pass with limitation.

- Opened `/admin/catalog-rules` in the real browser surface.
- Confirmed unauthenticated access redirects to Pulse login.
- Screenshot saved: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/catalog-rules-qa/browser-catalog-rules-smoke.png`

Note: the Browser surface could not type credentials because its virtual clipboard was unavailable in this environment, so authenticated UI flow was completed with Playwright.

## Playwright Checks

Tooling:

- Playwright CLI wrapper opened and snapshotted the login page.
- Playwright browser automation completed authenticated QA using the seeded test data.

Result: 12 / 12 passed.

| Check | Result |
| --- | --- |
| Catalog Rules page loads authenticated | Pass |
| Parked brand/private-label dependency is visible | Pass |
| Affinity rule language is simple | Pass |
| Ownership/PE rule language is simple | Pass |
| Brand/private-label condition controls are not exposed | Pass |
| Catalog rule options API returns 200 | Pass |
| Seeded QA affinity group is available to UI/API | Pass |
| Seeded QA catalog view is available to UI/API | Pass |
| Options response uses governed dropdown lists | Pass |
| Dealer catalog blocks internal admin account with clear message | Pass |
| Dealer catalog offers return to internal workspace | Pass |
| Authenticated `/auth/me` API works | Pass |

Console errors: none.

## Artifacts

- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/catalog-rules-qa/qa-result.json`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/catalog-rules-qa/playwright-catalog-rules.png`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/catalog-rules-qa/playwright-dealer-catalog-gate.png`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/catalog-rules-qa/browser-catalog-rules-smoke.png`

## Findings

No blocker remains in this QA slice.

The first Playwright pass reported false failures because the assertion expected the wrong response key (`catalogViews` instead of the implemented `dealerCatalogViews`) and did not wait for the dealer protected-route message after hydration. The corrected run passed against the live UI and API.

## Residual Risk

- A real dealer-user catalog session should be retested with a dealer account that has seeded product/catalog assets. This cycle covered the protected-route gate for an internal admin and backend catalog membership data, not a full dealer product browsing session.
- Brand/private-label account matching remains intentionally parked until Dynamic confirms the account-level source of truth.
