# 16 — Notifications & Alerts PRD (Scope)

**Status:** Draft scope for review · **Created:** 2026-06-21 · **Owner:** Pulse / Clustox
**Source:** Reverse-engineered from the discovery + to-be meeting transcripts (see §8) and a code inventory of the as-built alert infrastructure. No prior Notifications PRD existed; this is the first.

---

## 1. Why this exists

"Alerts and notifications" is one of the two outcomes the client has named, from day one, as the single most important reason for building Pulse:

> "From day one we've talked about the most important things out of this Pulse is reporting and alerts and notifications." — C G

The #1 pain with their current Dynamics CRM is that it has **no proactive alerting** — for lead handoffs, order frequency, account inactivity, audit status, or credit holds. Pulse already *detects* many of these conditions (two real alert scanners exist), but there is **no per-user place to see them and no channel that delivers them in production**. This PRD scopes a real Notifications module: a unified per-user inbox, multi-channel delivery, and admin-configurable routing.

---

## 2. What already exists vs. what's missing (grounded in code)

**Built — the detection/trigger layer is largely real:**
- **Lead Operational Alert engine** — `apps/api/src/modules/leads/alerts.ts` + `LeadOperationalAlert` / `LeadOperationalAlertDeliveryAttempt` models. Scans NEW-stage leads; materializes `ROUTING_BROADCAST`, `INITIAL_CONTACT_MANAGER_ESCALATION` (24h SLA), `INITIAL_CONTACT_LEADERSHIP_ESCALATION` (48h SLA) with `dedupeKey` idempotency. Admin settings, metrics, retry/dead-letter, and a working **quiet-hours** policy (default 18:00–08:00 PT).
- **Consignment Operational Alert engine** — `apps/api/src/modules/consignment/alerts.ts` + `ConsignmentOperationalAlert`. Scans ROSE audits (T‑14/‑7/0/+7/+14) and PO clocks (start/T‑3/T‑1/+5/+10); materializes 10 alert types with status tracking.
- **ReportSchedule digest engine** — model + `REPORT_SCHEDULE_SCAN_QUEUE` worker that runs daily/weekly/monthly schedules and records deliveries (backs the "auto-email a saved report monthly" ask).
- **Microsoft Graph delivery mode** — `sendMail` path exists, but is config-gated to **PREVIEW** (records an attempt, sends nothing).
- **Mantine notifications CSS** loaded in `crm-web` (toast framework ready, unused).
- `WebsiteLeadNotificationRecipient` model (captures notify-emails; no send).
- Mobile offline draft queue + Sync Status (a field-worker surface, adjacent to but not a notification feed).

**Parked / not built — the per-user inbox + every delivery channel:**
- **No `UserNotification` model** — the existing alerts are entity-scoped, with **no per-user aggregated inbox**, no read/unread, no header **bell/badge**, no notification-center API. *(This is the single biggest gap.)*
- **Email** is PREVIEW-only, blocked on **Microsoft Graph credentials** (tenantId/clientId/clientSecret/fromUser). One provisioning unblocks lead-alert, consignment-alert, website-lead, and report-digest email **simultaneously**.
- **Mobile push** — no provider at all (no expo-notifications/FCM/APNs).
- **SMS** — none.
- **No channel fan-out abstraction** (alerts are coupled to email-attempt recording), **no admin routing config**, **no per-user preferences**, **no retention/TTL policy**.

> **Read the event catalog (§5) "Status" column with this in mind:** `built` means *the trigger/alert row is produced today* — it does **not** mean a user can see or receive it. Until FR-NOTIF-001/002 land, no event reaches an end user.

---

## 3. Channels in scope

| Channel | Status | Notes |
|---|---|---|
| **In-app notification center** (per-user inbox + bell + unread badge) | Not built | Dominant client preference for internal, time-sensitive events. *"There's a notification bell as well to… point out there are some notification pending for your review."* |
| In-app toast (transient) | Framework loaded, unwired | Mantine CSS present; not wired to events. |
| **Email** | PREVIEW-only (parked on Graph) | Customer-facing messages + report/order digests. Not for high-frequency internal events. |
| **Mobile push** (deep-linked) | Not built (no provider) | TM field alerts; must be concise + deep-link into the record. |
| **SMS / text** | Not built | Mentioned once for off-platform past-due; **P2, not committed**. |
| **Scheduled digest email** | Engine built, send parked | `ReportSchedule` worker exists; send parked on Graph. |

---

## 4. Personas (recipients)

Territory Manager (heaviest push consumer) · Regional Director (escalation target) · Business Development / Inside Sales (multi-recipient lead intake) · Leadership / Executive (pipeline-stall + digests) · Operations / Onboarding (CIS, warehouse-ready) · Finance / Credit (terms, past-due, credit-hold, declined cards) · Customer Service / Warehouse (order confirmations, daily digest) · **Dealer / Customer** (welcome, payment self-service) · **Admin / configurator** (defines who-gets-what).

---

## 5. Event catalog (deduped, grounded in transcripts)

Status legend: `built` = trigger produced today (not yet surfaced/delivered) · `partial` = trigger partially present · `not_built` · `parked` (external dep).

| # | Event (trigger) | Channels | Personas | Pri | Status |
|---|---|---|---|---|---|
| 1 | New lead received / assigned to BD team (multi-recipient broadcast) | in-app, push | BD, TM | P0 | partial |
| 2 | Lead routed to Strategic Growth vs national TMs (truck-count) | in-app | SGT, TM | P1 | built |
| 3 | **CIS received / form submitted** | in-app, email | Ops, BD, Leadership | P0 | not_built |
| 4 | Lead pipeline stage transition / handoff to next owner | in-app | BD, Sales | P1 | not_built |
| 5 | Lead stalled 48h (manager → leadership SLA escalation) | in-app, email | BD, Leadership, RD | P0 | partial |
| 6 | Account terms / credit approval complete | in-app | BD, Finance | P1 | not_built |
| 7 | First order placed on a new account | in-app | BD, Sales leadership | P1 | not_built |
| 8 | ROSE / consignment audit due (T‑14/T‑7/due heads-up) | in-app, push | TM, RD | P0 | built |
| 9 | ROSE / consignment audit overdue (+7/+14 red) | in-app, push | TM, RD, Compliance | P0 | built |
| 10 | Missing PO during reconciliation (compliance alert) | in-app, email | TM, RD, customer | P0 | built |
| 11 | PO overdue beyond threshold → auto-escalate to RD | in-app | RD | P0 | built |
| 12 | Compliance case manually escalated to RD | in-app | RD, TM | P1 | partial |
| 13 | Missing-PO customer reminder (outbound) | email | Consignment customer | P1 | parked |
| 14 | Consignment onboarding complete → warehouse-ready | email, in-app | Ops | P1 | not_built |
| 15 | **New customer/lead assigned to TM on mobile (deep link)** | push | TM | P0 | not_built |
| 16 | Mobile multi-trigger field alert (overdue order / training / follow-up due) | push, in-app | TM | P1 | not_built |
| 17 | **Account past due (yellow) → notify configured roles** | in-app, email | TM, RD, Finance, Dealer | P0 | not_built |
| 18 | **Credit hold (red, blocks ordering) → notify roles + dealer** | in-app, email | TM, RD, Finance, Dealer | P0 | not_built |
| 19 | Credit-hold/past-due mirrored from Acumatica into Pulse | in-app | TM, Field, Finance | P0 | not_built |
| 20 | Credit card declined / needs updated card | in-app, email | TM, Finance, Dealer | P1 | not_built |
| 21 | ACH / payment failed → dealer self-service pop-up | in-app | Dealer | P1 | not_built |
| 22 | Order submitted via portal/Shopify → confirm customer + notify CS | email | CS, Dealer | P1 | not_built |
| 23 | Daily order digest to warehouse/ops (replaces per-order storm) | email | Warehouse/Ops | P1 | not_built |
| 24 | Dealer onboarding complete → welcome email + portal login | email | New customer | P1 | not_built |
| 25 | Training overdue / no activity within interval (90d / 6mo) | in-app | TM, RD | P1 | not_built |
| 26 | Training certification milestone (e.g. 4 of 9) | in-app | Training coord, RD, TM | P2 | not_built |
| 27 | Customer inactivity (no order 8wk / no visit 6mo) | in-app | TM, RD | P1 | not_built |
| 28 | Billing / contact info changed on account | in-app | Finance/Ops | P2 | not_built |
| 29 | Website lead submitted → notify configured recipients | email | BD, Inside sales | P1 | partial |
| 30 | Scheduled report digest auto-emailed to a group (d/w/m) | email | Exec, RD, TM, Finance | P1 | partial |
| 31 | **Pending-notification bell badge** (count) | badge, in-app | All | P0 | not_built |
| 32 | Free-shipping threshold nudge | in-app | Dealer | P2 | not_built |

---

## 6. Functional requirements

| ID | Requirement | Pri | Depends on |
|---|---|---|---|
| **FR-NOTIF-001** | Universal per-user **`UserNotification`** model (recipientUserId, category/eventType, title, body, deepLinkRef, severity yellow/red, createdAt, readAt, archivedAt, dedupeKey, sourceAlertId?). The aggregation layer that unifies the entity-scoped Lead/Consignment alerts into a per-user feed. | P0 | — |
| **FR-NOTIF-002** | In-app **Notification Center**: API to list/filter a user's notifications (category, read/unread, severity, date, paginated) + web header **bell + unread badge**. | P0 | 001 |
| **FR-NOTIF-003** | Read/unread lifecycle: mark-read, mark-all-read, archive, unread-count. Per-user `readAt` (a shared alert read by one recipient stays unread for others — supports "whoever's at their computer makes the call"). | P0 | 001 |
| **FR-NOTIF-004** | **Channel fan-out** abstraction: one event dispatches to one+ channels (in_app/email/push/sms) per recipient. Replaces the email-attempt-only coupling in `alerts.ts`. | P0 | 001 |
| **FR-NOTIF-005** | **Admin-configurable routing rules**: per eventType, which roles/users receive it and on which channels; editable as processes evolve. Satisfies the repeated *"we need to have control of that notification process… determine who gets it."* | P0 | 004 |
| **FR-NOTIF-006** | Per-user **preferences**: per-category opt-in/out + per-category channel selection; fall back to org default. | P1 | 005 |
| **FR-NOTIF-007** | Generalize the existing lead **quiet-hours** into a reusable, all-category capability (suppress non-critical push/email in-window; still record in-app). | P1 | 004 |
| **FR-NOTIF-008** | **Realtime-vs-digest** per category; reuse the `ReportSchedule` worker pattern to batch low-urgency events into a daily digest (fixes the "30 emails" order-storm). | P1 | 004 |
| **FR-NOTIF-009** | Wire **email** delivery via the existing Graph `sendMail` path; promote Lead/Consignment/website-lead/report-digest from PREVIEW → MICROSOFT_GRAPH once credentials land. One shared sender. | P1 | 004 + Graph creds |
| **FR-NOTIF-010** | Select + integrate a **mobile push** provider (recommend **Expo Notifications** / FCM+APNs); capture device tokens, deliver concise alerts carrying a deepLinkRef. | P1 | 004 + provider decision |
| **FR-NOTIF-011** | **Deep-link routing**: every notification carries an entity ref resolvable to a web route + mobile deep link. Client-critical for field adoption. | P0 | 001 |
| **FR-NOTIF-012** | **Dealer/customer-facing** payment notifications (past-due yellow, credit-hold red, card declined, ACH failed) with friendly, admin-editable action copy; gate ordering at credit-hold. | P1 | 001 |
| **FR-NOTIF-013** | **Acumatica credit-hold/past-due mirroring** → emit notifications when the ERP flag toggles, fanning out to all users on the account. | P1 | 004 + Acumatica |
| **FR-NOTIF-014** | Notification **lifecycle/retention**: TTL/archival for routine items + permanent compliance record for audit/PO/credit events. | P2 | 001 |
| **FR-NOTIF-015** | Delivery **observability**: per-channel status, retry w/ backoff, dead-letter visibility, admin health dashboard extended to all categories/channels. | P2 | 004 |
| **FR-NOTIF-016** | Validate payloads at the boundary (email/phone format) before dispatch; reuse the ReportSchedule recipient-email regex. | P2 | — |

---

## 7. Phased plan

1. **Phase 1 — In-app core (no external deps; build first).** `UserNotification` model + channel-agnostic dispatcher + Notification Center API + web bell/unread badge + read/unread/archive + deep-link routing (FR‑001/002/003/004/011). Bridge the **existing** Lead + Consignment scanners into this feed so alerts already being produced become visible immediately, purely in-app.
2. **Phase 2 — Config/admin (no external deps).** Admin routing rules + per-user preferences + generalized quiet hours + realtime-vs-digest engine (FR‑005/006/007/008). Delivers the #1 meta-ask (control over who-gets-what) and the daily-digest fix.
3. **Phase 3 — Email (single dependency: Graph).** Provision Microsoft Graph; promote all four parked email flows PREVIEW → live through one shared sender (FR‑009). One provisioning unblocks welcome/onboarding, missing-PO reminders, order confirmations, daily order digest, and report digests at once.
4. **Phase 4 — Mobile push (provider decision + integration).** Expo Notifications (FCM/APNs), device tokens, TM field alerts with deep-link payloads (FR‑010).
5. **Phase 5 — Finance + integration breadth.** Acumatica credit-hold mirroring, dealer payment self-service + order gating, retention policy, observability, and (only if confirmed) SMS (FR‑012/013/014/015).

---

## 8. Open questions (for the client)

1. **Microsoft Graph credentials** — when provisioned? (Gates *all* email: lead, consignment, website-lead, report digests.)
2. **Push provider** — confirm Expo Notifications (FCM+APNs), or is there an existing AQS push/MDM platform to reuse?
3. **SMS** — in scope or aspirational? If in scope, which provider (Twilio?) and which events (past-due only)?
4. **Default routing matrix** — for each P0 event (past-due, credit hold, CIS, ROSE overdue), who are the out-of-the-box recipients before admins customize?
5. **Escalation thresholds** — confirm the day-counts (PO-overdue→RD, ROSE 90-day windows, lead 48h stall, training 90d vs 6mo, inactivity 8wk/6mo). Org-wide constants or per-territory/account?
6. **Acumatica mechanism** — credit-hold/past-due via webhook/event, or must Pulse poll? (Determines real-time-ness.)
7. **Dealer-facing copy** — who authors the friendly payment-failure messaging? Confirm credit-hold hard-blocks portal ordering.
8. **Multi-recipient read semantics** — when one BD member acts on a shared lead alert, auto-dismiss for others, or stay unread per-recipient?
9. **Retention/compliance** — do audit/PO/credit notifications need a permanent immutable record? TTL for routine items?
10. **Quiet-hours scope** — apply the existing 18:00–08:00 PT window to all categories + per-user override? Should critical events (credit hold, ACH failed) bypass it?

---

## 9. Source traceability

Mined from: Discovery Sessions 1–12 (notably **Session 1** executive vision/alert gaps, **Session 10** mobile/consignment app alerts + deep links, **Session 11** dealer-portal payment/credit alerts, **Session 12** report digests), plus the intro/catch-up calls. Code inventory: `leads/alerts.ts`, `consignment/alerts.ts`, `ReportSchedule`/`REPORT_SCHEDULE_SCAN_QUEUE`, `WebsiteLeadNotificationRecipient`, `crm-web` Mantine notifications, mobile draft-queue. Representative quotes are inline in §5–§6.

> **Status note:** No longer just a scope — the in-app core is BUILT (see §10). The remaining gaps are tracked in §12.

---

## 10. §BUILD — Notifications module delivery (2026-06-21)

Built on branch `codex/entra-calendar-governance`. Every layer is `tsc`/eslint clean; notifications regression **4/4**; lead + consignment scan suites **120/120** (the bridge is invoked there).

- **Phase 1 — in-app core (COMPLETE):** `UserNotification` model + per-user inbox API (list / unread-count / mark-read / archive, strictly actor-scoped) — `d1d3f5b`; web Notification Center (header **bell + unread badge**, dropdown feed, **deep-links**) — `ece9eda`; **bridge** materializing Lead (assignee) + Consignment (site owner TM+RD) alert rows into the inbox, hooked best-effort into both scan jobs — `ef4799f`.
- **Phase 2 — preferences / page / routing (DONE except where parked):** per-category **preferences** (opt-out; muted categories skipped at the single materialization point) API `ce6b757` + `/settings/notifications` UI `cf15481`; full **`/notifications` page** (All/Unread/Archived + category filters, pagination, manage) `cf16f5d`; **admin routing rules** (FR-NOTIF-005) — `NotificationRoutingRule` + `resolveRuleRecipients` (role → all active users with that role; user → the user) + admin CRUD (gated on the admin module); the bridge now fans out to entity-defaults **∪** rule-recipients — `e8a6ab5`.

## 11. CG (Currie) requirement fulfillment

Mapped against CG's verbatim asks (§5–§6 quotes).

| CG asked for | Status | Where |
|---|---|---|
| "reporting and **alerts and notifications** … most important" — a real notification system | ✅ Built | inbox + bell + page |
| "we need to **control** that … **determine who gets it** … may change down the road" (his #1, said 3+ ways) | ✅ Built | routing rules `e8a6ab5` |
| "**notification bell** … notifications pending for your review" | ✅ Built | `ece9eda` |
| PO "past X days late → automatically **notifies a regional director**" | ✅ Built | consignment scan + bridge |
| ROSE audit "30-day … 90-day **red alert**" → "RD, TM, whoever we determine" | ✅ Built | consignment scan + severity + routing |
| Lead "**48 hours** without moving → another alert"; "a five came in, only four contacted" | ✅ Built | lead escalations surfaced in-app |
| Per-user "we determine what those alerts are and who gets them" | ✅ Built | preferences + routing rules |
| Past-due **yellow** / credit-hold **red** → "notify whoever we specify (RD/TM/accounting)" | ⚠️ Framework ready, **trigger parked** | severity + routing built; event needs Acumatica AR |
| TM "logs in … accounts past due … call Jimmy" (at-a-glance) | ⚠️ Inbox ready, **trigger parked** | same Acumatica AR dependency |
| Daily "**agent email**: here's your orders for the day"; avoid the "30 emails" storm | ⚠️ In-app avoids the storm; **digest + email parked** | needs digest engine + Microsoft Graph |
| "no order in **8 weeks** / no visit in **6 months** → alerts" | ⚠️ Audit-overdue ✅; **inactivity triggers not built** | buildable (orders partly Acumatica) |
| "alert: this **billing/contact info changed**" | ⛔ Not built | account-change trigger |
| Dealer-portal "**past due** … also notify internal" (dealer-facing copy) | ⛔ Not built | dealer-facing surface + Acumatica |
| "**free shipping** $3,000 … nudge at $2,750" | ⛔ Not built (P2) | dealer-portal nudge |
| Mobile push (TM field alerts) | ⛔ Parked | push-provider decision |

## 12. Gap-fix plan

**Sprint A — buildable now (zero external dependency):**
- **GAP-N1 — Routing-rules admin UI** (web). ✅ **DONE** (`2fb3d31`) — `/settings/notifications/routing` admin page (list / create / delete rules), linked from the preferences page for admins. CG's "determine who gets it" is now usable end-to-end without the raw API.
- **GAP-N2 — New in-app triggers from existing Pulse data:** CIS-received → "new account, call this person" (lead lifecycle stage transition); billing/contact-changed (account update hook); visit-inactivity (no training/visit in 6 months). Each = a small scanner/emit + `upsertUserNotification`. *(M each)*
- **GAP-N3 — Digest batching (in-app first)** (FR-NOTIF-008): reuse the `ReportSchedule` scan-worker pattern to roll low-urgency categories into a daily in-app digest now; the email send attaches later when Graph lands. *(M)*
- **GAP-N4 — Generalized quiet hours** (FR-NOTIF-007): lift the lead-only quiet-hours policy to all categories (suppress outbound when channels exist; in-app always recorded). *(M, lower value until channels)*

**Sprint B — unblock with one external decision each (each lights up several CG asks):**
- **GAP-N5 — Payment past-due (yellow) + credit-hold (red) alerts** (FR-NOTIF-013): once **Acumatica AR / credit-hold** data is available, add the trigger; the severity + routing framework is already built, so this is a scanner + mirror only. *(unblocks CG's payment/credit asks)*
- **GAP-N6 — Email delivery + daily order digest** (FR-NOTIF-009): once **Microsoft Graph creds** land, promote the existing PREVIEW delivery to live and add the daily order-digest schedule. *(unblocks the "agent email" + report digests; one cred unblocks lead/consignment/website/report email too)*
- **GAP-N7 — Order-inactivity alert** (8 weeks no order): build on Pulse `OrderDraft` now for the captured-intent signal; full order history needs Acumatica.

**Sprint C — provider/UX decisions:**
- **GAP-N8 — Mobile push** (FR-NOTIF-010): adopt Expo Notifications (FCM/APNs), device tokens, deep-link payloads for TM field alerts.
- **GAP-N9 — Dealer-facing payment self-service** (FR-NOTIF-012) + **free-shipping nudge**: dealer-portal surfaces with admin-editable copy; gate ordering at credit-hold.

**Highest-leverage unlocks for CG:** provisioning **Acumatica AR data** (GAP-N5) and **Microsoft Graph creds** (GAP-N6) — together they convert most of the ⚠️/⛔ rows in §11 to ✅, because the in-app framework (inbox, severity, routing, preferences) is already built and waiting.
