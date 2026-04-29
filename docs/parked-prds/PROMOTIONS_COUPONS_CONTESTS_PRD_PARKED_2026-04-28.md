# Parked PRD - Promotions, Coupon Codes, And Contest Winners

Date: 2026-04-28

Status: `Parked - touches marketing, dealer portal, orders, and finance`

Primary source:
- Marketing initiative review from April 20 scope discussion and broader roadmap context.

## Executive Summary

Promotions, coupon codes, and contest winners may become valuable marketing and dealer-portal capabilities, but they should not enter the current Leads/Territory/Training production-hardening pipeline. This area touches campaign strategy, dealer portal checkout, Acumatica/order adjustments, eligibility, redemption, fraud controls, and ROI reporting.

## Future Goals

- Define promotions and campaign offers.
- Associate offers with eligible audiences or accounts.
- Track campaign/promotion source on leads and orders.
- Support dealer portal visibility where approved.
- Track redemption and ROI.
- Preserve finance/ERP source-of-truth boundaries.

## Future Requirements

| ID | Requirement |
| --- | --- |
| PCC-001 | Pulse shall define promotion/coupon records with owner, dates, eligibility, and status. |
| PCC-002 | Pulse shall attach promotion codes to leads, accounts, campaign records, or dealer portal sessions where approved. |
| PCC-003 | Pulse shall enforce eligibility and redemption limits. |
| PCC-004 | Pulse shall preserve redemption history and audit trail. |
| PCC-005 | Pulse shall not apply financial/order adjustments without approved Acumatica/order integration boundaries. |
| PCC-006 | Pulse shall report promotion performance by campaign, source, account, and conversion outcome. |

## Open Questions

| ID | Question | Owner |
| --- | --- | --- |
| PCC-Q01 | Are coupon codes intended for dealer portal orders, lead generation, or both? | Marketing + Sales |
| PCC-Q02 | Does Acumatica own discounts/promotions financially? | Finance + Architecture |
| PCC-Q03 | Who approves promotion eligibility and redemption rules? | Marketing + Finance |
| PCC-Q04 | Are contest winners a marketing workflow, dealer portal workflow, or manual reporting workflow? | Marketing |

## Approval Boundary

This PRD should move into active planning only after dealer portal/order foundations and ERP pricing/discount boundaries are stable.
