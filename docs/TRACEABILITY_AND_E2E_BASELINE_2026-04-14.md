# Traceability And E2E Baseline

Date: 2026-04-14

## Purpose

Keep roadmap traceability visible inside the implementation repo and establish a browser-level regression baseline on top of the existing backend module suites.

## Traceability Mirror

Mirrored into this repo under [/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/traceability](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/traceability):

- roadmap registers
- source-of-truth documents
- scope traceability workbook
- sprint release plan

Working rule:

- planning repo remains the upstream authoring source
- implementation repo keeps a visible mirror for engineers and code review

## Browser-Level E2E Baseline

Added under:

- [/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/e2e/prepare-e2e.mjs](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/e2e/prepare-e2e.mjs)
- [/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/e2e/playwright.config.mjs](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/e2e/playwright.config.mjs)
- [/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/e2e/flows.spec.mjs](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/e2e/flows.spec.mjs)

Covered browser flows:

- internal auth and prototype-shell route access
- public native website lead form
- public CIS draft/save/submit
- dealer portal login and account-center access

Current result:

- `4/4` browser flows passing through the repo-driven E2E command
- real regressions fixed during stabilization:
  - `/leads` SSR/runtime crash from missing option catalogs
  - `/admin` runtime crash from missing role-catalog import path
  - public website-form state/province selection in the hosted form
  - brittle text assertions in the public website-form success state

Important boundary:

- browser E2E complements the existing backend module regressions
- it does not replace module suites for leads, CIS, territories, accounts, dealer portal, training, or auth/admin

## Commands

- backend regression stack:
  - `pnpm --filter @pulse/api test`
- browser E2E:
  - `pnpm --filter @pulse/crm-web test:e2e`

## Parked

- richer browser coverage for internal lead transitions, training execution, and customer-detail mutations should follow after those routes settle further
- provider-bound flows remain parked: outbound email, hosted payment, OCR CIS fallback, and Acumatica handoff
