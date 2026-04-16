# Calendar Requirements Map

Date: 2026-04-16

Primary source documents:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/CALENDAR_REQUIREMENTS_DISCOVERY_2026-04-15.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Dynamic AQS __ Clustox - Discovery Call - Dynamic Team Intro - Date_ 09_12_2025, 20_00.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/18 feb 2026 Discovery session 2.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/17th March  session 10-To-Be consognment and App.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Fri 27th  Feb Session 6.md`

## Newly surfaced or reinforced from meetings and shared artifacts

- Dynamic wants one centralized operating calendar inside Pulse.
- Users want to create in CRM, reflect to Outlook, and avoid double entry.
- Month view is not optional. Don explicitly asked for a month grid to find open dates several weeks out.
- The calendar is not just for training. It needs discovery, training, visits, and later audits.
- Field/mobile users expect their app calendar and Outlook to reflect each other once connected.
- Consignment/audit scheduling is another real future family; the warehouse tracker and consignment meetings reinforce this.

## Current coverage map

| Requirement | Meeting / artifact evidence beyond PRDs | Status | Current implementation evidence | Hardening / next action |
| --- | --- | --- | --- | --- |
| Centralized Pulse calendar module | Strongly validated across intro, discovery, and mobile sessions | Implemented | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/calendar/service.ts`, `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/app/calendar/page.tsx` | Keep Pulse as workflow truth |
| Month / week / list views | Meetings explicitly ask for month and week visibility | Implemented | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/calendar/CalendarWorkspace.tsx` | Add fuller keyboard/filter polish if needed |
| Clicking empty calendar cells opens scheduler | User asked for prototype parity; meetings support schedule-from-calendar behavior | Implemented | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/calendar/CalendarSchedulerModal.tsx` | Keep scheduler tied to owning workflows |
| Schedule discovery from centralized calendar | Session 2 asks for centralized visibility and scheduling | Implemented | discovery scheduling in leads service plus centralized scheduler | Preserve lead-owned truth and regression coverage |
| Schedule training from centralized calendar | Session 4 strongly validates this | Implemented | centralized scheduler plus training scheduling flow | Keep training-owned truth and improve permission UX |
| Role-aware scheduler behavior | Recent runtime issue showed calendar users may not have training access | Partial | calendar scheduler now checks role actions before loading discovery/training sources | Add browser regressions around mixed-access roles |
| Outlook mailbox connect/disconnect | User completed live Entra/Outlook setup path and calendar provider flow exists | Implemented (Alpha) | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/calendar/outlook.ts`, `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/calendar.outlook.regression.test.mjs` | Finish pilot validation and improve error/status UX |
| CRM-first scheduling reflected to Outlook | Session 4 explicitly asks for this | Partial | auto-sync foundation exists for discovery and training | Complete real pilot validation and event-family expansion |
| Shared calendar support | Needed for some operational models; not yet fully validated | Partial | policy and selection support exist in code | Validate against tenant permissions and finish UX |
| Admin/settings control for calendar integration rollout | User explicitly asked for admin/settings integration controls | Partial | admin integration panel and policy routes are in current implementation working tree | Finish regression closure and commit this slice cleanly |
| Pilot-user restriction and rollout policy | Needed for safe Outlook rollout | Partial | current policy model supports pilot emails and toggles | Finish admin UX, tests, and rollout docs |
| Teams meeting-preference handling | Meetings mention Teams; current code has meeting provider preference | Partial | Outlook connection setting supports default meeting provider and Teams capability checks | Lock approved provider policy and complete pilot validation |
| WebEx coexistence | Meetings still mention WebEx for some training workflows | Decision | not implemented | Decide whether WebEx remains external, is reflected, or is replaced |
| Discovery, training, visits, and audits in one place | Meetings reinforce all of these as desired calendar families | Partial | discovery and training are live; visits/audits are not fully integrated | Add visits/audits once field and consignment slices are ready |
| Consignment audit reminders and overdue visibility | Consignment sessions and warehouse tracker make this explicit | Missing in calendar module | no live consignment audit feed into calendar yet | Add audit event family and alerting after field/consignment hardening |
| Calendar-as-read-model over governed workflows | Meetings support centralized visibility, but not a detached generic scheduling engine | Implemented | current calendar launches lead and training workflows rather than inventing new objects | Keep this architecture stable |

## Meeting-to-implementation gaps that were easy to miss from PRDs alone

- Month view and easy forward-looking scheduling were explicitly requested and should stay first-class.
- Admin and BD leadership want to inspect training schedules without chasing individual TMs.
- Calendar is also a field/mobile concern, not only a desktop admin concern.
- Discovery and training are already central, but visits and audits are part of the same operating story.

## Hardening priority to approach 90%

1. Finish admin/settings integration controls and regression closure.
2. Finish Outlook pilot validation and improve connection status UX.
3. Add visits/audits as real source families, not placeholders.
4. Add browser regressions for scheduler permissions and mixed-access roles.
5. Lock Teams/WebEx policy and shared-calendar rules.
6. Then add richer calendar drill-through and exception highlighting.
