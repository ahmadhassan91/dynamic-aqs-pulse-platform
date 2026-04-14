# Training Discovery Validation

Date: 2026-04-14

## Validated Direction

- Training is a Pulse-owned, account-centric workflow.
- Training belongs under territory/account management, not under pre-order lead management.
- The safest trigger is first order / customer activation, not older pre-order wording.
- The initial onboarding sequence is three live technical sessions, followed by ongoing TM-led training cadence.
- Scheduling should be Pulse-first with Outlook sync.
- Meeting provider should stay abstract; do not hardcode WebEx-specific behavior.
- Structured training records, attendance, notes, proofs, overdue logic, and reporting are in scope.

## What We Should Build Later

- Training catalog and training program model
- Session scheduling and attendance
- Account-linked training history
- Overdue / cadence engine
- TM/RD visibility and reporting
- Mobile field capture for training vs site visit

## What Stays Parked

- Final Outlook/Graph integration wiring until Microsoft prerequisites arrive
- Teams / WebEx provider-specific meeting creation
- External training-site coexistence/import rules
- Revenue-lift and ROI reporting that depends on deeper ERP/reporting maturity

## Implementation Guardrails

- Do not model training as a single boolean flag.
- Do not make dealer-portal access a hard dependency for training.
- Do not hardcode technician identity depth until account/contact rules are finalized.
- Use the approved prototype shell only when this module starts; replace local stores with real APIs underneath.
