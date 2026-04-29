# Parked PRD - Campaign Attribution And Source Performance

Date: 2026-04-28

Status: `Partially adjacent to Leads; full campaign analytics parked`

Primary sources:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md`
- `docs/client-scope-confirmation-2026-04-20/01_LEADS_PRD.md`

## Executive Summary

Pulse already needs reliable source attribution for lead intake: website, brand, campaign, form, import, trade show, referral, and manual entry. That belongs in the active Leads hardening path. A fuller campaign analytics module is separate: campaign records, audience membership, cost, engagement, conversion attribution, and ROI reporting should stay parked until Marketing confirms scope.

## Active Leads Scope

- Preserve `sourceCampaign`, source site, source brand, capture method, and import-run provenance.
- Show source and campaign context clearly on lead detail, cards, and source reporting.
- Keep HubSpot as migration/source history, not future-state intake truth.
- Support form cutover evidence so Dynamic AQS can retire HubSpot intake safely.

## Parked Campaign Analytics Scope

- campaign planning and campaign records
- campaign membership and audience snapshots
- UTM/link tracking beyond source capture
- conversion attribution through CIS / first order
- campaign cost and ROI reporting
- cross-channel campaign dashboards
- open/click/read metrics from email marketing providers

## Future Requirements

| ID | Requirement |
| --- | --- |
| CASP-001 | Pulse shall define governed campaign records with owner, dates, channel, brand/site, and status. |
| CASP-002 | Pulse shall attach campaign/source metadata to leads created through forms, imports, or links. |
| CASP-003 | Pulse shall preserve source provenance when a submission attaches to an existing lead. |
| CASP-004 | Pulse shall report leads by campaign, source site, brand, channel, owner, and conversion posture. |
| CASP-005 | Pulse shall distinguish CRM source attribution from marketing engagement analytics. |
| CASP-006 | Pulse shall support future campaign-to-first-order reporting only after activation and ERP boundaries are stable. |

## Open Questions

| ID | Question | Owner |
| --- | --- | --- |
| CASP-Q01 | Which campaign dimensions are required at launch: source, brand, UTM, trade show, offer, promotion code? | Marketing + Sales |
| CASP-Q02 | Should campaign ROI use Pulse-only lead conversion, Acumatica order data, or both? | Marketing + Finance |
| CASP-Q03 | Which historical HubSpot/Zoho campaign fields must migrate? | Marketing |
| CASP-Q04 | Are campaign dashboards needed in Pulse, or can provider dashboards remain the source for engagement metrics? | Marketing + Leadership |

## Approval Boundary

Keep minimal campaign/source fields active in Leads. Do not build campaign management or campaign ROI dashboards until the Marketing Email/Campaign module is approved.
