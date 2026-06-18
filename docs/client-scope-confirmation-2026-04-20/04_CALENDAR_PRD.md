# Calendar Module PRD

## Document Control

| Field | Value |
|---|---|
| Module | Calendar |
| Document Type | Master PRD |
| Version | 2.2 |
| Status | Draft — scope-accuracy correction (2026-06-18): the "~16 hours/user/year" double-entry figure relabelled as vendor-estimated (the qualitative double-entry pain stays client-confirmed). Builds on v2.1's enrichment pass |
| Owner | Product / Operations |
| Sprint Sequence | Seq 02–03 (centralized calendar + Outlook reflection) |
| Priority | P1 |
| Meeting Traceability | Discovery Session 1 (Feb 16 2026), Discovery Session 4 (Feb 24 2026), Session 9 (Mar 13 2026), Session 10 (Mar 17 2026), April 13–20 scope review, Dan Introductory Meeting (Nov 11 2025) |
| Primary Companion Docs | `CALENDAR_REQUIREMENTS_DISCOVERY_2026-04-15.md`, Leads PRD, Training PRD, Territory PRD |
| Date | 2026-04-20 (enriched 2026-06-09) |

---

## Scope corrections (2026-06-18)

The following LOW-severity scope-accuracy correction was applied after the program-wide re-check of client-attributed figures against the cited meeting transcripts. No rows were deleted; substance is unchanged.

- **"~16 hours per user annually" double-entry figure is vendor-estimated.** The annual hours-lost figure originated with the vendor (Ahmad) and was questioned by Curry — Session 5: *"that's … hard to quantify."* It should be read as a **vendor estimate**, not a client-confirmed metric. The underlying qualitative pain — double entry between CRM and Outlook, and history gaps when the second entry is skipped — **is** client-confirmed and stands. The figure appears in the Executive Summary (§2) and the Problem Statement table (§3.1); treat it as vendor-estimated in both places.

Full audit: `docs/SCOPE_ACCURACY_AUDIT_2026-06-18.md`.

---

## 1. Source Inventory

| Source ID | Absolute Path | What It Sourced |
|---|---|---|
| SRC-CAL-001 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session 1 - 16th Feb 2026.md` | Core calendar need: no unified calendar, trainer schedule blind spots, double-entry pain between CRM and Outlook, Curry's requirement that scheduling originates from the CRM and reflects to Outlook, weekly-view emphasis, Teams invite requirement. |
| SRC-CAL-002 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md` | Confirmed double-entry pain (16-hour annual loss per user), centralized training calendar request, bidirectional Outlook sync aspiration, recurring task / frequency scheduling prototype reference, weekly-view preference from field users. |
| SRC-CAL-003 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/13th March Discovery Session 9.md` | Prototype demo feedback: centralized calendar with discovery/training/visit/audit filters shown; Curry requests week view specifically; Teams invite requirement confirmed; bidirectional Outlook sync discussed; Curry's statement about blocking time consistently in Outlook. |
| SRC-CAL-004 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/17th March  session 10-To-Be consognment and App.md` | Calendar + visits section of target state; consignment audit events as a calendar family; Outlook sync for mobile app. |
| SRC-CAL-005 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md` | April scope review: calendar synced to Outlook 365, training not synced today (duplication), bidirectional sync confirmation, mobile app calendar/week view and timeline view, TM living in the app. |
| SRC-CAL-006 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Dan Meeting - Introductory Discovery Meeting – CRM Development - Clustox __ dynamic  Date_ 11_11_2025, 20_00.md` | Introductory: no Outlook integration; scheduling/visibility gap; need for unified calendar in CRM. |
| SRC-CAL-007 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/CALENDAR_REQUIREMENTS_DISCOVERY_2026-04-15.md` | BA discovery synthesis: five confirmed event families (`discovery_call`, `virtual_training`, `account_training`, `on_site_visit`, `consignment_audit`); calendar as read model over source workflows; Slice A provider-free; Outlook/Graph in later slice; month/week/list required views; production decisions locked. |
| SRC-CAL-008 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/calendar/service.ts` | Build evidence: `getCalendarWorkspace` — real backend, event filtering for actor, Outlook binding enrichment, workspace summary with per-type counts. |
| SRC-CAL-009 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/calendar/events.ts` | Build evidence: `listCalendarEvents` pulls from leads, training, and consignment in parallel; `listLeadCalendarEvents`, `listTrainingCalendarEvents`, `listConsignmentCalendarEvents`; Outlook sync-resolution helpers; MAX_CALENDAR_RANGE_DAYS = 180. |
| SRC-CAL-010 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/calendar/outlook.ts` | Build evidence: full Outlook OAuth flow (PKCE state, token exchange, refresh, CalendarConnection upsert); `syncCalendarEventToOutlook`, `tryAutoSyncCalendarEventToOutlook`, `tryAutoUnsyncCalendarEventFromOutlook`; meeting-provider (Teams) payload construction; event create/patch/delete against Microsoft Graph; `CalendarEventBinding` persistence; audit log entries. |
| SRC-CAL-011 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/calendar/policy.ts` | Build evidence: `getOutlookCalendarAdminSettings`, `updateOutlookCalendarAdminSettings`; feature-flag-backed policy (`calendar.outlook.sync`); pilot-user email list; `autoSyncDiscoveryEnabled`, `autoSyncTrainingEnabled`; `sharedCalendarsEnabled`; `defaultMeetingProvider`. |
| SRC-CAL-012 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/calendar/http.ts` | Build evidence: HTTP route handlers for `/api/v1/calendar/workspace`, Outlook OAuth flow routes, connection management routes, event sync route. |
| SRC-CAL-013 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/calendar/CalendarWorkspace.tsx` | Build evidence: full day/week/month/list grid; event-type color/icon metadata; owner, territory, account filters; `CalendarSchedulerModal` integration; Outlook sync UI; attention panel; time-grid with overlap lane calculation; 8am–10pm grid window. |
| SRC-CAL-014 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/calendar/CalendarSchedulerModal.tsx` | Build evidence: scheduler modal with discovery and training modes; lead + training account + training type + trainer selects; `canScheduleDiscovery`/`canScheduleTraining` access gates. |

---

## 2. Executive Summary

The Calendar module gives Dynamic AQS one centralized operational calendar inside Pulse across the event families that matter to revenue operations and field execution. Today there is no unified calendar: trainer schedules are invisible to leadership, TMs lose an estimated 16 hours per user annually to double-entry between CRM and Outlook (vendor-estimated — see Scope corrections 2026-06-18; the double-entry pain itself is client-confirmed), and scheduling blocks are siloed per individual's Outlook calendar rather than owned by a shared operational source.

Pulse will provide day, week, month, and list visibility; surface discovery calls, training sessions, site visits, and consignment audit events in one place; and connect scheduling back to the owning workflow. Outlook will be a connected reflection layer for approved users and approved event families. Pulse will remain the source of operational truth for scheduling.

The first production slice delivers the real backend-wired calendar read model over live CRM workflows, all four grid views, per-user Outlook OAuth connection, event reflection, Teams meeting link support, and admin-governed policy rollout. Bidirectional Outlook pull-to-Pulse sync is a later-phase item.

---

## 3. Overview

### 3.1 Problem Statement

| Current State | Impact |
|---|---|
| No unified calendar in Pulse CRM | Leadership has blind spots on trainer and TM schedules |
| Double entry: schedule in Outlook, then re-enter in CRM | ~16 hours per user per year lost to manual fatigue (vendor-estimated — see Scope corrections 2026-06-18); history gaps when second entry is skipped (client-confirmed pain) |
| Scheduling is per-individual Outlook calendar, not a shared operational surface | No cross-TM visibility; conflicts not visible when scheduling |
| Training/discovery/visit/audit events live in different modules with no single view | Operational workload planning requires jumping between screens |

### 3.2 In-Scope

- Centralized Pulse calendar module (route `/calendar`)
- Day, week, month, and list views (all four are first-class; week view emphasized by field users)
- Unified event visibility: `discovery_call`, `virtual_training`, `account_training`, `on_site_visit`, `consignment_audit`
- Filters by event family, owner, account/lead, territory
- Event drill-through to the owning source workflow
- Per-user Outlook OAuth connection (Microsoft 365 / Microsoft Entra)
- Pulse-to-Outlook event reflection for approved event families
- Calendar event update/removal propagated to Outlook when Pulse changes the source event
- Teams meeting link generation for eligible virtual event types
- Admin-governed policy rollout: enable/disable, pilot email list, shared calendar setting, meeting provider default, auto-sync per family
- Role-aware calendar visibility (events filtered by actor's module access and record scope)
- Direct scheduling of discovery and training from the centralized calendar modal
- Calendar scheduler modal: discovery mode (lead + date/time) and training mode (account + type + trainer + duration + date/time)

### 3.3 Out-of-Scope (Phase 1)

- Full bidirectional Outlook-to-Pulse pull reconciliation (Pulse reads Outlook, ingests external events)
- Provider support beyond Microsoft Outlook / Microsoft 365
- Generic scheduling workspace not tied to governed CRM workflows
- Consignment audit Outlook sync (read-only in calendar; sync for leads + training only)
- Advanced scheduling optimization or conflict intelligence
- Mobile-native calendar app (mobile sees events via the same API; dedicated mobile calendar UX is a later slice)

### 3.4 Parked Dependencies

| Dependency | Why Parked |
|---|---|
| Microsoft Graph mailbox credentials (`MICROSOFT_ENTRA_TENANT_ID`, `MICROSOFT_ENTRA_CLIENT_ID`, `MICROSOFT_ENTRA_CLIENT_SECRET`, `MICROSOFT_GRAPH_REDIRECT_URI`, `APP_ENCRYPTION_KEY`) | Environment variables not yet provisioned for production; Outlook sync code is fully wired but will return `isConfigured = false` until credentials are set |
| Bidirectional Outlook sync | Requires Microsoft Graph subscription/webhook model; deferred to later phase |
| Google / Apple calendar | Not in scope for Phase 1 |
| Recurring schedule creation and management | UI toggle is parked (`Done (parked)` per UX audit); single-occurrence fallback with recurrence intent in note is the current behavior |

---

## 4. Functional Requirements

### 4.1 Centralized Calendar Visibility

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-CAL-001 | Pulse provides a centralized calendar module at route `/calendar` accessible from the main navigation | The route loads a real backend-wired calendar workspace; no mock events; empty state shown when no events exist in range | P0 | SRC-CAL-001, SRC-CAL-007 | Built — `CalendarWorkspace.tsx` + `/api/v1/calendar/workspace`; empty state gap noted in UX-C-001 |
| FR-CAL-002 | The calendar supports day, week, month, and list views as first-class planning surfaces | All four views render real event data; each view handles its own time range and navigation correctly; week view is the default recommendation for field users | P0 | SRC-CAL-001, SRC-CAL-003, SRC-CAL-007 | Built — time grid for day/week (8am–10pm grid with overlap lane calculation); month cell grid; list table; all four exposed in view selector |
| FR-CAL-003 | Users can filter calendar events by event family (discovery, training, visits, audits, all) | Selecting a filter hides non-matching events without a page reload; counts in the attention panel update accordingly | P0 | SRC-CAL-003, SRC-CAL-007 | Built — `CalendarFilterMode` with `filterEventItem` logic; filter selector in workspace |
| FR-CAL-004 | Users can filter calendar events by owner (assigned TM / trainer), account/lead, and territory | Each filter is independently clearable; combined filters use AND logic; filter options are derived from the loaded event set | P1 | SRC-CAL-002, SRC-CAL-003 | Built — `ownerFilter`, `territoryFilter`, `accountFilter` selects; dynamically built from workspace items (UX-C-005, UX-C-006 marked Done) |
| FR-CAL-005 | Clicking a calendar event opens the owning source record (lead, account, consignment site) without requiring navigation away from the calendar | The event detail rail shows event metadata and a "Open linked record" button that navigates to `sourcePath` | P0 | SRC-CAL-001, SRC-CAL-007 | Partial — detail rail and `Open linked record` button are built; drill-through navigation unverified end-to-end (UX-C-004 Open) |
| FR-CAL-006 | The calendar surfaces five event families: discovery calls, virtual training, account training, on-site visits, and consignment audits | Events from each family display with a distinct color and icon; the event type label is visible in the event card and detail rail | P0 | SRC-CAL-007, SRC-CAL-003 | Built — `EVENT_TYPE_META` maps all five types with color, label, icon; `CalendarEventTypeKey` contract covers all five |
| FR-CAL-007 | The attention panel shows today's scheduled events count, upcoming events in 14 days, and (when Outlook is connected) unsynced events awaiting reflection | Counts update on workspace load; panel items link to the relevant filtered view | P1 | SRC-CAL-007 | Built — `calendarAttentionItems` array in `CalendarWorkspace.tsx`; Outlook sync review item conditional on `isConnected` |
| FR-CAL-008 | Day view shows a time grid from 08:00 to 22:00 with hourly rows; overlapping events are placed in adjacent lanes without overlapping text | Events positioned absolutely at correct top offset and height; lane count auto-calculated by overlap algorithm | P0 | SRC-CAL-002, SRC-CAL-003 | Built — `buildTimeGridPlacements` algorithm; `TIME_GRID_START_HOUR=8`, `TIME_GRID_END_HOUR=22`, `TIME_GRID_ROW_HEIGHT=72px` |
| FR-CAL-009 | Week view shows a 7-column time grid (same 08:00–22:00 range) where each column is one day with the same overlap-lane algorithm as day view | All 7 days visible simultaneously; Today column highlighted; clicking an open slot opens the scheduler modal with that day and time pre-filled | P0 | SRC-CAL-003 ("I spend more time with my weekly view") | Built — `view === 'week'` branch with `timeGridDays` 7-day expansion; today-highlighted column; open-slot click handler |
| FR-CAL-010 | Month view shows a full calendar grid (Sun–Sat); each day cell shows up to 3 events with a "+N more" overflow indicator; clicking a day cell opens the scheduler | Month cells render with `isCurrentMonth` opacity distinction; day cells are keyboard-accessible | P1 | SRC-CAL-001, SRC-CAL-007 | Built — `buildMonthCells` grid; `itemsByDay` bucketing; overflow count; click-to-schedule |
| FR-CAL-011 | List view shows a sortable table of events with columns: When, Type (badge), Title, Owner, Linked record, Status | Table renders from the same `filteredItems` array; empty state shown when no events match | P1 | SRC-CAL-007 | Built — `view === 'list'` branch with `WorkbenchTable` |
| FR-CAL-012 | The calendar workspace API enforces a maximum range of 180 days per request | Requests beyond 180 days return a 400 error with a clear message | P1 | SRC-CAL-009 | Built — `MAX_CALENDAR_RANGE_DAYS = 180` in `events.ts` |

### 4.2 Source-Workflow Event Feed

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-CAL-013 | Discovery call events are sourced from the Leads module using `Lead.discoveryScheduledAt` or `Lead.discoveryCompletedAt`; status is `scheduled` or `completed` accordingly | Lead events appear in calendar for the date range; closed leads are excluded | P0 | SRC-CAL-007, SRC-CAL-009 | Built — `listLeadCalendarEvents` with `lifecycleStatus: { not: 'CLOSED' }` filter; `mapLeadToCalendarEvent` |
| FR-CAL-014 | Training session events are sourced from the Training module; delivery mode classifies event type as `virtual_training`, `account_training`, or `on_site_visit`; `durationMinutes` drives the end time | Training events show trainer name and account name; `endsAt` is calculated from `durationMinutes` | P0 | SRC-CAL-007, SRC-CAL-009 | Built — `listTrainingCalendarEvents`; `classifyTrainingEventType` maps `SITE_VISIT` → on_site_visit, `VIRTUAL/PHONE/HYBRID` → virtual_training, else → account_training |
| FR-CAL-015 | Consignment audit events are sourced from `ConsignmentSite.nextAuditDueAt` and from durable `ConsignmentAudit` records with `scheduledFor` or `completedAt` in range; exited sites are excluded | Audit events link to `/consignment/sites/:id`; TM and account name visible | P0 | SRC-CAL-004, SRC-CAL-007, SRC-CAL-009 | Built — `listConsignmentCalendarEvents`; `buildConsignmentSiteRecordScope` for TM/RD scoping; site and audit mappers |
| FR-CAL-016 | Lead-backed consignment audit hint events appear in calendar for leads where `consignmentInterestStatus = APPROVED` and `consignmentEntryTiming = AT_ONBOARDING` that have not yet converted to a durable consignment site | Hint events show 90 days after `firstOrderAt` or `onboardingCompletedAt`; they include a note that they are hints requiring a durable site creation | P2 | SRC-CAL-009 | Built — `mapLeadToConsignmentAuditCalendarEvent` in `events.ts` |
| FR-CAL-017 | Events from all three source modules are merged and sorted chronologically before returning from the API | The workspace response `items` array is sorted by `startsAt` ascending then title alphabetically | P0 | SRC-CAL-009 | Built — `listCalendarEvents` returns `[...leadEvents, ...trainingEvents, ...consignmentEvents].sort(...)` |
| FR-CAL-018 | The calendar read model respects record-scope permissions from source modules; a TM sees only their assigned leads, training sessions, and consignment sites | Server-side scope filters applied; URL/query manipulation cannot bypass the scope | P0 | SRC-CAL-001, SRC-CAL-007 | Built — `resolveLeadRecordScope`, `buildTrainingSessionRecordScope`, `buildConsignmentSiteRecordScope` applied before queries; `filterCalendarEventsForActor` as second-pass client filter |

### 4.3 Scheduling From Calendar

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-CAL-019 | A user with `lead.intake_manage` permission can schedule a discovery call from the centralized calendar; the call is saved as a lead discovery record, not a standalone calendar entry | The scheduler modal opens pre-filled with the clicked date/time; on save, the lead's `discoveryScheduledAt` is set; the calendar reloads and shows the new event | P0 | SRC-CAL-001, SRC-CAL-002 | Built — `CalendarSchedulerModal` with `mode = 'discovery'`; calls `scheduleLeadDiscovery`; `canScheduleDiscovery` gate |
| FR-CAL-020 | A user with `training.schedule` permission can schedule a training session from the centralized calendar; the session is saved as a training record linked to an account | The modal offers account, training type, trainer, duration, and date/time inputs; on save, a `TrainingSession` is created; the calendar reloads | P0 | SRC-CAL-001, SRC-CAL-002 | Built — `CalendarSchedulerModal` with `mode = 'training'`; calls `createTrainingSessionRecord`; `canScheduleTraining` gate |
| FR-CAL-021 | The scheduler modal informs the user that scheduling creates a record in the source workflow, not a standalone calendar event | An informational banner in the modal explains the Pulse source-of-truth model | P1 | SRC-CAL-007 | Not-built — UX-C-002 ("Scheduler modal missing info banner") Open |
| FR-CAL-022 | Clicking an open time slot in the day or week grid opens the scheduler modal pre-filled with that date and time | `openSchedulerForDate(slotDate)` is called with the slot's date and hour | P1 | SRC-CAL-013 | Built — `data-testid="calendar-open-slot"` slots trigger `openSchedulerForDate` |

### 4.4 Outlook Integration

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-CAL-023 | A user can connect their Microsoft 365 Outlook account to Pulse using OAuth (PKCE state, authorization code flow) | The connection flow stores encrypted access/refresh tokens; `CalendarConnection` is upserted; audit log entry created; user redirected back to `/calendar` with status param | P0 | SRC-CAL-001, SRC-CAL-003, SRC-CAL-010 | Built — `startOutlookConnection`, `completeOutlookConnection` in `outlook.ts`; `CalendarConnectionAuthState` model; PKCE state hash; token encryption |
| FR-CAL-024 | When an Outlook connection exists and is active, scheduling a discovery call or training session can automatically reflect the event to the user's Outlook calendar | `tryAutoSyncCalendarEventToOutlook` is called after save if `autoSyncDiscoveryEnabled`/`autoSyncTrainingEnabled` is on in policy; Outlook event is created via Microsoft Graph | P0 | SRC-CAL-001, SRC-CAL-003 | Built (parked behind credentials) — `tryAutoSyncCalendarEventToOutlook` wired; Microsoft Graph create/patch calls implemented; PENDING credential provisioning |
| FR-CAL-025 | A connected user can manually push any scheduled discovery or training event to Outlook from the event detail rail; the action updates the binding if the event was previously synced | "Sync to Outlook" / "Update in Outlook" button in detail rail; `syncCalendarOutlookEvent` API call; success message shown; last synced timestamp updated | P0 | SRC-CAL-003, SRC-CAL-010 | Built (parked behind credentials) — `handleSyncSelectedEvent` in `CalendarWorkspace.tsx`; `syncCalendarEventToOutlook` in `outlook.ts` |
| FR-CAL-026 | When a Pulse discovery or training event is rescheduled or cancelled, the Outlook reflection is updated or removed accordingly | `tryAutoUnsyncCalendarEventFromOutlook` called on cancellation; `syncCalendarEventToOutlook` (PATCH) called on reschedule | P0 | SRC-CAL-007, SRC-CAL-010 | Built (parked behind credentials) — `removeCalendarEventFromOutlook`, `patchOutlookEvent` implemented |
| FR-CAL-027 | When the event type supports online meetings (discovery calls, virtual training) and the user's connection uses Teams as the meeting provider, the Outlook event is created with `isOnlineMeeting: true` and `onlineMeetingProvider: 'teamsForBusiness'`; the resulting join URL is stored and surfaced in the event detail rail | Teams meeting join URL visible in detail rail with "Open meeting link" button | P0 | SRC-CAL-003 ("include the teams invite"), SRC-CAL-010 | Built (parked behind credentials) — `supportsOnlineMeeting` check; `buildOutlookEventPayload` Teams field; `externalMeetingJoinUrl` stored in `CalendarEventBinding` |
| FR-CAL-028 | Outlook sync is scoped to leads and training source modules only; consignment audit events are visible in Pulse calendar but are not offered for Outlook sync in Phase 1 | Sync button not shown for consignment events; API enforces event type restriction | P1 | SRC-CAL-010 | Built — `selectedEvent.sourceModule !== 'leads' && selectedEvent.sourceModule !== 'training'` returns error message |
| FR-CAL-029 | A user can disconnect their Outlook connection; disconnection deletes all stored `CalendarEventBinding` records for that connection and the `CalendarConnection` record | Audit log entry created; workspace shows `isConnected = false` after disconnection | P1 | SRC-CAL-010 | Built — `disconnectOutlookConnection` with `deleteMany` on bindings then `delete` on connection |
| FR-CAL-030 | The calendar workspace response includes Outlook connection state (`isConnected`, `isConfigured`, `connectionEmail`, `targetCalendarName`, `meetingProvider`, `policy`) in the `outlookConnection` field | Front end uses this to conditionally render connection prompts, sync buttons, and admin links | P0 | SRC-CAL-010 | Built — `buildConnectionSummary` populates full typed `CalendarOutlookConnectionSummary` |
| FR-CAL-031 | When a connected user has their calendar set to a specific Outlook calendar (not default), events are synced to that calendar; if the target calendar or meeting provider changes, the existing Outlook event is deleted and recreated in the new target | `shouldRecreate` flag detects target/provider change; old event deleted, new event created | P1 | SRC-CAL-010 | Built — `shouldRecreate` logic in `syncCalendarEventToOutlook` |
| FR-CAL-032 | If auto-sync fails (transient Outlook API error), the failure is audit-logged and the sync error is stored on the `CalendarEventBinding` record; the TM is not shown an error interrupting their workflow | `lastSyncError` persisted; UI shows last sync error in detail rail when present | P1 | SRC-CAL-010 | Built — try/catch with `buildAuditEntryData` in `tryAutoSyncCalendarEventToOutlook`; `lastSyncError` on connection and binding models |

### 4.5 Admin Governance

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-CAL-033 | An admin can enable or disable Outlook calendar sync globally via a feature flag (`calendar.outlook.sync`) | When disabled, all users see `isConfigured = false`; when enabled, user connections are allowed | P0 | SRC-CAL-007, SRC-CAL-011 | Built — `OUTLOOK_POLICY_FLAG_KEY` feature flag; `updateOutlookCalendarAdminSettings` |
| FR-CAL-034 | An admin can restrict Outlook sync to a pilot user list by email; non-listed users see an availability message and cannot connect | `pilotUserEmails` list in policy; `isUserEligibleForOutlook` check; `availabilityMessage` returned to non-pilot users | P0 | SRC-CAL-007, SRC-CAL-011 | Built — pilot email list normalized and checked in `policy.ts` |
| FR-CAL-035 | An admin can enable shared calendar support; when disabled (default), Pulse only shows the user's own Outlook calendars for target selection | `sharedCalendarsEnabled` policy flag; `filterCalendarsByPolicy` filters shared calendars when disabled | P1 | SRC-CAL-011 | Built — `sharedCalendarsEnabled` default `false`; filter applied in `listOutlookCalendars` and `updateOutlookConnection` |
| FR-CAL-036 | An admin can set the default meeting provider (`none` or `teams`); individual users inherit the default but can override it per connection | `defaultMeetingProvider` stored in policy; per-connection `meetingProviderPreference` overrides the policy default | P1 | SRC-CAL-003, SRC-CAL-011 | Built — `defaultMeetingProvider` in policy; `toMeetingProviderPreference` conversion; per-connection update |
| FR-CAL-037 | An admin can enable or disable auto-sync independently for discovery events and training events | `autoSyncDiscoveryEnabled` and `autoSyncTrainingEnabled` flags in policy; `shouldAutoSyncOutlookEvent` checks per source module | P1 | SRC-CAL-011 | Built — both flags in policy; `shouldAttemptAutoSync` routes by `sourceModule` |
| FR-CAL-038 | The calendar integration admin page shows the Outlook integration health status (connected / warning / error) with a detail message | `listOutlookIntegrationStatuses` returns status, health score, and detail | P1 | SRC-CAL-011 | Built — `listOutlookIntegrationStatuses` in `policy.ts` |
| FR-CAL-039 | A user with `admin.integration_view` permission sees an "Outlook settings" button in the calendar workspace header linking to `/admin/integrations?provider=calendar` | Button conditionally rendered based on `canViewCalendarIntegrations` | P2 | SRC-CAL-013 | Built — `canViewCalendarIntegrations` gate; `Link` to admin integrations |

---

## 5. Non-Functional Requirements

| ID | Requirement | Target | SRC |
|---|---|---|---|
| NFR-CAL-001 | **Performance — workspace API response time** | Calendar workspace endpoint (`GET /api/v1/calendar/workspace`) must respond within 2 seconds for a 30-day range on a standard environment; three source-module queries run in parallel via `Promise.all` | SRC-CAL-009; (inferred standard) |
| NFR-CAL-002 | **Performance — front-end calendar render** | Initial calendar paint (list or month view for 30 days) must complete within 3 seconds on a standard broadband connection; time-grid views must render without layout shift after data loads | (inferred standard) |
| NFR-CAL-003 | **Security / AuthZ — server-side record scope** | Calendar event visibility must be enforced server-side; TMs see only their assigned leads, training sessions, and consignment sites; bypass via URL manipulation or API call with modified range must be blocked | SRC-CAL-007, SRC-CAL-008, SRC-CAL-009 |
| NFR-CAL-004 | **Security — Outlook token storage** | Access and refresh tokens for Outlook connections must be stored encrypted at rest using `APP_ENCRYPTION_KEY`; tokens must never appear in API responses or logs | SRC-CAL-010 |
| NFR-CAL-005 | **Security — PKCE OAuth state** | The Outlook OAuth authorization state must be a cryptographically random 32-byte base64url value; the state hash is stored server-side with a 10-minute expiry and single-use constraint | SRC-CAL-010 |
| NFR-CAL-006 | **Scalability — calendar range limit** | The API must reject calendar requests exceeding 180 days to prevent unbounded query expansion across three source modules | SRC-CAL-009 |
| NFR-CAL-007 | **Availability — graceful Outlook degradation** | If Outlook credentials are not configured or the Microsoft Graph API is unreachable, the calendar workspace must still load successfully showing Pulse events only; Outlook-specific UI is hidden or shows an informational message | SRC-CAL-010, SRC-CAL-011 |
| NFR-CAL-008 | **Auditability — Outlook sync operations** | Every Outlook sync operation (connect, disconnect, create, patch, delete, auto-sync failure) must produce an `AuditEntry` record with actor, action, entity type, source system, and metadata | SRC-CAL-010 |
| NFR-CAL-009 | **Accessibility — keyboard navigation** | All calendar open slots (day/week time grid) and month cells must be keyboard-focusable with `tabIndex=0`; Enter and Space keys must activate the slot as equivalent to a click | SRC-CAL-013 |
| NFR-CAL-010 | **Observability — Outlook policy health** | The admin integration status endpoint must return a numeric health score and a descriptive status message so that operations teams can monitor Outlook rollout state without querying the database directly | SRC-CAL-011 |

---

## 6. Assumptions

| ID | Assumption | Why It Matters |
|---|---|---|
| ASM-CAL-001 | Microsoft Outlook / Microsoft 365 is the first and primary external calendar provider for Dynamic AQS. No other provider (Google, Apple) is in scope for Phase 1. | Affects provider build scope and integration design. |
| ASM-CAL-002 | Pulse is the scheduling source of truth; Outlook behaves primarily as a reflection and notification layer. Edits made directly in Outlook are not pulled back to Pulse in Phase 1. | If users edit Outlook events and expect Pulse to reflect the change, a separate bidirectional sync slice will be required. |
| ASM-CAL-003 | Day, week, month, and list views are all required for the production launch. Week view is particularly emphasized by field users (TMs). | Dropping a view would break the confirmed requirement from Session 9. |
| ASM-CAL-004 | Leadership and operations need visibility across multiple event families (discovery, training, visits, audits) in one calendar, not just training events. | Affects the breadth of the event feed. |
| ASM-CAL-005 | Admin-governed pilot rollout is the correct way to introduce Outlook-connected behavior before broad enablement. | Avoids uncontrolled Microsoft Graph credential exposure and supports Curry's requirement that scheduling be consistent across the team. |
| ASM-CAL-006 | Microsoft Entra (Azure AD) OAuth 2.0 authorization code flow with offline_access scope is the mechanism for Outlook token issuance and refresh. | Token refresh logic depends on this being a long-lived offline access grant. |
| ASM-CAL-007 | Events without an `endsAt` value default to 30 minutes for discovery calls, 120 minutes for on-site visits, and 60 minutes for all other event types when building the Outlook event payload. | Default durations affect how events appear in Outlook; if Dynamic AQS has different standards, these constants must be updated. |
| ASM-CAL-008 | The time grid renders 08:00–22:00 local time. Events outside this window are excluded from the visual grid but appear in the list view. | If TMs regularly schedule before 8am or after 10pm, the grid window must be expanded. |

---

## 7. Open Questions

| ID | Question | Options / Impact | Decision Owner |
|---|---|---|---|
| OQ-CAL-01 | Which event families must be included in the first approved calendar scope? | discovery + training only / include visits / include audits / all five families | Dynamic AQS operations lead |
| OQ-CAL-02 | What is the final scheduling ownership model for the broader team? | Pulse-first (everyone schedules in Pulse, Outlook reflects) / mixed by event family / individual choice | Curry + Dynamic AQS IT |
| OQ-CAL-03 | What meeting provider behavior is expected for virtual events? | Teams by default / no generated links / user choice per event | Curry + IT stakeholder |
| OQ-CAL-04 | How much shared-calendar behavior is required in Phase 1? | Personal calendar only (current default) / selectable shared calendars / delegated write support | IT / Microsoft 365 admin |
| OQ-CAL-05 | Should users schedule directly from the centralized calendar for all event families, or primarily launch source workflows from the calendar? | Launch surface only (current approach) / mixed / full scheduling workspace with all event types | Dynamic AQS operations lead |
| OQ-CAL-06 | Who owns reminder behavior and how should it be delivered? | Outlook reminders only (current default via Outlook sync) / Pulse in-app reminders / both by role | Dynamic AQS operations lead |
| OQ-CAL-07 | Should completed visits, training, and audits remain prominently visible in calendar history views? | Yes across all / only by filter / only active items by default | Dynamic AQS operations lead |
| OQ-CAL-08 | Should recurring schedule patterns be part of the first approved calendar scope? | No recurring support / recurring visibility only (show repeat events without creation UI) / full recurring creation and management | Curry + Product |
| OQ-CAL-09 | Is the 08:00–22:00 time grid window correct for Dynamic AQS field schedules? | Adjust start/end hour as needed | Dynamic AQS operations lead |

---

## 8. FR / NFR to SRC Traceability Matrix

| Requirement ID | Title (short) | Sources | Build Status |
|---|---|---|---|
| FR-CAL-001 | Centralized calendar module | SRC-CAL-001, SRC-CAL-007 | Built |
| FR-CAL-002 | Four calendar views | SRC-CAL-001, SRC-CAL-003, SRC-CAL-007 | Built |
| FR-CAL-003 | Event family filter | SRC-CAL-003, SRC-CAL-007 | Built |
| FR-CAL-004 | Owner / territory / account filters | SRC-CAL-002, SRC-CAL-003 | Built |
| FR-CAL-005 | Event drill-through to source record | SRC-CAL-001, SRC-CAL-007 | Partial |
| FR-CAL-006 | Five event families with color/icon | SRC-CAL-007, SRC-CAL-003 | Built |
| FR-CAL-007 | Attention panel | SRC-CAL-007 | Built |
| FR-CAL-008 | Day view time grid | SRC-CAL-002, SRC-CAL-003 | Built |
| FR-CAL-009 | Week view time grid | SRC-CAL-003 | Built |
| FR-CAL-010 | Month view grid | SRC-CAL-001, SRC-CAL-007 | Built |
| FR-CAL-011 | List view table | SRC-CAL-007 | Built |
| FR-CAL-012 | 180-day range cap | SRC-CAL-009 | Built |
| FR-CAL-013 | Discovery events from Leads | SRC-CAL-007, SRC-CAL-009 | Built |
| FR-CAL-014 | Training events from Training | SRC-CAL-007, SRC-CAL-009 | Built |
| FR-CAL-015 | Consignment audit events | SRC-CAL-004, SRC-CAL-007, SRC-CAL-009 | Built |
| FR-CAL-016 | Lead-backed consignment audit hints | SRC-CAL-009 | Built |
| FR-CAL-017 | Chronological event merge | SRC-CAL-009 | Built |
| FR-CAL-018 | Record-scope enforcement | SRC-CAL-001, SRC-CAL-007 | Built |
| FR-CAL-019 | Schedule discovery from calendar | SRC-CAL-001, SRC-CAL-002 | Built |
| FR-CAL-020 | Schedule training from calendar | SRC-CAL-001, SRC-CAL-002 | Built |
| FR-CAL-021 | Scheduler modal source-of-truth banner | SRC-CAL-007 | Not-built (UX-C-002) |
| FR-CAL-022 | Open-slot click pre-fills scheduler | SRC-CAL-013 | Built |
| FR-CAL-023 | Outlook OAuth connection flow | SRC-CAL-001, SRC-CAL-003, SRC-CAL-010 | Built (parked: credentials) |
| FR-CAL-024 | Auto-sync on schedule | SRC-CAL-001, SRC-CAL-003 | Built (parked: credentials) |
| FR-CAL-025 | Manual sync from detail rail | SRC-CAL-003, SRC-CAL-010 | Built (parked: credentials) |
| FR-CAL-026 | Update/remove Outlook event on change | SRC-CAL-007, SRC-CAL-010 | Built (parked: credentials) |
| FR-CAL-027 | Teams meeting link generation | SRC-CAL-003, SRC-CAL-010 | Built (parked: credentials) |
| FR-CAL-028 | Outlook sync scope: leads + training only | SRC-CAL-010 | Built |
| FR-CAL-029 | Disconnect Outlook | SRC-CAL-010 | Built |
| FR-CAL-030 | Outlook connection state in workspace response | SRC-CAL-010 | Built |
| FR-CAL-031 | Target calendar / provider change triggers recreate | SRC-CAL-010 | Built |
| FR-CAL-032 | Auto-sync failure logging | SRC-CAL-010 | Built |
| FR-CAL-033 | Admin global enable/disable | SRC-CAL-007, SRC-CAL-011 | Built |
| FR-CAL-034 | Pilot user email list | SRC-CAL-007, SRC-CAL-011 | Built |
| FR-CAL-035 | Shared calendar admin toggle | SRC-CAL-011 | Built |
| FR-CAL-036 | Default meeting provider admin setting | SRC-CAL-003, SRC-CAL-011 | Built |
| FR-CAL-037 | Auto-sync per source module toggle | SRC-CAL-011 | Built |
| FR-CAL-038 | Admin integration health status | SRC-CAL-011 | Built |
| FR-CAL-039 | Admin settings link in calendar header | SRC-CAL-013 | Built |
| NFR-CAL-001 | Workspace API response time | SRC-CAL-009; inferred | (inferred) |
| NFR-CAL-002 | Front-end calendar render | inferred | (inferred) |
| NFR-CAL-003 | Server-side record scope | SRC-CAL-007, SRC-CAL-008, SRC-CAL-009 | Built |
| NFR-CAL-004 | Token encryption at rest | SRC-CAL-010 | Built |
| NFR-CAL-005 | PKCE OAuth state security | SRC-CAL-010 | Built |
| NFR-CAL-006 | Range limit 180 days | SRC-CAL-009 | Built |
| NFR-CAL-007 | Graceful Outlook degradation | SRC-CAL-010, SRC-CAL-011 | Built |
| NFR-CAL-008 | Outlook sync audit trail | SRC-CAL-010 | Built |
| NFR-CAL-009 | Keyboard navigation | SRC-CAL-013 | Built |
| NFR-CAL-010 | Outlook policy health observability | SRC-CAL-011 | Built |

---

## §UX-GAPS — Audit 2026-06-08

Gaps identified during a full platform UX/requirements audit. Organised by sprint priority.
All items with **Can do now = Yes** have no external dependency.

### Sprint 1 — Quick Wins (S effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-C-001 | No empty state when date range has no events | CalendarWorkspace.tsx | Yes | Open |
| UX-C-002 | Scheduler modal missing "this also creates a record in the source workflow" info banner | CalendarSchedulerModal.tsx | Yes | Open |
| UX-C-003 | No in-app reminder settings on scheduler modal | CalendarSchedulerModal.tsx | Yes | Open |
| UX-C-004 | Event click drill-through to owning record unverified | CalendarWorkspace.tsx | Yes | Open |

### Sprint 2 — Core Workflow (M effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-C-005 | No territory filter in calendar workspace | CalendarWorkspace.tsx | Yes | Done |
| UX-C-006 | No account/lead filter in calendar workspace | CalendarWorkspace.tsx | Yes | Done |
| UX-C-007 | Recurring schedule toggle absent in scheduler modal | CalendarSchedulerModal.tsx | Yes | Done (parked: true recurrence expansion pending BR-C-03 — UI toggle + single-occurrence fallback with recurrence intent in note) |

### Sprint 3 — New Surfaces (L effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-C-008 | Day/week/month grid views not implemented — list view only (BR-C-05 requires all four) | CalendarWorkspace.tsx | Yes | Done |
