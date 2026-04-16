# Regression Coverage Expansion

Date: 2026-04-17
Branch: `codex/entra-calendar-governance`

## Scope

This slice expanded regression coverage in the thinner or higher-risk module areas instead of adding low-value duplicate assertions.

The main suites deepened in this pass were:
- `apps/api/test/auth.password-recovery.regression.test.mjs`
- `apps/api/test/accounts.regression.test.mjs`
- `apps/api/test/calendar.regression.test.mjs`
- `apps/api/test/leads.readiness.regression.test.mjs`
- `apps/api/test/cis.regression.test.mjs`

## What Was Added

### Auth Password Recovery

- expired reset tokens are rejected and audited as expired
- preview-disabled recovery still returns a safe accepted response while withholding preview delivery details

### Accounts

- regional directors can now be regression-verified across multiple territories in a directed region, not only single territory manager ownership

### Calendar

- regional directors now have explicit regression coverage for calendar visibility across all territories in regions they direct

### Lead Readiness

- conditional finance approval now has a dedicated regression case proving conversion remains blocked even if checklist items and preparation details are otherwise complete

### CIS / Finance

- finance decisioning now has a dedicated role-gate regression proving only finance users can record finance decisions on queued packages

## Why This Matters

These cases protect the production behaviors most likely to drift as the platform gets more complete:
- identity recovery safety
- simple CRM-style scoped visibility
- finance gating
- conversion gating
- role-based operational control

## Regression Validation

Targeted sequential suite validation:

```bash
cd /Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api
node --test --test-concurrency=1 test/auth.password-recovery.regression.test.mjs
node --test --test-concurrency=1 test/accounts.regression.test.mjs
node --test --test-concurrency=1 test/calendar.regression.test.mjs
node --test --test-concurrency=1 test/leads.readiness.regression.test.mjs
node --test --test-concurrency=1 test/cis.regression.test.mjs
```

Full sequential backend regression:

```bash
cd /Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform
pnpm --filter @pulse/api test
```

Browser regression:

```bash
cd /Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform
pnpm --filter @pulse/crm-web test:e2e
```

## Harness Caveat

The current regression harness still shares the same `pulse_platform_test` database across module suites and browser preparation.

That means:
- sequential runs are reliable
- parallel runs can produce deadlocks or false negatives

This is a test-infrastructure limitation, not a product-behavior failure.

## Code Coverage Snapshot

There is still no formal repo-wide coverage runner with enforced thresholds. For an honest measurement, Node's built-in test coverage was run across the suites expanded in this slice.

Coverage command:

```bash
cd /Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api
node --experimental-test-coverage --test --test-concurrency=1 \
  test/auth.password-recovery.regression.test.mjs \
  test/accounts.regression.test.mjs \
  test/calendar.regression.test.mjs \
  test/leads.readiness.regression.test.mjs \
  test/cis.regression.test.mjs
```

Highlights from that snapshot:
- overall emitted files: `line 37.99%`, `branch 51.79%`, `func 41.07%`
- `dist/modules/accounts/service.js`: `line 85.57%`, `branch 60.11%`, `func 93.55%`
- `dist/modules/auth/service.js`: `line 47.05%`, `branch 68.82%`, `func 60.87%`
- `dist/modules/calendar/service.js`: `line 90.00%`, `branch 85.71%`, `func 100.00%`
- `dist/modules/cis/service.js`: `line 92.87%`, `branch 64.71%`, `func 98.25%`
- `dist/modules/leads/readiness.js`: `line 74.16%`, `branch 54.97%`, `func 88.89%`

## Best Next Move

The next highest-value regression/hardening steps are:
- formalize sequential test isolation or per-suite databases to remove deadlock risk
- keep extending the same coverage discipline into territory, training, users/roles/permissions, and forgot/reset policy edges
- add a repo-standard coverage tool and threshold policy once the module surface settles a bit more
