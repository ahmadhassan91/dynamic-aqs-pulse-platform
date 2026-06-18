# PRD Scope-Accuracy Audit — 2026-06-18

After the Pricing PRD was found to over-attribute the price-update engine to Dan (it was vendor-proposed; Dan's position was "Pulse consumes price, the engine stays separate" — see `11_PRICING_PRICE_UPDATE_PRD.md` §0), every module PRD was re-checked the same way: client-attributed / "confirmed" / "in-scope" requirements were verified against the **actual cited meeting transcripts** (under `dynamic-aqs-crm/Meetings/`). Speaker roles: Dan Harshbarger, C G (Curry), Don Hearn, Michelle Hogan, Samantha Marks, Adrienne/Rick Cardinale, Steve Mores, Betsy, Johan Ericsson = client/Dynamic AQS; Ahmad Hassan, Muhammad Majid, Maryam Zahid, Salman Shakeel = Clustox (vendor).

**Headline:** the pricing pattern is not isolated — **5 HIGH** over-attributions (a sizeable feature written as client-confirmed that the transcript does not support, or contradicts) recur, plus a set of MEDIUM and LOW corrections. Several PRDs are clean. None of these change what is already built; they make the PRDs honest before scope-lock. Each affected PRD carries its own dated "Scope correction" note; this doc is the program rollup.

## 🔴 HIGH — sizeable scope attributed to the client but not supported

1. **Training — mandatory completion proof/outcome gating (FR-TRN-031, FR-TRN-040).** CONTRADICTED. Curry, Session 4: *"I think it would just be completed … we're not doing any kind of evaluations."* The cited "eliminate excuses for entering data" was about navigation friction, not proof gating. → Make completion proof/outcome OPTIONAL (vendor-proposed configurable rigor); strike the SRC-TRN-001 citation as support for mandatory proof.

2. **CIS — required Sales/BD sign-off gate (FR-CIS-015/016, BR-CIS-05/06, ASM-CIS-02).** Not in cited transcripts; a BD-review gate was *objected to* — Michelle, Session 1: a BD-review-before-advance idea *"would just slow the process … I don't necessarily like that."* → Reattribute as vendor-designed workflow; mark as open; record Michelle's objection.

3. **Consignment — near-real-time / "15-minute" inventory sync SLA (FR-CSG-043/034, OQ-CSG-06).** The number was vendor-proposed — Ahmad, Session 10: *"minute by minute accuracy, right?"*; C G only echoed *"within a 15 minute accuracy … ?"* → *"Yes."* The client confirmed only that inventory *is* a moving target (Samantha). → Downgrade the numeric SLA to an open question; keep only the supported requirement (discrepancy logic must consider in-transit/POs before flagging).

4. **DAM — "Decision reached in Session 12: replace Widen with S3 + CloudFront."** It was a vendor proposal the client was amenable to, with the prototype *pending review* at session close — Ahmad: *"I will … shape that so you guys can see this can be a [re]placement for widen … I will upload a link";* C G: *"We'll look for that link."* No client line ratified the replacement or the architecture. → Reword to "vendor-proposed; client review pending"; demote "replaces Widen entirely" to a proposal (consistent with OQ-DAM-001/002).

5. **Dealer Portal — expedited-shipping selection with estimated cost delta (FR-DPO-035).** Dan scoped shipping OUT of the portal, Session 2: *"not charged a credit cards, not figure out the shipping not [do] tracking, do that in a[cumatica]";* in Session 7 he problematized expedited (FedEx cutoff) and wanted only an approximate algorithm. No transcript supports a per-option cost-delta display; it contradicts the PRD's own parked-shipping row. → Move FR-DPO-035 to Parked/Phase-2; drop the cost-delta acceptance criterion.

## 🟠 MEDIUM

6. **CIS — ASM-CIS-03 "card on file required for all accounts."** Michelle, Session 1: *"We have to collect that credit card up front"* — then *"Good exceptions … larger PE's … we just give them a credit line out of the gate … So I don't know"*; C G: *"also people on consignment."* → Soften to "default expectation, with confirmed PE + consignment exceptions; universality unresolved (OQ-CIS-06)."

7. **Training — certification lifecycle (FR-TRN-053/054 expiry/recert/revocation) + reward linkage (FR-TRN-055).** Client confirmed only two cert *names* + completion *tracking*; the lifecycle was *"that'd be nice" / "if it ties to our training website"* and Don: *"I got to think that one over";* rewards were deferred — Michelle: *"when we start playing with it, that's when we'll be able to better describe … what we might want."* Certs may remain on the external training site that "may go away." → Keep cert names + completion tracking; demote lifecycle/recert/revocation + reward-linkage to vendor-proposed pending OQ-TRN-001/005/008.

8. **Consignment — FR-CSG-035 "create/link PO in Acumatica."** PO posting is Acumatica-owned; the client asked Pulse only to *match* incoming POs (Samantha, Session 10). Contradicts the PRD's own boundary rule 4A.6 ("Pulse never posts a PO"). → Reword to "link/reference the Acumatica-posted PO."

9. **Dealer Portal — gift-card/coupon (FR-DPO-037) + payment-decline alert (FR-DPO-016).** FR-DPO-037 was a brainstorm — Dan, Session 7: *"this is too much … it would be nice if …";* FR-DPO-016 presumes payment-failure data from a payment integration the same PRD parks. → Reframe both as candidates pending their open questions / gate FR-DPO-016 on the parked payment feed.

10. **Admin — ASM-AD-08 routing threshold "Dan confirmed ≤5 trucks / C G noted technician count."** The ≤5 threshold was vendor-spoken (Ahmad, Session 4); the client agreed to the *concept* with a bare "Yes"; the exact number and the technician-count caveat are not in the cited transcript. → Reword to "vendor-proposed ≤5; client agreed to the routing concept; exact boundary/basis unconfirmed (OQ-AD-04)."

11. **Territory — SRC-TR-002 mis-sourced.** Session 6 (a consignment walkthrough) is credited with "TM and RD field roles" + "leadership/dev use of map for assignment"; that content is actually in Session 1 (Michelle/C G) and Session 10. The MMC-replacement line in S6 was a vendor *"I hope"* (Muhammad Majid), not a client confirmation. → Re-point those topics to SRC-TR-001 (S1) + a Session-10 source; attribute MMC-replacement to C G, Session 1.

## 🟡 LOW (speaker / sourcing nits; substance is sound)

- **Leads** — FR-L-018 seven-stage pipeline enumeration was vendor-presented (Maryam, Session 4) and sent to the client for review; the lifecycle *concept* is confirmed, the specific enumeration is "pending client field-list review," not 16/18-Feb confirmed.
- **CIS** — "validated stage model" (ASM-CIS-09) was the Session-4 vendor walkthrough, not Session-3-validated.
- **Training + Calendar** — the "~16 hours/year double-entry" figure is a vendor estimate Curry questioned (Session 5: *"that's … hard to quantify"*) → label "vendor-estimated."
- **Mobile** — FR-MOB-060 tap-to-call is CG only (not Don); the "auto-log-as-disposition" detail is design-inferred. Add Session 4 to the Source Inventory (it backs the route-builder but isn't listed).
- **Reporting** — FR-RPT-016 revenue-by-manager was vendor-demo'd; the genuine territory-sales pain (Dan, *"all the sales in Florida, SC, Georgia"*) is in the uncited Discovery Session 1 — add it. "Power BI mentioned by Dan" → it was Ahmad (vendor).
- **DAM** — FR-DAM-009 brand-scope quote is Johan (multi-site propagation), not Adrienne; the scope-field granularity is code-derived.
- **Acumatica** — FR-ACU-029 "base price" source-of-truth should be **price class** (base/list price originates in the external pricing engine, reflected via Acumatica — cross-ref Pricing §0); push-notification availability is inferred from generic 2024 R2 docs, not the client's instance → qualify.
- **Accounts** — FR-ACC-005 tab quote is a paraphrased composite (substance — profile/training/sales tabs — is supported); mark as paraphrase.

## ✅ Clean — no material over-attribution
**Accounts (06), Calendar (04), Acumatica (15)** (honestly parked throughout), and the bulk of **Mobile (08), Reporting (10), Admin (09)**. Importantly, financial/order/credit-hold/revenue reporting is correctly **parked behind Acumatica** across the program — the specific mistake Pricing made was *not* repeated elsewhere.

## Method note
Each finding was verified by opening the cited transcript and quoting the actual line; where a claim could not be supported the auditor recorded "not found in cited transcripts." This audit covers client-attribution accuracy only — it is not a completeness or build-status audit. Recommended follow-up: a human SME pass to ratify the HIGH items (they change what should/shouldn't be built), and add the two missing source citations (Reporting → Discovery Session 1; Mobile → Session 4).
