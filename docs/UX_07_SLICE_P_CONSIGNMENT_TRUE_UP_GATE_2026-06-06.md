# UX-07 Slice P - Consignment True-Up Gate

Date: 2026-06-06

## Product Design Brief

Consignment should read like Samantha's operating process, not like an ERP placeholder. The default operator path is:

1. BLUE establishes the initial verified baseline.
2. ROSE captures the 90-day count.
3. A variance opens true-up review.
4. Back office checks timing, open work, and known explanations.
5. Only confirmed customer PO follow-up starts the 5-business-day clock.

Acumatica remains the source of truth for warehouse, inventory, transfer/receipt, PO/order posting, invoices, credit memos, and financial settlement. Pulse can own the workflow, evidence, review decisions, due dates, and manual follow-up queue before that access arrives.

## What Changed

| Area | Slice P implementation |
| --- | --- |
| Contracts | Added `ConfirmConsignmentTrueUpRequest` / `ConfirmConsignmentTrueUpResponse` and outcome keys: `po_required`, `resolved_no_po`, `write_off`. |
| API route | Added `POST /api/v1/consignment/audits/:auditId/true-up` behind `consignment.manage`. |
| Service workflow | ROSE variance now creates an `IN_REVIEW` discrepancy and `VARIANCE_REVIEW` work item. It does not start a PO clock at audit completion. |
| PO clock gate | `po_required` true-up starts the 5-business-day due date and creates one open `PO_FOLLOW_UP` work item. Repeating true-up does not duplicate the work item. |
| No-PO outcomes | `resolved_no_po` resolves reconciliation without PO follow-up; `write_off` marks the discrepancy written off and waives PO follow-up. |
| CRM web | Site detail has a `Review true-up` action and modal; queue labels now say `True-up review needed` / `Review true-up`. |
| Process vocabulary | BLUE, ROSE, PURPLE, and SAND labels are restored as business process names. |

## Parked Boundaries

| Parked item | Why parked | Current Pulse behavior |
| --- | --- | --- |
| Open PO / in-transit / receipt matching | Requires certified Acumatica reads and sample records | Operator records a manual true-up outcome and reason. |
| PO/order creation or linking | Posted order truth belongs in Acumatica | Pulse stores optional external PO reference and starts manual follow-up. |
| Inventory adjustment posting | PURPLE affects ERP inventory truth | PURPLE remains a later manual-boundary depth slice. |
| Exit settlement posting | SAND can touch returns, invoices, credit memos, and settlement | SAND remains a later manual-boundary depth slice. |

## Verification

| Gate | Status |
| --- | --- |
| `pnpm --filter @pulse/contracts build` | Passed |
| `pnpm --filter @pulse/api typecheck` | Passed |
| `pnpm --filter @pulse/crm-web typecheck` | Passed |
| `pnpm --filter @pulse/api test:consignment` | Passed |
| `pnpm --filter @pulse/crm-web test:ux-clutter:quick` | Passed |
| `git diff --check` | Passed |

## Next Consignment Depth

1. Samantha workbook replacement over Pulse-owned data: site status, BLUE/ROSE evidence, true-up queue, PO clock, overdue follow-up, and parked-boundary freshness.
2. PURPLE manual-boundary request flow for inventory adjustments without ERP posting.
3. SAND manual-boundary exit flow for closure evidence and settlement placeholders without financial posting.
4. Focused Browser/Playwright UAT on the deployed true-up path after deployment.
