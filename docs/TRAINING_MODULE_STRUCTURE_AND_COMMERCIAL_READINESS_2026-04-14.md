# Training Module Structure And Commercial Readiness

## Summary

The current Pulse foundation is commercially flexible enough to support the Training module safely.

That is true because the platform already has:

- one shared `Account` / `Contact` / `AccountLocation` core
- explicit business-segment fields on `Lead` and `Account`
- governed segment assignments and classification exceptions
- territory ownership and history structures that can be extended later

However, the Training module itself should be designed as:

- `account-centric`
- `territory-linked`
- `segment-aware`
- `mobile-first for execution`
- `provider-abstract` for Outlook / Teams / WebEx

It should **not** be designed as:

- a residential-only workflow
- a single boolean `trainingCompleted` flag
- a pure calendar module
- a technician-only roster with no account context

---

## Commercial Readiness Verdict

### Yes, the foundation is commercially safe

The existing backend shape already supports commercial-safe training because:

1. `Lead` and `Account` already carry explicit business-segment linkage.
2. `AccountSegmentAssignment` already supports future mixed / evolving account classification.
3. `ClassificationException` already provides a governed way to handle drift and ambiguity.
4. The architecture intentionally keeps one shared relational core instead of splitting residential and commercial.

### What that means for training

We do **not** need a second training schema later just because commercial comes in-scope.

Instead, the training module should:

- schedule and record training against the shared `Account`
- classify sessions by `training type`, `category`, and `segment scope`
- allow commercial-specific programs later through additional templates/program types
- keep residential and commercial separated in reporting and rules, not by duplicating the whole module

### What is still not commercial-operational

The current platform is not yet fully ready for commercial territory behavior:

- state-based territory is in place today
- county/overlay commercial territory logic is still later work

That is acceptable for now, because training can still be modeled correctly on top of account + segment + territory references.

---

## What Discovery Confirms

### Training is account-centric, not lead-centric

Training is for customers/accounts and must stay tied to account context, account history, and territory ownership.

### Training belongs with territory operations

Training is operational field work and should remain closely linked with territory execution, customer support cadence, and RD/TM visibility.

### Pulse should own workflow truth

Pulse creates and governs the schedule; Outlook reflects it later. The CRM cannot remain a passive after-the-fact note store.

### Mobile is part of the module, not an afterthought

The mobile app is not just a companion UI. It is where field training execution, check-in/out, notes, proof, and follow-up scheduling happen.

### Site visits and training sessions are not the same thing

They are both customer touches, but training cadence/compliance must not be polluted by generic site visits.

### Technician participation matters, but the participant model must stay pragmatic

Technicians are important for certifications and attendance, but the module should support a lighter participant model where needed instead of forcing every attendee into the full primary CRM contact model.

---

## Training Types Confirmed In Discovery

The evidence supports a layered catalog, not one flat hardcoded list.

### Core categories

- `Onboarding`
- `Product`
- `Technical`
- `Sales`
- `Compliance`
- `Certification`
- `Custom Presentation`
- `Site Visit`

### Specific training types explicitly evidenced

- `3-session onboarding`
- `Comfort Advisor`
- `CSR / Office Staff`
- `Fix It Stars`
- `Gasses, Odors & Oxidation`
- `Germs & UVC Energy`
- `Grid Training`
- `Grid / H&W Hybrid`
- `How & When`
- `HEPA-Bypass`
- `Humidifier`
- `Jeopardy`
- `Management`
- `Objection Handling`
- `Pan Treatments`
- `Role Play`
- `Outbound Calling`
- `IAQ / technician certification-related training`
- `Custom account-specific presentation`

### Adjacent but related tracked items

These should be associated to training, but not collapsed into “training completed”:

- contests
- giveaways
- demo products
- free materials
- certification outcomes
- external training-site completions

### Current certification programs confirmed by artifact

Michelle’s shared training-site screenshot confirms at least two active certification/curriculum tracks at the moment:

- `IAQ Certification Curriculum`
- `Product Installations`

Implication:

- these should be seeded as initial `CertificationProgram` records
- they should not be the only allowed certification values long-term
- `Product Installations` should be modeled as a certification-capable technical program, not just a generic session label

---

## Recommended Module Structure

### 1. Training Catalog Layer

Use admin-managed reference entities:

- `TrainingCategory`
- `TrainingType`
- `TrainingTemplate`
- `TrainerProfile`
- `TrainingCadencePolicy`

Recommended attributes:

- category
- title
- description
- default duration
- delivery mode
- segment scope
- proof requirement
- whether it counts toward compliance
- whether it counts toward certification
- whether it is customer-facing or internal

### 2. Account Training Program Layer

Use program records to group related sessions:

- `AccountTrainingProgram`
- `AccountTrainingRequirement`

Examples:

- onboarding 3-session program
- quarterly follow-up program
- certification prep program
- custom account enablement plan

This is where we keep:

- program status
- owning territory / TM / RD
- recommended cadence
- overdue logic
- customer-specific exceptions

### 3. Session Execution Layer

Use explicit session records:

- `TrainingSession`
- `TrainingSessionAttendee`
- `TrainingSessionNote`
- `TrainingSessionProof`
- `TrainingSessionOutcome`
- `TrainingFollowUpTask`

This is the operational layer that mobile will drive.

Recommended session fields:

- account
- location
- training type
- scheduled start/end
- actual start/end
- trainer
- TM / RD owner
- session mode (`virtual`, `onsite`, `hybrid`)
- activity classification (`training`, `site_visit`, `audit`, `meeting`)
- status
- outcome
- notes
- proof metadata

### 4. Certification Layer

Use a distinct certification model:

- `CertificationProgram`
- `CertificationRequirement`
- `CertificationRecord`
- `CertificationParticipant`

This is needed because the business explicitly distinguishes normal training from certification outcomes.

Recommended starting seeds:

- `IAQ Certification Curriculum`
- `Product Installations`

### 5. Promotion / Incentive Layer

Do not overcomplicate ROI attribution in Phase 1, but do track:

- `TrainingPromotion`
- `TrainingPromotionItem`
- estimated value
- notes

That supports contests, giveaways, demos, and free materials without pretending we can perfectly attribute downstream sales.

### 6. Read Models / Reporting Layer

Training reporting should be built from read-friendly facts, not inferred from raw notes.

Suggested reporting facts:

- completed sessions
- hours delivered
- overdue accounts
- certifications awarded
- attendance counts
- visits vs trainings
- region / TM / RD rollups
- program completion
- promotion value delivered

---

## Mobile-Driven Requirements

The training module should be structured so the mobile app can later consume it directly without redesign.

### Mobile needs first-class APIs for:

- today / week / month agenda
- check-in
- check-out
- activity classification
- attendance capture
- quick notes
- voice-to-text note payloads
- proof photo upload
- follow-up creation
- next session scheduling
- overdue training queue
- account training history

### Mobile guardrails

- cannot check out without core notes
- cannot log a site visit as a compliant training session by mistake
- check-in / check-out timestamps must be persisted as structured data
- month view must exist for forward scheduling
- training completion must be easy enough to remove Friday reconciliation work

---

## Key Design Decisions I Recommend

### 1. Trigger onboarding training from customer activation / first-order readiness, not older credit-approval wording

The PRD still contains older wording tied to credit approval. The safer long-term model is to anchor training to the post-conversion account/customer lifecycle.

### 2. Keep provider abstraction

Use generic meeting fields and sync adapters:

- `calendarProvider`
- `externalEventId`
- `meetingUrl`
- `providerMetadata`

Do not hardcode WebEx into the schema.

### 3. Make training segment-aware now

Add segment scope to training types/templates/programs so future commercial programs fit without redesign.

### 4. Support a lighter attendee model

Do not force every technician into the full top-level contact model. Support:

- linked CRM contacts where appropriate
- lightweight participant records where needed

### 5. Separate visits from trainings

A visit is a touch.
A training is a structured enablement event.
They can share workflow mechanics, but not the same compliance semantics.

---

## What Should Be Parked For Later

- final Outlook / Graph production registration
- Teams / WebEx provider-specific meeting creation
- external training-site retirement decision
- deep ROI attribution to downstream sales
- commercial county/overlay territory logic

---

## Build Order Recommendation

1. training catalog and templates
2. account training programs and cadence rules
3. session scheduling and account history
4. attendance, notes, proof, and follow-up
5. mobile execution APIs
6. certification tracking
7. overdue reporting and dashboard widgets
8. Outlook/provider sync hardening
