# Parked PRD - Marketing SMS Campaigns

Date: 2026-04-28

Status: `Parked - discovery captured, not in active development pipeline`

Primary source:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md`

Key transcript signal:
- A marketing stakeholder asked whether SMS could be done through Pulse.

## Executive Summary

SMS marketing was raised during the April 20 meeting as a possible marketing capability. This PRD captures the future requirement bucket, but SMS should not be added to the current development pipeline. SMS introduces consent, opt-out, carrier compliance, phone-number hygiene, delivery throttling, and provider-selection concerns that must be resolved before implementation.

## Goals

If approved later, the SMS Campaigns module should:

- support opt-in compliant SMS audience selection
- send provider-backed SMS campaigns or transactional messages
- distinguish marketing SMS from operational notifications
- record sent, delivered, failed, replied, and opted-out states where provider data exists
- support STOP/HELP handling and suppression
- connect SMS engagement back to lead/contact/account records

## Non-Goals For Current Active Pipeline

- no SMS sender in the current Leads hardening slice
- no marketing SMS campaign composer
- no bulk SMS provider integration
- no automated marketing texting without consent policy
- no assumption that phone numbers captured for CRM follow-up are valid marketing opt-ins

## Future Functional Requirements

| ID | Requirement |
| --- | --- |
| SMS-001 | Pulse shall distinguish marketing SMS consent from ordinary phone contact details. |
| SMS-002 | Pulse shall support suppression and opt-out before sending any SMS campaign. |
| SMS-003 | Pulse shall support provider-backed delivery only after provider selection and compliance review. |
| SMS-004 | Pulse shall record SMS delivery status and response metadata where available. |
| SMS-005 | Pulse shall show SMS history on lead/contact/account timelines only when visibility rules allow it. |
| SMS-006 | Pulse shall throttle sends according to provider and compliance policy. |
| SMS-007 | Pulse shall report campaign performance by audience, date, source, and conversion outcome where approved. |

## Open Questions

| ID | Question | Owner |
| --- | --- | --- |
| SMS-Q01 | Is the SMS use case marketing campaigns, operational reminders, or both? | Marketing + Operations |
| SMS-Q02 | What consent language exists today for SMS? | Marketing + Legal/Compliance |
| SMS-Q03 | Which SMS provider should be used? | Architecture + Marketing |
| SMS-Q04 | Should Pulse support inbound replies or only outbound messages? | Marketing |
| SMS-Q05 | Which users can send SMS and who approves templates? | Marketing + Admin |

## Approval Boundary

This PRD should move into active development only when:

- SMS consent policy is approved
- provider is selected
- opt-out/suppression behavior is defined
- marketing vs transactional use cases are separated
- compliance owner signs off
