# Training Requirements Map

Date: 2026-04-16

Primary source documents:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/TRAINING_MANAGEMENT_PRD.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/MOBILE_APP_PRD.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/REPORTING_REQUIREMENTS_MASTER.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/17th March  session 10-To-Be consognment and App.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asispricingdocuments/Training Catagories.pdf`

## Newly surfaced or reinforced from meetings and shared artifacts

- Training is one of Dynamic’s highest-value customer-retention motions, not just a scheduling feature.
- Dynamic wants a centralized training calendar visible to BD leadership, admins, TMs, and RDs so nobody has to ask each TM individually what is scheduled.
- The CRM should ideally be the place where a training is scheduled and then reflected to Outlook, not the other way around.
- Training catalog flexibility matters. There are standard dropdowns, but admins also want to add, retire, and customize training types over time.
- Quarter-to-six-month no-contact/no-training exception reporting is a real requirement.
- Certification is real, but attendee-level granularity is nuanced: they want certification and history, but not a heavyweight technician master for every individual unless necessary.
- Giveaways, demo equipment, contests, and value delivered alongside training matter, but they are adjacent to training rather than the same thing.

## Current coverage map

| Requirement | Meeting / artifact evidence beyond PRDs | Status | Current implementation evidence | Hardening / next action |
| --- | --- | --- | --- | --- |
| Account-centric training model | Meetings consistently describe training against customer accounts after conversion/first-order boundary | Implemented | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/training/service.ts`, customer training history | Keep this boundary strict |
| Territory-linked training operations | TMs and RDs own ongoing training cadence and visibility | Implemented | training-account-territory linkage in training service and read models | Add richer reporting by TM/RD/state |
| Centralized training calendar | Intro meeting and training session 4 strongly validate one shared calendar | Partial | `/calendar` exists and shows training events, but broader training/admin visibility and event-family coverage still need hardening | Finish calendar/reporting integration and pilot rollout |
| CRM-first scheduling reflected to Outlook | Don and Curry explicitly asked for schedule-in-CRM, reflect-to-Outlook behavior | Partial | centralized scheduler plus Outlook sync foundation exist | Complete pilot validation, shared calendars, and meeting-provider policy |
| Admin-managed training catalog and dropdowns | Meetings explicitly ask for admin flexibility in dropdown values | Implemented (core) | catalog/category/template model and training workspace | Add fuller catalog admin UX and lifecycle governance |
| Standard training types plus custom presentations | Michelle/Curry asked for both dropdown standardization and customizable presentation entries | Partial | current model supports categories/templates and certification seeds | Add admin-managed “custom presentation” handling and subtype governance |
| Certification tracks and history | Michelle shared certification evidence and training website context | Implemented (core) | certification program and record model | Add expiry, renewal, printable certificate, and external-site coexistence rules |
| Mobile-ready execution with check-in/check-out and required notes | Session 10 strongly validated this flow | Implemented (core) | training Slice C backend/UI contracts | Carry the same rules into the mobile UI later |
| Voice-to-text and quick field logging | Session 10 explicitly validates voice-to-text style logging | Partial | backend supports notes/proof hooks, but not a dedicated voice transcription workflow | Add mobile/field transcription path when mobile execution slice resumes |
| Distinguish training from site visits and other touches | Reporting master and meetings say this is crucial | Implemented | training model separates site visits and training sessions | Preserve this distinction in calendar/reporting/mobile |
| Quarter-to-six-month exception reporting when an account has not been trained | Michelle explicitly asked for this | Partial | current history exists, but exception reports are not closed | Build reporting/alerts slice next |
| Training completion can be lightweight for standard sessions | Meeting said “completed is completed” for most trainings | Implemented (core) | completion flow exists | Keep simple completion path while allowing certification-specific depth |
| Rich attendee/participant handling where needed | Meetings also mention technician certification and counts | Partial | no rich participant roster yet | Add attendee model before saying training is 90% complete |
| Contest/giveaway/value attribution adjacent to training | Session 4 explicitly discusses contest/demo tracking as attached to a training context | Missing | no explicit training-adjacent value-attribution model yet | Add linked promotion/value-delivered records, likely shared with account history/reporting |
| Dynamic training website coexistence | Michelle explicitly said the training website may go away but must be accounted for | Partial | documented boundary exists | Define import/coexistence and certificate migration policy |
| Outlook/Graph provider-connected scheduling | Meetings strongly want it | Partial | provider connection and sync foundation exist in calendar/outlook slice | Finish real pilot validation and fallback behavior |
| Meeting-provider policy (Teams/WebEx) | Meetings mention Teams and WebEx in different contexts | Decision | current calendar/outlook model has meeting-provider preference but no final business policy | Lock the allowed provider set and fallback rules |

## Meeting-to-implementation gaps that were easy to miss from PRDs alone

- Training reporting and exception handling are part of the product value, not an afterthought.
- Custom presentations and frequently changing dropdown values matter operationally.
- Training and contest/value-delivered tracking are related but not identical; the system needs both.
- The external training site cannot be treated like an afterthought because it carries certifications, free video books, and tracking expectations.

## Hardening priority to approach 90%

1. Build D0 reporting and exception views.
2. Add attendee/technician roster support and certification operations.
3. Add training-adjacent value/giveaway attribution model.
4. Finalize Outlook-connected training scheduling with real pilot users.
5. Define external training-site coexistence/import rules.
6. Then continue mobile UI parity on top of the now-stable backend contracts.
