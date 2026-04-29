# Parked PRD - Marketing Email Campaigns

Date: 2026-04-28

Status: `Parked - discovery captured, not in active development pipeline`

Primary source:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md`

Key transcript signals:
- HubSpot intake forms are expected to be replaced by Pulse-native forms.
- Zoho was identified as the email marketing platform.
- Residential also uses a second platform transcribed as `vivo` / `Avao`; exact vendor name must be confirmed.
- Stakeholders asked whether Pulse could send bulk campaigns.
- Stakeholders asked about contact limits, open/read rates, click-through rates, deliverability, server trust, and warmup.

## Executive Summary

Dynamic AQS stakeholders raised email marketing as a real future-state concern during the April 20 meeting. This PRD captures the requested capability area so it is not lost, but it should not be added to the active Pulse development pipeline until the team confirms provider strategy, compliance requirements, deliverability ownership, unsubscribe rules, and whether Pulse should replace or integrate with existing platforms.

The safest near-term position is:

- Pulse owns CRM contact/lead/account truth.
- Pulse records source, campaign, and consent-relevant metadata where needed for CRM reporting.
- Email marketing campaign execution remains a separate approved module or integration until explicitly signed off.

## Problem Statement

Residential currently uses email marketing tools for bulk campaigns and prospect communication. Stakeholders asked whether Pulse could eliminate those tools and send campaigns directly. The request touches deliverability, sender reputation, unsubscribe handling, consent, bounce processing, template governance, and campaign analytics. Those concerns are materially different from ordinary CRM transactional notifications.

## Goals

If approved in a later phase, the Marketing Email Campaigns module should:

- manage marketing audience lists from approved lead/contact/account segments
- support campaign creation, review, scheduling, and sending
- track delivered, opened, read, clicked, bounced, unsubscribed, and failed states where provider support exists
- preserve campaign source attribution back to leads and contacts
- support batching/throttling so the platform does not overload mail infrastructure
- enforce consent, suppression, unsubscribe, and opt-out controls
- support sender reputation and warmup strategy through a provider-aware plan
- give marketing users clear campaign performance reporting

## Non-Goals For Current Active Pipeline

The following are explicitly not part of the current Leads/Territory/Training hardening pipeline:

- building a full email marketing engine
- sending bulk marketing campaigns from Pulse
- replacing Zoho or the second platform immediately
- managing sender-domain warmup operationally inside Pulse
- storing marketing engagement as a required field on every lead
- treating open/click analytics as committed scope for Release 0 / current foundation hardening

## Users

| User | Need |
| --- | --- |
| Marketing user | Create and send campaigns to approved audiences |
| Sales / Strategic Growth | See campaign source and engagement context on relevant lead/contact records |
| Leadership | See campaign performance and contribution to lead generation |
| Admin / Compliance owner | Control consent, suppression, sender identity, and unsubscribe behavior |

## Future Functional Requirements

| ID | Requirement |
| --- | --- |
| EM-001 | Pulse shall define marketing audiences from governed lead/contact/account filters. |
| EM-002 | Pulse shall preserve campaign source attribution on leads created from campaign-driven forms or links. |
| EM-003 | Pulse shall support draft, review, approved, scheduled, sent, paused, and archived campaign states. |
| EM-004 | Pulse shall support provider-backed delivery for bulk email if Dynamic AQS approves Pulse-owned campaign sending. |
| EM-005 | Pulse shall record delivery events including sent, delivered, bounced, failed, opened, clicked, unsubscribed, and complaint where provider data is available. |
| EM-006 | Pulse shall support unsubscribe and suppression lists before any bulk sending is enabled. |
| EM-007 | Pulse shall support batching/rate controls for campaign delivery. |
| EM-008 | Pulse shall report campaign performance by audience, source, date, brand/site, and conversion outcome where data is available. |
| EM-009 | Pulse shall distinguish transactional notifications from marketing campaigns. |
| EM-010 | Pulse shall preserve historic campaign/source data imported from HubSpot, Zoho, or other approved systems where migration scope is signed off. |

## Data Concepts

Potential future entities:

- `MarketingCampaign`
- `MarketingAudience`
- `CampaignMembership`
- `CampaignDeliveryEvent`
- `MarketingConsent`
- `SuppressionEntry`
- `CampaignLink`
- `CampaignSourceAttribution`

These should be explicit relational entities if approved. Do not bury campaign performance, consent, or delivery status in generic JSON.

## Integration / Coexistence Options

| Option | Meaning | Recommendation |
| --- | --- | --- |
| Keep existing tools | Zoho / second platform continues sending campaigns; Pulse stores CRM truth and source context | Safest near-term |
| Integrate with provider | Pulse creates audiences and receives engagement data, provider sends email | Best likely future path |
| Pulse sends directly | Pulse owns campaign composer and sender infrastructure | Highest operational risk |
| Migrate history only | Pulse imports past campaign/source attribution but does not send | Useful for reporting |

## Open Questions

| ID | Question | Owner |
| --- | --- | --- |
| EM-Q01 | What is the exact second email platform name currently transcribed as `vivo` / `Avao`? | Marketing |
| EM-Q02 | Should Pulse replace Zoho, integrate with Zoho, or only store campaign attribution? | Marketing + Leadership |
| EM-Q03 | Who owns unsubscribe, opt-out, consent, and suppression policy? | Marketing + Legal/Compliance |
| EM-Q04 | Which sender domains are used today and who controls DNS/authentication? | Marketing + IT |
| EM-Q05 | What deliverability provider should be used if Pulse sends campaigns? | Architecture + Marketing |
| EM-Q06 | Are open/read/click metrics required in Pulse, or acceptable in provider dashboards? | Marketing + Leadership |
| EM-Q07 | What contact limits or audience segmentation rules matter operationally? | Marketing |

## Approval Boundary

This PRD is a parked scope document. It should move into the active development pipeline only after:

- marketing platform strategy is approved
- sender/deliverability ownership is assigned
- consent and unsubscribe policy is confirmed
- provider/API path is selected
- campaign analytics requirements are signed off
