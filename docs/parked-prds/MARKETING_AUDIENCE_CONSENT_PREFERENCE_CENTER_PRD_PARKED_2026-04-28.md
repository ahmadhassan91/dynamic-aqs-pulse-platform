# Parked PRD - Marketing Audience, Consent, And Preference Center

Date: 2026-04-28

Status: `Parked - required before marketing sends, not active pipeline`

Primary source:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md`

## Executive Summary

If Pulse later replaces or integrates with Zoho/Vivo-style marketing platforms, it must manage marketing audiences and consent explicitly. CRM contact details are not automatically marketing permission. This PRD captures the future consent/preference foundation, but it should not block current lead intake hardening unless Dynamic AQS asks public forms to collect explicit marketing consent now.

## Goals

- Track contact-level subscription and consent status.
- Support opt-in/opt-out by communication category.
- Maintain suppression lists before bulk email/SMS is enabled.
- Preserve consent source and timestamp.
- Support import/export with external marketing platforms.

## Non-Goals For Current Active Pipeline

- no full preference center in the next Leads slice
- no assumption that all CRM contacts are marketable
- no automated marketing sends
- no SMS opt-in automation without compliance review

## Future Requirements

| ID | Requirement |
| --- | --- |
| MCP-001 | Pulse shall distinguish operational contactability from marketing consent. |
| MCP-002 | Pulse shall track opt-in source, timestamp, category, and capture method. |
| MCP-003 | Pulse shall track opt-out timestamp, reason/source, and category. |
| MCP-004 | Pulse shall maintain suppression lists for email and SMS. |
| MCP-005 | Pulse shall prevent campaign sends to suppressed or unsubscribed contacts. |
| MCP-006 | Pulse shall support preference-center updates by authorized internal users and, if approved, self-service contacts. |
| MCP-007 | Pulse shall preserve consent history after account merge or contact update. |

## Data Concepts

- `MarketingConsent`
- `CommunicationPreference`
- `SuppressionEntry`
- `ConsentEvent`
- `AudienceSnapshot`

These should be relational/auditable if activated.

## Open Questions

| ID | Question | Owner |
| --- | --- | --- |
| MCP-Q01 | What consent language exists today on websites/forms? | Marketing + Legal/Compliance |
| MCP-Q02 | Does Dynamic AQS need separate preferences for product news, training, promotions, service updates, and dealer communications? | Marketing |
| MCP-Q03 | Should homeowners and contractors have different consent categories? | Marketing + Operations |
| MCP-Q04 | Should Pulse sync consent with Zoho/Vivo or replace those consent stores later? | Marketing + Architecture |

## Approval Boundary

This PRD must be approved before Pulse sends marketing email/SMS. It does not need to be built for basic CRM lead intake unless marketing opt-in capture becomes a launch requirement.
