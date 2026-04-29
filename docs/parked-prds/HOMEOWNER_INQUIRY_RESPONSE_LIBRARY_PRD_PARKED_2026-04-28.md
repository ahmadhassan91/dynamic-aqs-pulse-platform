# Parked PRD - Homeowner Inquiry Routing And Response Library

Date: 2026-04-28

Status: `Partially adjacent to website forms; automation parked`

Primary sources:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md`
- `docs/client-scope-confirmation-2026-04-20/01_LEADS_PRD.md`

## Executive Summary

Pulse website forms need to distinguish contractor/dealer prospects from homeowner inquiries. That belongs in active Leads hardening. However, automated homeowner answers, AI response suggestions, and a governed response library are separate product scope. This PRD parks that scope until Dynamic AQS assigns ownership for approved answers and escalation rules.

## Active Leads Scope

- Capture homeowner vs contractor form type.
- Route homeowner inquiries differently from contractor/CIS lead flows where approved.
- Preserve source site, topic, contact info, and submission history.
- Keep homeowner inquiries visible without polluting dealer onboarding pipelines.

## Parked Response Library Scope

- approved homeowner response templates
- topic taxonomy
- automated or semi-automated replies
- AI-assisted answer drafting
- customer service / technical escalation workflow
- response quality review

## Future Requirements

| ID | Requirement |
| --- | --- |
| HIR-001 | Pulse shall classify public inquiries as contractor/dealer, homeowner, referral, or other approved type. |
| HIR-002 | Pulse shall provide a homeowner topic taxonomy. |
| HIR-003 | Pulse shall route homeowner inquiries to the approved owner or queue. |
| HIR-004 | Pulse shall maintain approved response templates by topic, brand/site, and region where needed. |
| HIR-005 | Pulse shall record manual and automated responses in the activity history. |
| HIR-006 | Pulse shall require content-owner approval before automated responses are enabled. |
| HIR-007 | Pulse shall escalate technical/product questions to the approved support owner. |

## Open Questions

| ID | Question | Owner |
| --- | --- | --- |
| HIR-Q01 | Which team owns homeowner inquiries today? | Marketing + Customer Service |
| HIR-Q02 | Which homeowner topics should Pulse classify? | Marketing + Technical |
| HIR-Q03 | Are automated responses allowed, or only template-assisted manual replies? | Leadership + Marketing |
| HIR-Q04 | Who approves response text and update cadence? | Marketing + Technical |
| HIR-Q05 | Should homeowner inquiries become leads, cases, or a separate inquiry object? | Operations + Architecture |

## Approval Boundary

Build only homeowner intake classification in the Leads hardening path. Do not build automated replies or AI response flows until response ownership and approval rules are signed off.
