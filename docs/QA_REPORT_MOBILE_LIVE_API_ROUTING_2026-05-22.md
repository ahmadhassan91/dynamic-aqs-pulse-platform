# Mobile QA Draft: Live API Routing Cycle

Date: 2026-05-22  
Owner: Agent C mobile QA/report worker  
Status: Draft for next execution cycle after live API routing fix

## Scope

This QA cycle should validate the Pulse Field mobile app against the live Pulse API route surface after the routing/config fix for mobile-origin API calls.

Primary focus:

- iOS simulator smoke on Expo SDK 54.
- Mobile web/export smoke where useful for fast route checks.
- Live API routing from the mobile client to `https://pulse-crm.theclustox.com`.
- Training proof upload and consignment ROSE evidence upload routes.
- Offline draft behavior when live API calls fail or return validation/conflict responses.

## Routing Fix Context

Inspection of the current working tree shows the next QA cycle should specifically cover:

- API CORS now allows Expo/mobile dev origins on `localhost:8081` and `127.0.0.1:8081`.
- Consignment route handling now receives server config, so `POST /api/v1/consignment/audits/:auditId/evidence` can reach the storage-backed service path.
- Training proof upload and consignment evidence upload both use explicit 8 MB JSON body limits while mobile caps individual images at 4 MB.
- Mobile API host entry remains restricted to approved Pulse hosts, with localhost allowed for QA.

## Test Matrix

| Area | Screen / flow | Live API endpoints | Expected result | Status |
| --- | --- | --- | --- | --- |
| Auth | Login, session restore, API base URL switch | `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me` | Production and Local QA controls route cleanly; invalid hosts are rejected only on sign-in/save; stored session keeps the selected API base | Ready to run |
| Home | Field Home dashboard | `GET /api/v1/leads/workflow-queue`, `GET /api/v1/accounts`, `GET /api/v1/consignment/sites`, `GET /api/v1/consignment/ops` | Partial endpoint failure does not blank the whole workspace; live counts render by section | Ready to run |
| Leads | Lead inbox/detail | `GET /api/v1/leads`, `GET /api/v1/leads/:leadId` | Search and detail load with bearer auth; error copy is user-safe | Ready to run |
| OCR | Business-card preview | `POST /api/v1/leads/ocr/preview` | Image/text preview runs review-first and does not create a lead | Ready to run |
| Accounts | Account list/detail with training context | `GET /api/v1/accounts`, `GET /api/v1/accounts/:accountId`, `GET /api/v1/training/accounts/:accountId` | Account context and recent training/site-visit history render without route drift | Ready to run |
| Route Plan | Start/complete site visit | `POST /api/v1/training/accounts/:accountId/sessions`, `POST /api/v1/training/sessions/:sessionId/check-in`, `POST /api/v1/training/sessions/:sessionId/complete` | Site visit creates/checks in/completes through CRM; failed completion creates retryable draft | Ready to run |
| Training | Formal training check-in/complete | `GET /api/v1/training/sessions?includeVisits=false`, `POST /api/v1/training/sessions/:sessionId/check-in`, `POST /api/v1/training/sessions/:sessionId/complete` | Training tab is discoverable; required notes/attendee/follow-up blocker copy is clear; CRM save and draft fallback both work | Ready to run |
| Training proof | Camera/gallery proof upload | `POST /api/v1/training/sessions/:sessionId/proof` | Up to 3 photos upload, 4 MB cap is enforced, unsupported MIME/oversize errors are readable | Ready to run |
| Consignment | ROSE line-item audit | `GET /api/v1/consignment/sites`, `GET /api/v1/consignment/sites/:siteId`, `GET /api/v1/consignment/sites/:siteId/audits`, `PATCH /api/v1/consignment/audits/:auditId` | Expected/actual/variance lines submit to CRM; variance leaves reconciliation open | Ready to run |
| ROSE evidence | Camera/gallery evidence upload | `POST /api/v1/consignment/audits/:auditId/evidence` | General/discrepancy photos upload before audit submit; offline drafts retain metadata only | Ready to run |
| Notifications | Alert/status route links | Same live queue endpoints plus local draft queue | Draft counts and CRM work signals open the right destination | Ready to run |
| Sync Status | Draft review/retry/discard | Route, Training, and Consignment retry endpoints above | Drafts show `Draft on phone`, `Needs retry`, `Needs review`, and `CRM saved` accurately | Ready to run |
| iOS simulator | Bottom tabs and keyboard-heavy forms | Same as screen-specific rows | No clipped tab labels, hidden blockers, stuck keyboard focus, or unreachable submit controls on iPhone 17 Pro Max simulator | Ready to run |
| Mobile viewport | Web/export smoke for quick regression | Same as screen-specific rows through mocked/live API as available | Screen layout remains usable at narrow mobile widths; no overlapping text/buttons | Ready to run |

## Parked Dependencies To Keep Out Of Defect Count

- Android emulator QA until local Android SDK/JDK/adb are available.
- Large encrypted file-backed offline media cache; current offline drafts must remain text/metadata-only.
- Background sync worker and push/deep-link wakeups.
- Conflict merge UI and server-side conflict resolution beyond review/retry/discard states.
- Malware scanning/quarantine workflow and MIME magic-byte validation.
- Provider-backed route optimization, geofencing, and navigation handoff.
- Acumatica warehouse, inventory, PO execution, financial posting, and Acumatica attachments.
- Outlook/Teams/WebEx bidirectional scheduling provider decisions.
- Voice transcription provider and retention policy.

## Usability Risks To Watch

- The mobile tab bar now includes Training; confirm labels still fit and the Consignment label remains understandable as `Consign`.
- Media upload failures happen before field users submit the final audit/training completion; verify the app does not lose counts, notes, attestation, or follow-up text.
- Sync Status now carries more review detail; confirm field users can tell which draft is retryable versus review-only without reading technical wording.
- API base URL switching is safer, but QA users can still select Local QA; confirm production users are not nudged into editing the endpoint.
- iOS camera/gallery permissions, weak-signal retries, and keyboard behavior need native simulator coverage, not only browser export coverage.

## Key Findings For Next Cycle

- No code or live tests were executed in this report pass; this is a QA execution draft based on the current docs and working-tree inspection.
- The highest-risk live route is `POST /api/v1/consignment/audits/:auditId/evidence` because it depends on the routing/config fix and new storage-backed service path.
- Training proof upload has a similar media/body-limit risk, but its route already existed and now has explicit mobile-sized body handling.
- Prototype surfaces preserved: Home, Leads, Accounts, Route, Consignment, Training, Notifications, and Sync Status remain in the approved field-app shell.
- Backend-wired surfaces to verify: auth/session, lead/account reads, OCR preview, route site visits through Training `site_visit`, formal Training, Training proof upload, ROSE audit update, and ROSE evidence upload.
- Remaining non-dependent gaps for QA attention: iOS form ergonomics, partial endpoint failure behavior, failed media upload recovery, draft retry labeling, and route conflicts returning review states.
- UI that should not ship as a fake completion: offline photo-byte persistence, route optimization/geofencing, Acumatica posting/attachments, push/deep-link flows, and provider scheduling integrations.

## Suggested Evidence To Capture

- iOS simulator screenshots for Login, Home, Training, Training proof upload, Consignment ROSE evidence, Sync Status retry, and API error state.
- Network/API log snippets proving mobile origin routing for `localhost:8081` and live `https://pulse-crm.theclustox.com`.
- One live or seeded successful Training proof upload response.
- One live or seeded successful Consignment audit evidence upload response.
- One forced-failure draft preservation case for Route, Training, and ROSE.
