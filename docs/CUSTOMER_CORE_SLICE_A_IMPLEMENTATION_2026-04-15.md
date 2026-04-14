# Customer Core Slice A Implementation

Date: 2026-04-15

## What Landed

This slice moves the customer module out of read-only visibility mode and into governed operational maintenance.

Implemented:
- direct `POST /api/v1/accounts` is now restricted to `SUPER_ADMIN` bootstrap/migration usage
- live account update path:
  - `PATCH /api/v1/accounts/:accountId`
- live contact maintenance paths:
  - `POST /api/v1/accounts/:accountId/contacts`
  - `PATCH /api/v1/accounts/:accountId/contacts/:contactId`
- live location maintenance paths:
  - `POST /api/v1/accounts/:accountId/locations`
  - `PATCH /api/v1/accounts/:accountId/locations/:locationId`

## Customer Workspace Changes

Under the approved prototype shell, `/customers/[id]` now supports:
- editing account summary fields
- adding and editing contacts
- soft deactivating and reactivating contacts
- adding and editing locations
- soft deactivating and reactivating locations
- primary-contact fallback when the current primary is deactivated
- primary-location fallback when the current primary is deactivated

The customer detail route now exposes separate:
- `Profile`
- `Contacts`
- `Locations`
- `Training`
- `Dealer Portal`

tabs instead of treating contacts and locations as passive display only.

## Why This Slice Matters

The source-of-truth requires customer creation to remain governed by the lead-to-first-order boundary, while still allowing operational maintenance once the customer exists. This slice closes that gap by:
- keeping customer creation honest
- making customer maintenance usable in production
- preserving territory/shipping/source-lead lineage already carried from conversion

## What Is Still Pending

This slice does not yet close the full customer PRD.

Still pending:
- lifecycle states beyond `isActive`
- at-risk / churn automation
- hierarchy and parent/child accounts
- notes/activity/documents depth
- orders/invoices/shipments/payments read models
- configurable contact-role catalogs instead of free-text role capture
- billing vs shipping modeling depth beyond location maintenance

## Regression Coverage

Expanded:
- `apps/api/test/accounts.regression.test.mjs`

New covered paths:
- direct-create governance guard
- account summary update
- contact primary reassignment
- contact soft deactivation fallback
- location primary reassignment
- location soft deactivation fallback
