# Dealer Portal Architecture Direction

Date: 2026-04-14

## Recommendation

Keep Dealer Portal on the same shared backend modular monolith.

## Why

- Dealer identity, account context, pricing context, portal eligibility, and audit trails all depend on the same core CRM data.
- Splitting backend ownership now would duplicate auth, account models, permissions, and downstream ERP boundaries too early.
- The current delivery team and dependency state do not justify microservice-style separation for the portal.

## Delivery Shape

- Shared backend monolith: yes
- Shared monorepo: yes
- Separate dealer-facing frontend app/routes later if useful: yes
- Separate dealer backend project now: no

## Current Slice

- Internal CRM provisioning kernel is the right first slice:
  - dealer portal account status
  - dealer portal user provisioning
  - suspend / deactivate / password reset
  - account-scoped audit trail

## Next Safe External Slice

- Branded read-only dealer account center
- Dealer login
- Dealer dashboard
- Account / contacts / locations visibility

## Parked Until Dependencies

- Real order submission
- Invoices / shipment history
- Payments
- ERP-backed catalog ordering behavior
- Invite email delivery
