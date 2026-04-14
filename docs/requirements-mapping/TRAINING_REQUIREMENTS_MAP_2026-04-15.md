# Training Requirements Map

Date: 2026-04-15

Primary source documents:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/TRAINING_MANAGEMENT_PRD.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/MOBILE_APP_PRD.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/REPORTING_REQUIREMENTS_MASTER.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/ALERTS_NOTIFICATIONS_COMMUNICATION_PRD.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/17th March  session 10-To-Be consognment and App.md`

| Requirement | Source | Status | Implementation Evidence | Hardening / Next Action |
| --- | --- | --- | --- | --- |
| Account-centric training model | Training PRD + discovery | Implemented | training schema/programs, customer training history, service layer | Keep lead and training ownership boundaries clear |
| Territory-linked training operations | Training discovery + territory expectations | Implemented | training programs and history linked to account/territory context | Add richer territory reporting later |
| Segment-aware / commercial-ready training foundation | source-of-truth commercial guidance | Implemented | training structure docs and schema direction support segment-aware extension | Preserve in every future schema change |
| Admin-managed catalog, categories, templates | Training PRD | Implemented | training module Slice A, training workspace, regression suite | Expand catalog management UI as needed |
| Certification tracks and current seed programs | Michelle evidence + training discovery | Implemented | seeded certification programs for IAQ Certification Curriculum and Product Installations | Add richer certification operations |
| Scheduling and session lifecycle | Training PRD | Implemented | training Slice B service/UI/regressions | Good foundation for later provider sync |
| Mobile-ready execution: check-in, check-out, notes, proof hooks | Mobile app + training discovery | Implemented | training Slice C backend and UI, regressions | Carry same contracts into mobile later |
| Certification outcomes/history | Training discovery + certification need | Implemented | certification issuance/history in training module | Add expiry/renewal/PDF certificate support |
| Site visit distinct from training session | Discovery + reporting requirements | Implemented | training activity model separates training concerns from generic visits | Preserve distinction in reporting/mobile |
| Technician/attendee richness beyond simple counts | Training discovery | Partial | current model supports summary execution and counts but not rich participant rosters | Add session attendee model before full mobile rollout |
| Reporting, overdue tracking, exception views | Training PRD + reporting master | Partial | base history and account views exist | Build D0 reporting slice next if we stay provider-free |
| Certification expiry / recertification / printable certs | Training ops needs | Partial | certification records exist; expiry/renewal documents do not | Add certification operations slice |
| Outlook calendar sync and provider-connected scheduling | Training PRD + later prerequisites | Blocked | provider boundary intentionally parked | Start once Microsoft/Outlook prerequisites arrive |
| External training-site coexistence/import strategy | Current DynamicAQS training site reality | Partial | explicitly documented as coexistence boundary; no sync yet | Formalize import/coexistence policy before integration |

Current hardening priorities:
1. Reporting + certification operations slice
2. Rich attendee/technician participant model
3. Provider-connected scheduling once prerequisites arrive

