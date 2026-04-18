# Group Reference Stewardship UI And Import

Date: 2026-04-18

## Summary

Affinity-group and ownership-group stewardship is now live through the existing lead-capture admin workspace instead of staying as backend-only reference APIs.

This slice adds:
- CRUD for governed affinity groups
- CRUD for governed ownership groups
- bulk paste import for both reference masters
- role-gated stewardship UI under `/leads/forms`
- regression coverage for the backend reference-management lane

## Why this slice matters

The classification kernel was already in place, but operations still needed a real place to maintain the governed values behind that kernel.

Without this slice, the business would have:
- explicit affinity/ownership ids in the schema
- seeded reference values in the backend
- but no practical stewardship surface for admins/operators

That would leave the architecture correct but operationally incomplete.

## What shipped

### Backend

Files:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/reference/service.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/reference/http.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/contracts/src/reference.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/reference.regression.test.mjs`

Capabilities:
- create affinity groups
- update affinity groups
- import affinity groups
- create ownership groups
- update ownership groups
- import ownership groups
- deny those mutations to non-admin roles

### Frontend

Files:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/leads/LeadWebsiteFormsWorkspace.tsx`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/leads/GroupReferenceManager.tsx`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/lib/pulse-api.ts`

Capabilities:
- new `Classification Stewardship` tab in the lead-capture workspace
- reusable governed-reference manager for affinity and ownership
- add/edit modal for each reference type
- bulk paste import modal using headered tab/comma-delimited rows
- read-only review mode for roles without `reference.manage`

## Runtime hardening done in this slice

The first browser pass exposed a route crash on `/leads/forms`.

Root cause:
- client runtime depended on imported constant arrays at module scope
- the built browser bundle hit an `undefined.map` failure during module evaluation

Fix:
- local type-value arrays are now defined inside the client workspace module
- the route no longer depends on that runtime export path

This was verified by rerunning the full browser suite after the fix.

## Verification

Commands run:
- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/api build && node --test --test-concurrency=1 apps/api/test/reference.regression.test.mjs`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web build`
- `pnpm --filter @pulse/crm-web test:e2e`

Results:
- backend reference regression suite passed `4/4`
- browser E2E passed `4/4`

## Next

The immediate roster follow-through is now shipped in:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/GROUP_ROSTER_MEMBERSHIP_RECONCILIATION_2026-04-18.md`

So the clean next move from here is:
- account/customer maintenance surfaces for governed classification updates
- dealer-group reference model and later resolver behavior
- price-class reference model only when ERP ownership is concrete

## Parked Deliberately

This stewardship slice stops at governed master-data management.

It does **not** include:
- dealer-group derived resolution
- price-class sync or ERP-owned price-class truth
- guessed Acumatica behavior
- saved roster mapping templates or run-history ergonomics

Those boundaries are intentional:
- this slice manages the list of valid groups
- the roster slice now manages who belongs to those groups over time
- dealer-group stays downstream because it is derived from more than just the master list
- price class remains Acumatica-owned and should stay parked until sandbox access and certified mappings exist
