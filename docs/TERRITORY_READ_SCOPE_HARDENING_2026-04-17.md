# Territory Read Scope Hardening

Date: 2026-04-17
Branch: `codex/entra-calendar-governance`

## What changed

- Added territory-specific read-scope helpers so TM and RD actors no longer get global territory read visibility by default.
- Scoped these territory read surfaces:
  - region list
  - territory list
  - shipping center list
  - territory map workspace
  - territory assignment history
- Broad operational roles keep broad visibility through the existing global record-visibility rule.

## Scope rules in this slice

- `TERRITORY_MANAGER`
  - sees their managed territory coverage
  - sees shipping centers tied to their visible coverage
  - can read assignment history only for leads/accounts/locations inside their visible record scope
- `REGIONAL_DIRECTOR`
  - sees region-owned coverage and linked shipping centers
  - can read assignment history only for leads/accounts/locations inside their visible record scope
- broad roles such as `SUPER_ADMIN` continue to see global territory data

## Files

- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/territories/service.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/territories/visibility.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/territories.regression.test.mjs`

## Regression coverage

The territory regression suite now explicitly covers:

- TM-scoped region / territory / shipping center reads
- RD-scoped region / territory / shipping center reads
- scoped map workspace coverage, lead pins, and account pins
- denial of out-of-scope territory assignment history reads

Verified with:

```bash
pnpm dlx tsx --test --test-concurrency=1 apps/api/test/territories.regression.test.mjs
```

## Open items outside this slice

- The repo-wide `@pulse/api` build/test scripts are currently blocked by unrelated pre-existing TypeScript/build issues outside the territory module.
- Territory reporting dashboards, bulk reassignment, and multi-location visibility remain separate follow-on slices.
