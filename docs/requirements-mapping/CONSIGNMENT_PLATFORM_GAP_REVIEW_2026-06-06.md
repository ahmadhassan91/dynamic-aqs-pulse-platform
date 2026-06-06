# Consignment Platform Gap Review

Date: 2026-06-06
Implementation repo: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform`
Discovery source folder: `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings`

## Correction

The consignment module must be assessed in the Pulse platform repo, not the earlier prototype/discovery repo. The platform implementation is not just a basic screen. It already has database migrations, shared contracts, API routes, service logic, regression coverage, CRM web screens, account indicators, and a mobile ROSE audit flow.

The real gap is narrower and more important: the current foundation supports site readiness, forms, ROSE capture, work items, and parked Acumatica boundaries, but it does not yet fully model Samantha's complete operating process around true-up, PO clock start, shared mailbox history, PURPLE adjustments, SAND exit, and workbook-grade reporting.

## Source Evidence Used

### Discovery and Samantha artifacts

- `Meetings/25 Feb 2026 Session 5.md`
  - Samantha described Acumatica warehouse inventory, transfer orders, receipts, and manual export into Excel/forms.
  - She explained that inventory changes are a moving target and forms must reflect current inventory balance.
  - She walked through the program agreement, initial consignment master, adjustment activity folders, and on-site 90-day audits.
- `Meetings/17th March  session 10-To-Be consognment and App.md`
  - Samantha clarified that audit and reconciliation are independent but connected.
  - A ROSE audit can be complete while reconciliation remains open.
  - The five-day PO rule starts only after open POs, in-transit items, and discrepancies are true-up reviewed.
  - Samantha preferred warehouse creation in Acumatica because warehouse setup has locked-down financial/setup fields.
- `Meetings/asispricingdocuments/Consign Docs and forms overview-V1.docx.md`
  - The form set is explicit: Program Description, Onboarding Document, Onboarding Checklist, Warehouse Visit Tracking Master, BLUE initial verification, ROSE reconciliation, PURPLE inventory adjustment, and SAND program exit.
- `Meetings/Consignment/Warehouse_Visit_Tracking_Master.xlsx - Main (1).csv`
  - Current workbook tracks TM, warehouse ID, location, active/exit state, audit status, due dates, audit type, result returned, outcome, reason, activity, action, and form across repeated audit/reconciliation cycles.

### Platform PRD and traceability

- `docs/client-scope-confirmation-2026-04-20/05_CONSIGNMENT_PRD.md`
  - Scope includes pre-warehouse onboarding, agreement, Acumatica-linked transfer/receipt visibility, BLUE baseline, ROSE audit cycles, reconciliation, discrepancy handling, shared mailbox work queue, and PO follow-up.
  - It explicitly separates audit completion from reconciliation and says the PO clock starts only after true-up review.
- `docs/requirements-mapping/CONSIGNMENT_REQUIREMENTS_MAP_2026-04-30.md`
  - Correctly documents the boundary rule: Pulse can build workflow, visibility, documents, audit capture, reconciliation control, mailbox work items, and reporting scaffolds now.
  - Acumatica-owned truth must stay parked until sandbox access, certified endpoints, sample records, and signed mappings exist.

### Platform implementation evidence

- `packages/db/prisma/migrations/20260430103000_consignment_program_foundation/migration.sql`
  - Implements site, form, audit, audit line, discrepancy case, and work item tables.
- `packages/db/prisma/migrations/20260520000000_consignment_audit_evidence_upload/migration.sql`
  - Adds audit evidence upload support.
- `packages/contracts/src/consignment.ts`
  - Defines site statuses, form types, form statuses, audit/reconciliation statuses, site summaries, forms, audit lines, audit evidence, work items, and account read model contracts.
- `apps/api/src/modules/consignment/service.ts`
  - Implements site creation, scoped reads, readiness, document register behavior, BLUE baseline activation, ROSE completion, evidence upload, 90-day scheduling, and parked Acumatica boundary metadata.
- `apps/api/test/consignment.regression.test.mjs`
  - Covers site master creation, forms/current document behavior, activation gates, RBAC, scoped reads, account read model, ROSE scheduling, evidence upload, operational queue filters, and parked warehouse boundary.
- `apps/crm-web/src/components/consignment/ConsignmentWorkspace.tsx`
  - Implements the ranked "Next Site Work" operator surface, create site modal, reports view, all-sites search, and parked wording.
- `apps/crm-web/src/components/consignment/ConsignmentSiteDetail.tsx`
  - Implements agreement/BLUE actions, activation, ROSE schedule/finish flow, site issue logging, evidence/history disclosure, and readiness checks.
- `apps/mobile/src/hooks/use-consignment-rose-audit.ts`
  - Implements mobile ROSE load, manual count entry, notes, attestation, photo evidence, CRM submit, and offline draft metadata.

## Current Coverage Verdict

| Area | Current Platform Coverage | Verdict |
| --- | --- | --- |
| Consignment site master | Durable account/location-linked sites with ownership, status, readiness, and scoped reads exist. | Strong foundation |
| Acumatica boundary | Warehouse/ERP truth is marked parked and not faked. | Correct approach |
| Agreement and BLUE baseline | Agreement and BLUE form register exists; BLUE can establish baseline and next audit date. | Useful but needs richer document workflow |
| ROSE scheduling | 90-day helper and next audit reset exist. | Partial |
| ROSE field execution | Mobile supports manual counts, notes, attestation, evidence photos, and offline draft metadata. | Partial |
| Audit vs reconciliation split | Status model supports separate audit and reconciliation states. | Model exists |
| True-up before PO clock | ROSE variance opens true-up review first; PO clock starts only after `po_required`. | Closed to manual boundary |
| Shared mailbox/history | Work items exist, but no real correspondence history, owner/last contact/escalation state depth. | Gap |
| PURPLE adjustment | Request, approval work item, document link, and Pulse manual baseline update are implemented. | Closed to manual boundary |
| SAND exit | Notice, final reconciliation, return/retain, settlement reference, work item, and exited transition are implemented. | Closed to manual boundary |
| Warehouse Visit Tracking replacement | Reports exist as summary cards, but not workbook-grade operational reporting/export. | Gap |
| Acumatica transfer/receipt/inventory truth | Parked until sandbox, samples, endpoints, and mappings are available. | Correctly parked |
| Dealer/customer visibility | Internal-only phase is documented. | Correct for now |

Overall current coverage:

- Full PRD coverage including Acumatica-dependent work: about 62-65%.
- Buildable-now coverage excluding Acumatica posting/sync dependencies: about 78-80%.
- Target before Acumatica access: about 85% is reachable by finishing workbook-grade reporting and manual mailbox history.

## Highest-Risk Functional Gap

The highest-risk gap is the true-up checkpoint.

The PRD and Samantha's clarification say:

1. TM completes on-site ROSE audit.
2. Back office reviews open POs, in-transit product, transfer/receipt status, and known replenishment.
3. Only after true-up confirms a real unresolved consumption/missing discrepancy should the five-business-day PO clock start.

Current service behavior:

1. TM completes an audit with any variance.
2. Service creates a discrepancy case.
3. Service sets `trueUpConfirmedAt` to audit completion time.
4. Service creates PO follow-up due in five business days immediately.

That means the platform has the right tables and statuses, but the process gate is compressed too early. This can cause false PO chasing when the variance is actually explained by open PO, in-transit product, receipt timing, or manual baseline error.

## Product Design Direction

The consignment module should not be presented as a generic data-management area. The easiest mental model for Dynamic AQS users is:

1. "Set up the site"
   - Agreement, setup handoff, warehouse reference, BLUE baseline.
2. "Do the field audit"
   - TM completes ROSE on mobile with counts, notes, photos, and attestation.
3. "Review what changed"
   - Ops/Samantha reviews variance, open POs, in-transit product, receipt status, and inventory movement context.
4. "Chase only what is real"
   - Start PO clock only after true-up confirms a real unresolved customer action.
5. "Adjust or exit when needed"
   - PURPLE changes baseline; SAND closes the program.

Recommended navigation for the CRM consignment workspace:

- Default view: `Next Site Work`
  - Due audits
  - Setup handoffs
  - True-up reviews
  - PO follow-ups
  - Exit/adjustment work
- Site detail: one guided timeline
  - Agreement -> Setup -> BLUE -> ROSE -> True-up -> PO follow-up -> PURPLE/SAND events
- Reports: workbook replacement
  - Site health
  - Audit due status
  - Open true-ups
  - PO follow-up aging
  - Exited/exit-in-progress
  - Exportable operational table matching Samantha's workbook columns

Avoid first-paint clutter. Show the next action first, then reveal evidence/history in collapsible sections.

## Buildable-Now Gaps

These do not require Acumatica access if we keep them honest and manual/parked where needed.

### Gap 1: True-up workbench and PO clock gate

Needed:

- Add an explicit true-up action/state that lives between ROSE audit variance and PO follow-up.
- Variance completion should create a `TRUE_UP_REVIEW` or `VARIANCE_REVIEW` work item, not a PO follow-up clock immediately.
- Add API action: confirm true-up.
- On true-up confirmation:
  - record `trueUpConfirmedAt`
  - start `poDueAt`
  - create PO follow-up work item
  - keep Acumatica PO creation parked
- Add reason taxonomy:
  - found on site
  - open PO explains variance
  - in transit / receipt pending
  - confirmed consumed
  - missing / write-off review
  - baseline correction
- Update regression tests so PO follow-up is not created on audit completion until true-up is confirmed.

Why this matters:

- It is directly traceable to Samantha's "two separate processes" clarification.
- It prevents false PO escalation and makes the module operationally trustworthy.

### Gap 2: Workbook-grade reporting

Needed:

- Add a report table that mirrors the Warehouse Visit Tracking Master columns:
  - TM
  - account/location
  - warehouse reference
  - inception date
  - active/exited
  - next audit due
  - next scheduled audit
  - last audit date
  - latest reconciliation
  - audit type
  - result returned
  - outcome
  - reason
  - activity
  - action
  - form/evidence link
- Add export CSV.
- Add filters by TM, status, due bucket, outcome, action, and form type.
- Use available Pulse data now; label Acumatica-derived columns as parked/manual until sync arrives.

Why this matters:

- Samantha's current operational control is the workbook. Replacing it requires matching its monitoring power, not only showing summary cards.

### Gap 3: Shared mailbox and outreach history

Needed:

- Extend work item/manual correspondence model with:
  - owner
  - last contact date
  - inbound/outbound direction
  - customer response needed
  - escalation status
  - linked site/audit/form/discrepancy/PO follow-up
  - external thread/ref placeholder
- UI should show this as a "Contact history" or "Follow-up history" timeline on site detail.
- Mailbox API ingestion remains parked until provider access, but manual records can be built now.

Why this matters:

- Discovery says the shared mailbox and Dropbox/TM folders hold the real operational history today.

### Gap 4: PURPLE adjustment workflow

Status as of 2026-06-07: closed to the Pulse-owned manual boundary.

Needed:

- Add guided action: "Adjust baseline". `Implemented`
- Capture:
  - add/reduce
  - SKU/product
  - current quantity
  - requested quantity
  - new baseline proposal
  - reason
  - customer acknowledgement/evidence
  - approval status
- Update Pulse baseline only after manual approval. `Implemented`
- Park Acumatica posted adjustment until inventory adjustment endpoint certification. `Still parked by design`

Why this matters:

- Samantha explicitly described adjustment forms and activity folders as the audit trail for inventory going up/down.

### Gap 5: SAND exit workflow

Status as of 2026-06-07: closed to the Pulse-owned manual boundary.

Needed:

- Add guided action: "Exit consignment". `Implemented`
- Capture:
  - written notice
  - final joint reconciliation
  - return expected
  - retain/invoice expected
  - settlement evidence placeholder
  - return/disposition notes
  - closure approval
- Transition site to `exiting`, then `exited`. `Implemented`
- Park invoice/credit memo/financial settlement posting until Acumatica access. `Still parked by design`

Why this matters:

- The SAND form is a named current document and PRD requirement, not a future nice-to-have.

### Gap 6: Onboarding pipeline depth

Needed:

- Add a simple onboarding pipeline view:
  - interest captured
  - agreement sent
  - agreement signed
  - ready for setup
  - setup pending
  - BLUE pending
  - active
  - stalled/abandoned
- Show stalled duration and owner.
- Add "what is blocking this site?" reason.

Why this matters:

- PRD asks for visibility into customers who start consignment but are not warehouse-ready yet.

### Gap 7: Form vocabulary and evidence semantics

Needed:

- Keep Samantha's operational labels visible:
  - BLUE - Initial Verification
  - ROSE - 90-day Reconciliation
  - PURPLE - Inventory Adjustment
  - SAND - Program Exit
- Avoid hiding these as only "Baseline form", "Cadence form", "Quality form", or "Setup packet".
- Forms should have status, current version, source, evidence link, and notes.

Why this matters:

- The color names are not decorative; they are the team's existing operating vocabulary.

### Gap 8: Mobile barcode and offline evidence hardening

Needed:

- Barcode scan remains parked until product/SKU/barcode mapping is confirmed.
- Buildable now:
  - better offline conflict states
  - retry queue visibility
  - draft review before submit
  - evidence upload retry when back online
  - explicit "expected data may be stale/manual" label

Why this matters:

- Mobile ROSE is central for TMs, but authoritative barcode/product identity depends on product/Acumatica mapping.

## Explicitly Parked Dependencies

These should stay parked until Acumatica and provider access are available:

| Parked Item | Why Parked | Resume Trigger |
| --- | --- | --- |
| Warehouse creation/posting | Acumatica owns restricted warehouse setup and financial fields. | Sandbox credentials, endpoint behavior, sample warehouse records, signed field mapping |
| Transfer order and receipt truth | Non-revenue transfer and receipt are ERP-owned. | Certified transfer/receipt endpoints and fixtures |
| Inventory on hand and authoritative SKU/barcode list | Acumatica/product mapping is the source of truth. | SKU/barcode/product mapping signoff |
| PO/sales order/invoice/credit memo posting | Financial truth belongs to Acumatica. | Certified PO/order/invoice endpoints |
| Mailbox ingestion | Provider access and mailbox policy not finalized. | Mailbox provider access and delivery rules |
| E-sign automation | Legal/template/provider flow not finalized. | E-sign vendor and agreement template decision |

## Recommended Next Implementation Slices

### Slice CSG-TU1: True-up Workbench and PO Clock Gate

Priority: P0

Goal:

Make ROSE audit completion, true-up review, and PO follow-up start three separate states.

Backend:

- Add/adjust work item type for true-up review.
- Change `completeAudit` so variance creates a true-up review item, not a PO follow-up item.
- Add endpoint/action to confirm true-up and start the five-business-day PO clock.
- Store reason/resolution details.
- Update tests to prove PO clock does not start until true-up confirmation.

CRM:

- Add "Needs true-up" rows in Next Site Work.
- Add true-up review modal on site detail:
  - variance lines
  - reason
  - disposition
  - start PO clock yes/no
  - notes/evidence
- Make "PO follow-up" appear only after true-up confirmation.

Mobile:

- Keep TM flow simple: submit ROSE audit only.
- Mobile should not start PO clock.

Acceptance:

- A variance ROSE audit creates a true-up task.
- No PO due date exists after audit completion alone.
- Confirming true-up starts PO clock and creates follow-up task.
- Regression tests cover no-variance, variance-not-true-up, true-up-confirmed, and parked Acumatica states.

### Slice CSG-REP1: Samantha Workbook Replacement Report

Priority: P0/P1

Goal:

Give Ops/Samantha a report table that can replace the current Warehouse Visit Tracking Master over Pulse-owned data.

Deliver:

- Exportable report table.
- Saved filters/due buckets.
- Drilldown from summary row to site detail.
- Manual/acumatica-parked columns clearly labeled.

### Slice CSG-PUR1: PURPLE Adjustment Workflow

Priority: P1

Goal:

Track baseline changes without pretending ERP inventory posting is complete.

Deliver:

- Adjustment request form.
- Approval/status workflow.
- Evidence/current form version.
- Manual baseline proposal.
- Parked Acumatica adjustment posting note.

### Slice CSG-SAND1: SAND Exit Workflow

Priority: P1

Goal:

Formalize consignment exit/disenrollment with evidence and closure controls.

Deliver:

- Exit checklist.
- Final reconciliation state.
- Return/retain/invoice placeholders.
- Closure approval.
- Site status transition to `exiting`/`exited`.

### Slice CSG-MBX1: Manual Mailbox/Outreach History

Priority: P1

Goal:

Capture shared mailbox style follow-up manually now, before mailbox automation.

Deliver:

- Correspondence timeline.
- Last contact/escalation fields.
- Work item owner and next action.
- External thread/reference placeholder.

### Slice CSG-MOB2: Mobile ROSE Hardening

Priority: P1

Goal:

Make the TM field flow safer while Acumatica/barcode mapping remains parked.

Deliver:

- Offline queue review.
- Evidence retry.
- Draft conflict state.
- Better stale/manual expected-data labeling.
- Barcode placeholder stays parked until mapping signoff.

## Immediate Recommendation

Start with CSG-TU1.

Reason:

- It is the most direct requirement mismatch.
- It protects Dynamic AQS from chasing customers incorrectly.
- It does not require Acumatica access.
- It uses existing DB/contracts/work item foundations.
- It makes the current module feel much closer to Samantha's real workflow.

After CSG-TU1, do CSG-REP1 so Samantha can validate whether Pulse is truly replacing her workbook.

## Production Readiness Verdict

The consignment module is a production-capable foundation, but not production-complete for Samantha's process yet.

Safe to say:

- The platform has the correct broad architecture and honest Acumatica boundary.
- Site/form/audit/work item foundations are real.
- Mobile ROSE is a meaningful first field-execution slice.

Not safe to say yet:

- Full consignment process is complete.
- Samantha's workbook is fully replaced.
- Mailbox history and escalation reporting are fully replaced.
- PURPLE/SAND lifecycle is complete beyond the manual boundary.
- Acumatica-linked inventory/transfer/receipt/PO truth is available.

Target state before Acumatica access:

- Reach about 85% buildable-now coverage by completing workbook-style reporting and manual mailbox history.
