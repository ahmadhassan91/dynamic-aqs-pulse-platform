# Dynamic AQS Pulse Delivery Progress Tracker

Last updated: 2026-04-14

This tracker is the production-repo progress view for delivery execution.

Use it to:
- see current build status without re-reading the roadmap
- track what is done, in progress, blocked, or not started
- attach implementation evidence as the team ships foundation and modules

## Status Legend

| Status | Meaning |
| --- | --- |
| `Done` | Implemented, validated, and merged into the platform repo |
| `In Progress` | Active engineering work is underway |
| `Planned` | Sequenced and approved, but not yet started |
| `Blocked` | Waiting on access, sign-off, or dependency closure |
| `Deferred` | Explicitly outside the current active delivery window |
| `Parked` | Intentionally held for a later slice after the current foundation settles |

## Release Tracker

| Release | Target Window | Status | Focus | Notes |
| --- | --- | --- | --- | --- |
| Release 0 | Mar 30 - May 31, 2026 | `In Progress` | Architecture closure, schema baseline, mappings, environment readiness | Engineering repo is live and backend foundation has started. |
| Release 1 | Jun 2 - Aug 24, 2026 | `Planned` | Platform foundation and Wave 0 migration readiness | Depends on Release 0 gate closure. |
| Release 2 | Aug 25 - Nov 16, 2026 | `Planned` | Revenue operations pilot and Wave 1 migration | Starts after core auth/data/integration foundations are stable. |
| Release 3 | Nov 17, 2026 - Mar 8, 2027 | `Planned` | Dealer, field, reporting, consignment pilot | Residential-first delivery with commercial-safe foundations underneath. |
| Release 4 | Mar 9 - May 17, 2027 | `Planned` | Cutover, GA, hypercare | Final migration and controlled launch. |

## Foundation Workstreams

| Workstream | Status | Current Position | Next Step | Evidence |
| --- | --- | --- | --- | --- |
| Monorepo platform bootstrap | `Done` | Production monorepo is established and pushed | Continue feature slices inside the new repo | `README.md`, `turbo.json`, `pnpm-workspace.yaml` |
| PostgreSQL + Prisma core schema | `Done` | Core CRM schema and migration pipeline foundation are in place | Extend schema for auth/session and domain modules | `packages/db/prisma/schema.prisma` |
| Queue and worker runtime | `Done` | `pg-boss` queue and worker bootstrap are live | Add domain jobs after auth/audit foundation | `apps/api/src/queue/` |
| Migration raw snapshot staging | `Done` | Guarded rehearsal/cutover evidence pipeline is implemented | Build normalization/import workers on top | `apps/api/src/modules/migrations/` |
| Migration normalization path | `Done` | Admin-triggered raw-to-canonical normalization is implemented and locally verified | Build governed import workers on top of normalized payloads | `apps/api/src/modules/migrations/` |
| Auth, session, audit persistence | `Done` | Provider-aware auth/session foundation is merged, runtime-verified, and now shared through a reusable request-auth/authz helper | Add Entra and dealer-specific identity flows later without rewriting the session core | `apps/api/src/modules/auth/`, `apps/api/src/utils/audit.ts`, `packages/db/prisma/schema.prisma` |
| Reference data seed + admin APIs | `Done` | Business-segment, lead-source, and lead-stage reference foundations are seeded and locally verified through governed APIs, including bulk upsert endpoints for lead-stage and lead-source packs | Add file-ingest adapters and broader admin CRUD entities | `apps/api/src/modules/reference/`, `packages/db/prisma/schema.prisma` |
| Lead intake and routing backbone | `In Progress` | Service-tech-count-based lead intake, routing policy, public website capture, duplicate-aware website submission tracking, repeat-submission review APIs/UI under `/leads/forms`, website registry admin APIs, notification-recipient APIs, internal lead APIs, stage history, policy-driven workflow-queue read models, lifecycle controls (`active / parked / closed`), PRD-backed SLA defaults (`24h` initial contact / `72h` discovery scheduling / `5` business-day CIS follow-up), approved US/Canada region validation, marketing-source / lead-rating capture, native website-form address / customer-status metadata preservation, live territory assignment metadata, and a backend-wired lead history feed plus inactive operational views under `/leads/activities` are now locally verified in the production API | Finish downstream alert delivery, duplicate-resolution decisions beyond auto-attach review, deeper named-owner override flows, and richer server-side analytics/archived reporting now that queue, history, and inactive lifecycle views are live | `apps/api/src/modules/leads/`, `packages/contracts/src/leads.ts`, `packages/contracts/src/lead-options.ts`, `packages/db/prisma/schema.prisma`, `apps/api/test/leads.website-forms.regression.test.mjs`, `apps/api/test/leads.workflow.regression.test.mjs`, `apps/api/test/leads.activity-history.regression.test.mjs` |
| Onboarding readiness + conversion kernel | `In Progress` | CRM-owned readiness state, checklist items, lead-contact mapping, conversion preparation, and first-order conversion boundary APIs are now implemented, typed, and locally validated; checklist generation still correctly blocks until finance is cleared | Complete deeper lead-record parity and then wire the finance-approved happy path all the way through the first-order boundary | `apps/api/src/modules/leads/readiness.ts`, `packages/contracts/src/leads.ts`, `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/20260413164700_onboarding_readiness_conversion_kernel/` |
| Lead file-ingest adapters | `Done` | CSV/XLSX preview plus mapped-import adapters are locally verified on top of the governed lead import flow | Rewire the frontend upload UI to use preview + mapping + import APIs | `apps/api/src/modules/leads/file-ingest.ts`, `apps/api/src/modules/leads/http.ts` |
| CIS slice implementation planning | `Done` | Discovery-backed production plan now exists for digital CIS magic-link flow, scanned PDF parse fallback, internal review, and payment-safe boundaries | Start Slice A: CIS domain foundation | `docs/CIS_SLICE_IMPLEMENTATION_PLAN.md` |
| CIS domain foundation | `In Progress` | CIS package lifecycle, hashed public link flow, public draft/submit, internal sales sign-off, finance queue listing, finance submission, and finance decision capture are now runtime-verified without storing raw payment data | Add `crm-web` CIS review actions, then scanned-PDF parse fallback and hosted payment integration | `apps/api/src/modules/cis/`, `packages/contracts/src/cis.ts`, `packages/db/prisma/schema.prisma` |
| Acumatica integration boundary | `In Progress` | Safe client/error scaffold exists | Add certified endpoint adapters after sandbox confirmation | `packages/acumatica/src/` |
| Shared API contract baseline | `In Progress` | Core auth plus explicit customer/contact/location contract surfaces now exist | Add governed import contracts and account hierarchy contracts | `packages/contracts/src/` |
| Account and contact core API | `In Progress` | Authenticated account, contact, and nested location endpoints are implemented and locally verified against Postgres | Expand into hierarchy, lifecycle state, and governed import paths | `apps/api/src/modules/accounts/` |
| Web rewire from prototype data layer | `In Progress` | The approved Pulse CRM shell is now enforced at the routed workspace level, the website-forms experience has been pulled back toward the approved prototype with the correct management tabs, repeat-submission review now lives inside the same `/leads/forms` workspace against live backend APIs, active protected routes no longer expose an inline dev-only session gate or editable API URL, the admin-side website-form preview now renders the real hosted Pulse form component instead of a duplicated static preview, lead record lifecycle actions now run inside the prototype detail workspace against live backend APIs, the lead-capture admin flow now saves routing + SLA policy through the real backend, and `/leads/activities` now combines the live workflow queue with recent lead history and inactive parked/closed lead review under the same approved route | Continue broader module-route rewiring on the same prototype shell and bring the next lead subviews to the same level of parity | `apps/crm-web/src/` |
| Prototype-aligned admin and auth workspace | `Done` | Login, protected route gating, admin overview, user management, roles/permissions, and audit activity now run inside the approved prototype shell with live backend wiring, a shared env-driven session provider, and no inline dev-only session gate inside active protected routes | Extend only when additional non-placeholder admin scope is explicitly approved | `apps/crm-web/src/app/auth/`, `apps/crm-web/src/app/admin/`, `apps/api/src/modules/admin/` |
| Lead module regression suite | `In Progress` | Isolated lead regressions now cover seeded website forms, public form gating, duplicate website capture, repeat-submission review ordering, website-form archive visibility, archived duplicate-review visibility, inactive-lifecycle duplicate boundaries, native-form address/customer-status metadata preservation, admin site/recipient management, approved region validation, PRD-backed routing/SLA defaults, historical leads missing due dates, discovery scheduling SLA prioritization, CIS follow-up timing, dead/not-interested closure, parked/reopen behavior, dedicated history-feed ordering/search, inactive lifecycle filtering, queue/archive separation, onboarding-readiness blockers, contact-import idempotency, conversion-prep validation, and first-order conversion boundary behavior against a dedicated test database | Expand next into duplicate-resolution decisions beyond auto-attach review, deeper activity/history semantics, and territory-assignment edge cases | `apps/api/test/leads.website-forms.regression.test.mjs`, `apps/api/test/leads.workflow.regression.test.mjs`, `apps/api/test/leads.activity-history.regression.test.mjs`, `apps/api/test/leads.readiness.regression.test.mjs`, `apps/api/test/support/runtime.mjs` |
| CIS module regression suite | `Done` | Dedicated CIS/finance regressions now cover resend/idempotency, draft merging, public submit validation, post-submit lockout, finance submission gating, finance branching (`info_requested`, `conditional`, `approved`, `declined`), queue filtering, and permission denial | Add OCR fallback and provider-boundary regressions only when those slices become active | `apps/api/test/cis.regression.test.mjs`, `apps/api/test/support/runtime.mjs` |
| Auth and admin regression suite | `Done` | A dedicated auth/admin regression suite now covers bootstrap login, refresh/logout behavior, admin user CRUD, password reset revocation, role catalog, overview metrics, and import behavior against the test database | Expand next into permission-denial, inactive-user, and UI-driven smoke coverage | `apps/api/test/auth.admin.regression.test.mjs`, `apps/api/test/support/runtime.mjs` |
| Territory kernel and workspace | `In Progress` | Territory policy, regions, shipping centers, territory coverage, lead assignment history, manual override, automatic re-resolution on policy/coverage changes, and a dedicated regression suite are live in the API, while `/territories` and `/territory_map` now run inside the approved prototype shell using live territory and lead data for the `dashboard / map / list` workspace, including live lead territory override actions and assignment-history review | Add named-owner override UX, account/location propagation, and richer map visualization after the kernel slice settles | `apps/api/src/modules/territories/`, `packages/contracts/src/territories.ts`, `apps/api/test/territories.regression.test.mjs`, `apps/crm-web/src/components/territories/`, `apps/crm-web/src/app/territories/`, `apps/crm-web/src/app/territory_map/` |
| Mobile rewire from prototype data layer | `Planned` | Prototype remains reference baseline | Introduce real auth/session and sync transport | `apps/mobile/` |
| CI/CD and environment controls | `Planned` | Basic build/typecheck flow exists | Add release pipelines, checks, secrets, deployment notes | `infra/` |

## Module Delivery Tracker

| Wave | Module | PRD Readiness | Build Status | Notes |
| --- | --- | --- | --- | --- |
| Wave 0 | Program Foundation & Solution Architecture | `Partial` | `In Progress` | Execution baseline exists; build controls are being established in code. |
| Wave 0 | Security, Identity, Environments & DevOps | `Partial` | `In Progress` | Provider-aware auth/session foundation is live, and the production web app now has prototype-aligned login plus protected admin and lead workspaces; Entra, MFA, and self-service recovery remain parked. |
| Wave 0 | QA, UAT, Rollout & Adoption | `Coverage Only` | `Planned` | Will be tracked once CI/test/release controls are added. |
| Wave 0 | Master Data, Admin Settings & Configuration | `Partial` | `In Progress` | Business-segment, lead-source, and lead-stage reference APIs are live, and the current admin scope now covers overview, users, roles/permissions, and activity only; broader admin config surfaces remain parked to avoid placeholder pages. |
| Wave 0 | Acumatica Integration & Data Migration | `Ready` | `In Progress` | Safe boundary, raw capture, and canonical normalization are underway; sandbox-certified adapters still pending. |
| Wave 1 | Lead Capture & Lead Management | `Ready` | `In Progress` | Backend backbone now covers Pulse-native web intake, hosted website forms, bulk import, service-tech-count-based routing, duplicate-aware website submission tracking, website registry admin APIs, notification-recipient management, policy-driven workflow queue reads, lifecycle closure/reopen behavior, PRD-backed SLA timing defaults, and the onboarding-readiness boundary, while the production web app now exposes pipeline, import, website forms, workflow queue, finance-linked lead flows, lifecycle actions, onboarding-readiness, and admin-managed routing/SLA policy under the approved prototype shell. |
| Wave 1 | CIS, Credit & Onboarding Workflow | `Mostly Ready` | `In Progress` | Slice A plus the internal review/finance queue baseline are live and runtime-verified on the API, and the production web app now exposes public token-based CIS pages plus internal send/sign-off/finance actions; CRM-owned readiness is now wired after CIS, while scanned-PDF fallback and hosted payment remain next slices. |
| Wave 1 | Customer, Account, Contact & Multi-Location Management | `Partial` | `In Progress` | Minimal authenticated account/contact/location APIs are verified, and the lead-side conversion kernel now prepares account/contact/location creation at the first-order boundary; hierarchy, classification writes, and lifecycle state are still to come. |
| Wave 1 | Dealer identity at company-account level | `Partial` | `Planned` | Will use shared auth foundation plus account context, not a separate auth stack. |
| Wave 2 | Product Management & Dealer Catalog Governance | `Mostly Ready` | `Planned` | Awaits account/dealer identity and Acumatica product sync groundwork. |
| Wave 2 | Digital Assets & Document Handling | `Mostly Ready` | `Planned` | Keep Widen scope bounded to validated product/dealer workflow. |
| Wave 2 | Pricing & ERP-Dependent Commercial Rules | `Mostly Ready` | `Planned` | Requires Acumatica certification and account/dealer context. |
| Wave 2 | Dealer Portal Replacement for Shopify | `Partial` | `Planned` | Reuse prototype UX, replace local/demo auth and service layer. |
| Wave 3 | Territory Management & Field Routing | `Mostly Ready` | `In Progress` | Territory kernel, state coverage, shipping-center alignment, lead assignment history, live lead override controls, and prototype-aligned `dashboard / map / list` workspace are now live; next depth is named-owner override UX, account/location propagation, and richer operational reporting. |
| Wave 3 | Mobile Field App | `Ready` | `Planned` | Prototype shell will be reused; auth/sync will be rebuilt underneath. |
| Wave 3 | Training Management | `Mostly Ready` | `Planned` | Depends on territory, account, and calendar/integration boundaries. |
| Wave 3 | Reports & Analytics | `Ready` | `Planned` | Semantic layer starts after governed APIs and audit-ready facts exist. |
| Wave 3 | Executive Dashboard | `Partial` | `Planned` | Depends on reports/semantic layer, not before it. |
| Wave 4 | Consignment Management | `Mostly Ready` | `Planned` | Requires warehouse/site master reconciliation and audit cadence logic. |
| Deferred | Commercial CRM Enablement | `Coverage Only` | `Deferred` | Commercial-safe schema stays in foundation; full workflow remains later-phase scope. |

## Current Milestone Checklist

| Milestone | Status | Notes |
| --- | --- | --- |
| New production monorepo created and pushed | `Done` | Active repo: `dynamic-aqs-pulse-platform` |
| Core Postgres/Prisma foundation | `Done` | Core CRM schema and migrations are live |
| Queue/worker foundation | `Done` | `pg-boss` runtime verified |
| Raw-source-first migration foundation | `Done` | Rehearsal/cutover staging verified locally |
| Raw-to-canonical normalization path | `Done` | Capture, normalize, and stage flow is locally verified |
| Provider-aware auth/session foundation | `Done` | Bootstrap auth, refresh, session lookup, logout, and audit events verified locally |
| Account/contact core module start | `Done` | Authenticated list/create/detail/contact endpoints are locally verified |
| Account-location nested API start | `Done` | Nested location list/create endpoints are locally verified |
| Reference data admin foundation | `Done` | Business segments and lead sources are seeded and locally verified through API |
| Lead intake and routing backbone start | `In Progress` | Lead schema, routing policy, public capture, import, and stage transition flows are locally verified |
| Lead stage reference admin baseline | `Done` | Seven seeded lead stages plus audited list/update APIs are locally verified |
| Reference bulk-import admin baseline | `Done` | Lead-stage and lead-source bulk upsert endpoints are locally verified against seeded workbook-style payloads |
| Lead CSV/XLSX preview and mapped-import baseline | `Done` | CSV and XLSX file preview plus mapped import endpoints are locally verified against the production API |
| Lead workflow regression expansion | `Done` | Discovery scheduling/completion/fast-track rules, CIS timestamp transitions, lead closure/reopen edge cases, and approved region validation are now covered in the dedicated lead regression suite |
| CRM web lead import workstation | `In Progress` | Lead import is live against the production API and now sits inside the restored prototype app shell; remaining parity work is limited to deeper polish, not backend rewiring |
| CRM web lead workspace baseline | `In Progress` | The lead workspace now runs inside the approved prototype shell with a shared `/leads` layout, live list/kanban/detail/stage-transition wiring, real lifecycle actions, and no page-level standalone wrapper |
| CRM web workflow queue baseline | `Done` | `/leads/activities` now exists in the restored shell and is wired to the live production lead data, PRD-backed SLA/routing policy, recent lead history feed, and inactive parked/closed lead review, providing a real operational queue instead of a placeholder screen |
| CRM web website forms baseline | `Done` | `/leads/forms`, `/admin/lead-capture`, and `/settings/lead-capture` now resolve to the same restored prototype-style management screen, the public hosted form captures the fuller replacement-HubSpot intake payload against the live production API, the admin preview modal reuses the real hosted Pulse form component instead of a duplicated static preview, and routing/SLA policy is now editable through the live backend |
| CRM web finance queue baseline | `Done` | `/leads/finance` now exists in the restored shell and is wired to the live finance queue API |
| CRM web CIS workflow baseline | `In Progress` | Public token-based CIS pages and the embedded internal CIS workspace now use the approved prototype Mantine/card language with live backend actions; OCR fallback and hosted payment remain later slices |
| CRM web onboarding readiness baseline | `In Progress` | `/leads/[id]` now includes a prototype-aligned onboarding-readiness tab that uses live checklist, contact-mapping, conversion-prep, and first-order-boundary APIs instead of placeholder onboarding UI |
| CRM web auth and admin baseline | `Done` | `/auth/login`, `/admin`, `/admin/users`, `/admin/roles`, and `/admin/activity` now build inside the approved prototype shell with live login, protected-route gating, user management, role matrix, activity audit flows, and no inline dev-only API URL gate in active protected routes; concept-only admin tabs are intentionally excluded from the active build |
| CRM web territory workspace baseline | `In Progress` | `/territories` and `/territory_map` now use the approved prototype route/component structure with live `dashboard / map / list` views against the production territory kernel, shipping-center registry, and lead assignment data instead of mock stores or standalone UI, and the territory workspace now exposes live lead override and assignment-history actions against the backend |
| Auth and admin regression baseline | `Done` | A dedicated auth/admin regression suite now exists for login, refresh/logout, admin user CRUD, password reset revocation, role catalog, overview metrics, and imports against the isolated test database |
| Territory kernel regression baseline | `Done` | Territory regressions now cover route mounting, default shipping-center seed, approved region normalization, duplicate-state conflict protection, default assignment propagation into lead contracts, policy-driven owner assignment rules, manual override idempotency, and permission-denial behavior |
| CIS slice implementation plan | `Done` | Production repo now includes the CIS epic plan with schema, API, routes, state machine, blockers, and phased delivery order |
| CIS domain foundation baseline | `Done` | Runtime-verified issue-link, internal fetch, public fetch, draft save, and submit flows are now live on the production API with hashed tokens and no raw PCI/bank persistence |
| CIS internal review and finance queue baseline | `Done` | Runtime-verified sales sign-off, finance submission, `awaiting_submission` / `pending` queue filters, and finance approval capture are now live on the production API without storing raw bank/card details |
| Shared request authz helper for business modules | `Done` | Customer routes now reuse one request-auth/authz path instead of duplicating bearer/session checks |
| Progress tracker established in repo | `Done` | This document is the tracker baseline |

## Parked Items

These are intentionally not being built yet, but they should stay visible so they can be picked up later without rediscovery.

| Item | Status | Why Parked Now | Revisit Trigger |
| --- | --- | --- | --- |
| Microsoft Entra login for internal staff | `Parked` | Session core exists; real OIDC wiring should wait until tenant, group mapping, and IT sign-off are ready | Release 0 identity sign-off and tenant access |
| Dealer invite, password reset, and company-user provisioning | `Parked` | Dealer identity depends on account/contact context and portal model, not just auth plumbing | Dealer identity module start |
| MFA, lockout, and password-recovery hardening | `Parked` | Important, but not needed before the core auth/session model is proven | Before non-prod internal pilot |
| Service-to-service/API key identities | `Parked` | Integration boundary exists, but service auth should follow concrete integration needs | When external automation or webhook flows are introduced |
| Fine-grained permission persistence beyond role defaults | `Parked` | Current role/module/action model is enough for early foundation | When admin-managed entitlements are in scope |
| Account classification and business-segment write APIs | `Parked` | Classification ownership and drift-handling rules should not be hardcoded before business sign-off is final | When customer/account modeling moves beyond the minimal core |
| Account-location hierarchy write APIs | `Parked` | Nested location endpoints exist, but full hierarchy modeling needs migration and mapping clarity | Customer workspace expansion |
| Primary contact/location DB-level uniqueness hardening | `Parked` | Service-level guard exists for primary contacts, but stronger relational constraints should follow once hierarchy rules are locked | When account-location and contact write paths expand |
| Account lifecycle state machine and ERP sync status badges | `Parked` | Needs field mapping and first-order activation rules finalized | Customer workspace phase |
| Signed workbook handoff and file-ingest adapters for lead/admin references | `Parked` | API-level bulk upsert now exists for stage/source config, but real signed workbook files still need a governed handoff path and optional CSV/XLSX ingestion adapter | When approved workbooks and file format examples are available |
| Deeper lead workspace rewiring beyond the new baseline | `Parked` | The restored shell now wraps the live lead routes, but full parity features like smart views, richer analytics, inline editing, and deeper workflow actions still need later slices | When the next `crm-web` lead workflow slice begins |
| Server-backed lead workspace pagination and aggregate summary cards | `Parked` | The live lead workspace is operational, but larger datasets still need authoritative paginated board/list loading and server-computed summary metrics instead of client-side snapshots over the active result window | When the next lead workspace hardening pass begins |
| Saved field-mapping templates for recurring uploads | `Parked` | The backend now supports explicit column mappings, but reusable saved templates should follow once real file patterns are confirmed | When the first real trade-show or roster files are received |
| Large-file upload transport (multipart/presigned) | `Parked` | Current JSON base64 transport is fine for early internal uploads and frontend wiring, but larger operational files should move to multipart or presigned upload flows later | When file sizes or browser limits make JSON upload impractical |
| Lead routing basis reconciliation (`serviceTechCount` vs legacy truck-count wording) | `Parked` | Latest meetings support service-tech-count routing, but roadmap/prototype artifacts still contain older truck-count language and need formal source-of-truth cleanup | When lead module sign-off pack is refreshed against the meeting baseline |
| Lead routing threshold wording and governance | `Parked` | Current implementation keeps the threshold configurable, but the exact written wording of the `5` rule should be formally ratified in the baseline docs | When lead routing policy workbook is approved |
| Territory named-owner override UX and account/location propagation | `Parked` | Lead-level territory kernel is now live, but richer manual override screens, account/location propagation, and broader ownership maintenance should follow after the first territory slice settles | When territory slice moves from kernel to operational admin depth |
| Lead intake source vocabulary cleanup (`HubSpot` legacy vs Pulse-native active sources) | `Parked` | HubSpot remains relevant for migration history, but new lead intake should use Pulse-native source vocabulary without polluting current-state reporting | When migration source mapping and active source lists are signed off |
| Bulk-import matching and roster provenance rules | `Parked` | Trade-show and roster imports are in scope, but duplicate detection precedence and source-run versioning need explicit approval | When bulk import workbook/examples are approved |
| Pre-routing TM visibility rules | `Parked` | Lead routing ownership is being modeled, but TM visibility before assignment is still not cleanly ratified across the role matrix and open-question register | When lead visibility and assignment governance are signed off |
| Lead stage vocabulary harmonization | `Parked` | The backbone uses the validated seven-stage pipeline, but dashboard/reporting artifacts still carry older vocabulary and one customer-ready label remains inconsistent | When the lead PRD and reporting pack are reconciled |
| Discovery-stage mandatory vs optional gating | `Parked` | Current materials support skip-with-reason behavior, but the open-question register still treats discovery-call strictness as unresolved | When lead workflow acceptance criteria are finalized |
| Public website capture hardening | `Parked` | Public lead capture route is intentionally open for the first slice, but final origin controls, embed/auth model, and rate limiting still need to be added | Before external website integration begins |
| Later-flow trigger contracts from lead to CIS/onboarding/activation | `Parked` | Lead backbone should emit clean stage changes first; downstream automation should follow once each dependent module is started | When CIS/onboarding and first-order activation slices begin |
| CIS OCR / vision extraction production approach | `Parked` | Discovery confirms scanned PDF parsing as a fallback path, but the production parser stack and confidence review model should be selected intentionally before implementation hardens | When CIS Slice D begins |
| CIS payment-provider and hosted tokenization finalization | `Parked` | CIS flow requires card-on-file/tokenized handling, but the final provider and hosted-session design should be confirmed before payment wiring is implemented | When CIS Slice E begins |
| CIS email delivery/provider for send and resend link | `Parked` | Magic-link flow is confirmed, but production send/resend behavior should not hardcode a provider until email delivery architecture is signed off | When CIS Slice B begins |
| Website embed distribution refinements and operational analytics | `Parked` | Core website registry CRUD, hosted form generation, notification-recipient management, and fuller public-form field capture are now live; later polish should focus on embed package distribution UX, recent-submission analytics, and recipient-routing refinements once operational usage starts | When real branded-site rollout begins |
| Self-service forgot-password and registration flow | `Parked` | Local admin-managed users are live, but email-driven recovery and public registration should not be exposed until the delivery/provider boundary and user-lifecycle rules are approved | When outbound email and dealer/internal identity rules are finalized |
| Concept-only admin tabs (`System Health`, `Integrations`, `Backups`, `Data Quality`) | `Parked` | These existed as prototype exploration surfaces, but they are intentionally excluded from the active production build to avoid placeholder pages and fake data | Revisit only if the module becomes explicitly in-scope with real backend requirements |
| CIS PDF generation and record-packaging | `Parked` | The package core now stores the structured CIS safely, but printable PDF generation should follow once the internal review layout and document strategy are settled | When CIS Slice C or D needs record export |
| SLA notification delivery and escalation dispatch | `Parked` | PRD-backed SLA timers and escalation windows are now modeled in the live lead policy, but actual outbound alert delivery to owners, managers, and leadership still depends on the notifications/provider slice | When alerts/notifications configuration is approved |
| Finance-approved onboarding happy-path runtime proof | `Parked` | Readiness and conversion-prep APIs are now live, but the full happy path from finance-approved CIS through checklist completion to first-order conversion still needs one integrated runtime pass once a finance-approved package is available | When a finance-approved CIS package or seeded QA package is available |
| Acumatica first-order handoff implementation | `Parked` | The CRM-owned readiness and first-order conversion boundary are now modeled cleanly, but the true ERP handoff stays parked until sandbox access and endpoint certification are available | When Acumatica sandbox access is granted |
| Full lead intake/workflow module | `Parked` | Backbone is now in progress, but admin-managed routing, reference-driven stage config, and downstream automation remain later slices | After backbone verification and lead governance sign-off |
| Governed import workers from normalized payloads | `Parked` | Canonical normalization now exists; direct writes into governed CRM tables should wait until field mappings and ownership rules are tighter | After normalized payload review and field mapping sign-off |
| Queue-driven normalization orchestration | `Parked` | Admin-triggered normalization is enough for early foundation; queued batch fanout should follow real data volume and retry needs | When migration rehearsal scale justifies it |
| Feature flag vendor integration and admin experience | `Parked` | Local feature-flag table exists, but vendor selection and final operational model are still open architecture decisions | After feature-flag vendor decision is closed |
| Prototype web/mobile rewiring to real account APIs | `Parked` | Backend contracts should stabilize before client rewiring starts | After first account/contact API review |

## How To Update This Tracker

When a meaningful slice lands:
1. Update the relevant workstream row.
2. Update the matching module row if delivery status changed.
3. Add or adjust milestone evidence links.
4. Keep notes short and factual.

Do not use this tracker for vague intent.
Use it for shipped evidence, active work, or real blockers.
