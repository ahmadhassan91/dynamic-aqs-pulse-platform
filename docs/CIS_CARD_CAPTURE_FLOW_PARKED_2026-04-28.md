# CIS Card Capture Flow Parked

Date: 2026-04-28

## Why This Changed

The April 20 client review changed the assumption that CIS should directly host or record eBizCharge / Moneris card-capture activity. Dynamic AQS indicated the CIS sheet/card-capture flow is changing, so Pulse should not hardcode the old provider path while the business process is still moving.

## Current Product Position

- Pulse CIS will continue to handle digital CIS package lifecycle, public submit, internal review, finance queueing, finance decisions, and scanned-CIS safe-field review.
- Pulse CIS will not launch Moneris hosted tokenization, record eBizCharge/Moneris vault outcomes, or process Moneris callback routes while this is parked.
- Raw payment fields remain excluded from CIS OCR parsing and CRM truth.
- Account-level payment-method management remains a separate finance-controlled customer/account capability.

## Code-Level Guard

- CIS provider capture routes are no longer mounted in `apps/api/src/modules/cis/http.ts`.
- Moneris CIS callback/cleanup workers are no longer registered in `apps/api/src/server.ts`.
- The CIS panel no longer shows provider launch, cancel, callback, or vault-record controls.
- Admin payment settings force CIS capture tracking off while still allowing account payment-method management.
- The CIS regression suite now verifies the old provider capture routes return `404`.

## Revisit Trigger

Reopen this only after Dynamic AQS confirms the revised card-capture operating model:

- whether card capture happens inside Pulse, Acumatica, provider-hosted pages, or a post-CIS account setup step
- whether eBizCharge, Moneris, or another provider owns the tokenization flow
- whether Pulse should receive provider callbacks or only store externally confirmed account payment-method references
- what evidence finance needs in Pulse without storing raw PCI/bank data
