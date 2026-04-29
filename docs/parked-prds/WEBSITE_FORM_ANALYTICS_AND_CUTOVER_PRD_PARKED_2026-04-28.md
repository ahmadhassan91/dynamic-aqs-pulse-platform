# Parked PRD - Website Form Analytics And HubSpot Cutover

Date: 2026-04-28

Status: `Partially active through Leads hardening; deeper analytics parked`

Primary source:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md`

Key transcript signals:
- Pulse-native embedded forms are expected to replace HubSpot website intake.
- Marketing asked where forms will live once HubSpot is eliminated.
- Marketing recalled a prior website-form failure where submissions were blocked or not forwarded.
- Dynamic AQS expects a parallel trial period before removing the current platform.

## Executive Summary

Website form reliability is not optional. Pulse-native lead forms may replace HubSpot intake, but Dynamic AQS explicitly asked for proof that embedded forms work before cutover. The production Leads hardening slice should include connection/status and trial-run controls. Deeper website analytics should be parked as a separate later scope unless approved.

## Active Leads-Hardening Scope

These items should be handled inside the next Leads production-hardening slice:

- website form connection status
- embed preview and environment labeling
- trial-run checklist
- new lead vs duplicate-attached submission clarity
- submission audit trail
- source site / brand / campaign provenance
- operational alerting for failed form submission paths where possible

## Parked Analytics Scope

These items should remain parked until marketing analytics scope is approved:

- page views
- CTA clicks
- form starts
- abandonment funnel
- A/B testing
- UTM campaign dashboards beyond source attribution
- open/read/click behavior from email campaigns
- cross-channel marketing attribution

## Future Functional Requirements

| ID | Requirement |
| --- | --- |
| WFA-001 | Pulse shall provide a status view for each active embedded website form. |
| WFA-002 | Pulse shall allow preview/testing of each form before production cutover. |
| WFA-003 | Pulse shall show last successful submission time and recent submission outcomes. |
| WFA-004 | Pulse shall preserve source site, brand, campaign, capture method, and duplicate outcome. |
| WFA-005 | Pulse shall support a parallel-run period before HubSpot forms are turned off. |
| WFA-006 | Pulse shall provide cutover checklist evidence for each website. |
| WFA-007 | Pulse shall optionally track page/form analytics only if marketing analytics scope is approved. |

## Open Questions

| ID | Question | Owner |
| --- | --- | --- |
| WFA-Q01 | Which websites/forms must be included in the first cutover wave? | Marketing + Operations |
| WFA-Q02 | What is the minimum successful trial period before HubSpot forms can be disabled? | Marketing + Leadership |
| WFA-Q03 | Who approves each website cutover? | Marketing + Operations |
| WFA-Q04 | Are website analytics required in Pulse or only submission tracking? | Marketing |
| WFA-Q05 | What alert should fire when form submissions fail or no submissions arrive for an expected period? | Marketing + Operations |

## Approval Boundary

For the active Leads slice, only the reliability/cutover controls should be built.

Full marketing analytics should not enter active development until Dynamic AQS approves:

- analytics scope
- ownership
- privacy/compliance posture
- reporting expectations
- whether Pulse or an external analytics platform owns funnel metrics
