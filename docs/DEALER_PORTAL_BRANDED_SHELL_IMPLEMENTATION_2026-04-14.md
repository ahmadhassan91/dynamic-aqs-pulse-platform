# Dealer Portal Branded Shell Implementation

Date: 2026-04-14

## What We Implemented

We opened the first real dealer-facing Pulse surface using the approved prototype route structure:

- `/dealer`
- `/dealer/login`
- `/dealer/dashboard`
- `/dealer/account`

This slice uses the existing shared backend dealer-portal kernel rather than inventing a separate auth stack or a standalone portal service.

## Foundation Decision

We deliberately kept dealer portal on the same shared backend monolith.

We also kept the web auth transport on the same Pulse session model. The dealer login flow now uses the shared auth/session provider but enforces the expected role at login time:

- same login endpoint
- same refresh/logout behavior
- role-gated dealer portal entry
- no mock `dealerAuth` local-storage shortcut

This keeps auth/session aligned instead of creating a second session architecture for the dealer surface.

## Prototype Surfaces Preserved

The implementation follows the existing prototype direction:

- branded landing page
- separate dealer login route
- branded dealer layout with dealer-specific left navigation
- dealer dashboard route
- dealer account-center route

We preserved the route composition and dealer-facing shell intent, but we intentionally trimmed concept-only navigation.

## What Is Real Now

The dealer-facing shell is now backed by real data:

- portal login through the live auth API
- role-locked entry for `DEALER_PORTAL_USER`
- dashboard data from `/api/v1/dealer-portal/me/dashboard`
- account-center data from the same live dashboard read model
- company users, contacts, locations, territory, region, shipping center, TM, and RD context
- logout through the real auth/session boundary

## What We Intentionally Did Not Ship Yet

These remain parked because they are not honestly backend-ready yet:

- self-registration
- product catalog browsing
- cart / ordering
- invoices / statements
- payments
- shipment tracking

Those routes should not be added to active dealer navigation until the backend data and workflows are real.

## Why This Shape Is Correct

This keeps the first dealer-facing slice:

- prototype-aligned
- backend-wired
- honest about scope
- consistent with the shared monolith decision
- safe to extend later into catalog/orders/invoices without redoing auth/session

## Next Logical Dealer Portal Slice

Only proceed when the relevant backend dependencies are real:

1. dealer product catalog read model
2. dealer order history read model
3. invoice / account statement read model
4. shipment tracking read model

Until then, the correct approach is to keep the dealer portal focused on account access and provisioning visibility.
