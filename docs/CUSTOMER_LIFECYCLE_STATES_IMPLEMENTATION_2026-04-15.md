# Customer Lifecycle States Implementation

Date: 2026-04-15

## Scope

This slice added the first governed customer lifecycle state machine to the production account model.

The implemented lifecycle states are:
- `active`
- `at_risk`
- `inactive`
- `churned`

## Decisions Locked

- customer lifecycle is separate from simple record visibility
- `isActive` still matters operationally, but it is no longer the only customer-state signal
- churn requires an explicit note
- direct `ACTIVE -> CHURNED` is not allowed
- the safer progression is:
  - `ACTIVE -> AT_RISK`
  - `ACTIVE -> INACTIVE`
  - `AT_RISK -> ACTIVE`
  - `AT_RISK -> INACTIVE`
  - `INACTIVE -> ACTIVE`
  - `INACTIVE -> CHURNED`
  - `CHURNED -> ACTIVE`
- first-order conversion seeds new customers as `ACTIVE`

## What Changed

### Schema

Added account lifecycle fields:
- `lifecycleStatus`
- `lifecycleStatusChangedAt`
- `lifecycleReasonNote`
- `lastOrderAt`
- `lastEngagementAt`

### Backend

- account list filtering now supports lifecycle filtering
- added governed lifecycle update API
- lifecycle transitions are validated server-side
- churn requires a note
- lifecycle updates are audited
- first-order conversion now stamps new customers as `ACTIVE` and sets `lastOrderAt`

### Web

- customer list now shows lifecycle badges and filtering
- customer overview now supports lifecycle actions:
  - mark at risk
  - mark inactive
  - confirm churn
  - reactivate
- customer detail header now surfaces lifecycle directly instead of forcing users to infer it from `isActive`

## Regression Coverage

Verified in:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/accounts.regression.test.mjs`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/leads.readiness.regression.test.mjs`

Coverage includes:
- list/detail visibility for converted customers
- governed lifecycle transitions
- churn-note enforcement
- lifecycle filtering
- reactivation
- separation between lifecycle state and generic record-active toggles
- first-order conversion seeding `ACTIVE` lifecycle state

## Test Harness Hardening

The account regression pass also hardened the test reset harness:
- database reset now truncates through `psql` after disconnecting Prisma
- this removed intermittent deadlock noise from repeated test seeding

## Remaining Next Depth

This slice does not yet include:
- automatic no-order aging into `at_risk` or `inactive`
- lifecycle-driven alerts
- ERP-backed order-driven lifecycle automation
- customer merge flows

Those should follow only when order/read-model and reporting signals are ready.
