# Dealer Portal Requirements QA Report - 2026-05-15

## Scope

Reviewed dealer-portal requirement gathering sessions, product/catalog PRDs, prototype frontend behavior, and the current Pulse implementation. Tested the deployed environment at `https://pulse-crm.theclustox.com` after release `manual-20260515011821-dealer-portal-qa`.

## Requirement Interpretation

The prototype showed cart, orders, invoices, tracking, payments, statements, and richer finance alerts. Those remain parked until Acumatica, payment-provider, transaction-history, shipment, and credit-status dependencies are certified. The build-now slice is:

- dealer login and account-scoped portal access
- company contacts, locations, and user directory
- role-sensitive portal shell
- published dealer catalog products and files
- favorites for purchasing/admin users
- file-open/download audit
- internal preview as dealer account from CRM account context
- clear pending states for order and finance features

## Fixes Delivered

- Added server-side role enforcement so read-only dealer roles cannot mutate catalog favorites.
- Expanded dealer asset-open audit metadata with access role, catalog view, asset visibility, visibility source, asset version, and delivery outcome.
- Simplified dealer-facing copy to avoid implementation terms like ERP/Acumatica/provisioning in customer-facing screens.
- Added safer dealer login redirect handling: `next` must stay under `/dealer`.
- Stopped dealer dashboard/catalog hooks from calling dealer APIs for internal users before the protected workspace rejects them.
- Added Account Center empty states for portal users, contacts, and locations.
- Added retry actions for dealer dashboard, catalog, and account recovery states.
- Fixed dealer navigation active state for Account Health.
- Removed dashboard noise by hiding the duplicate “Back to Dashboard” button while already on the dashboard.
- Added catalog filters for brand, family, file type, saved products, and file availability.

## QA Results

- `pnpm --filter @pulse/api build` passed.
- `pnpm --filter @pulse/crm-web typecheck` passed.
- `pnpm --filter @pulse/crm-web lint` passed.
- `pnpm --filter @pulse/api test:dealer-portal` passed: 8/8.
- Browser plugin live QA passed for dealer login, dashboard, account navigation, catalog load, product detail, favorites state, and file-open flow.
- Playwright CLI live QA passed for dealer login redirect to dashboard and visible navigation landmarks.

## Remaining Parked Dependencies

- Pricing, inventory, cart, checkout/order submit, invoices, payments, shipments, tracking, credit hold enforcement, statements, and historic reporting wait on Acumatica/payment/carrier/transaction-history integrations.
- True impersonation remains parked until Dynamic approves compliance/audit behavior: reason capture, bannered identity switch, expiry, and full audit trail.
- Product catalog source migration remains parked until the Acumatica/product source-of-truth path is confirmed.

## Current Dealer Portal Completion

No-external-dependency slice: approximately 84%.

Full prototype/future-state scope: approximately 68%, because commerce, finance, orders, invoices, shipment, and payment experiences are intentionally parked.
