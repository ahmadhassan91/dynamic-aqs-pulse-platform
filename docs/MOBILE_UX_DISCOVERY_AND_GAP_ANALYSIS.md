# Pulse Mobile: Premium-Grade Discovery & Gap Analysis

*Synthesis of three discovery inputs — client meeting transcripts, mobile code audit (`apps/mobile`), and field-CRM mobile UX research. Produced 2026-06-09. Target: bring the mobile app to the web app's recently-upgraded premium bar and fully replace MapMyCustomers.*

> **Headline finding (verified against the live repo).** There is **no map library installed at all** (`react-native-maps` / MapLibre / Mapbox all absent). The MapMyCustomers replacement — the single most-cited client requirement — is **not partially built, it is unbuilt.** Also verified: `userInterfaceStyle:"light"` only (no dark mode), zero `FlatList`/`FlashList` (no list virtualization), zero `NetInfo` (no auto-sync), the training tab is a 39-byte stub, and the offline draft queue *tracks* a `conflict` status but has **no resolution UI**.

---

## A) What the client said about MapMyCustomers

### Likes / relies on (must preserve)
- **Color-coded map is the daily driver.** "Dark green is sold account, light green is active lead, blue is members list, purple is onboarding." (Don Hearn, Session 10). Pins carry current-year YTD, last-year YTD, last order date.
- **Filterable route planning.** "When you're building your routes... it'll just show sold accounts, it'll just show active leads, membership." (Don, Session 10).

### Dislikes / pain points (must beat)
- **Voice-to-text is inaccurate.** "It's not always the most accurate... you reference it a week later, you're like, Oh, what does that say?" (Session 5).
- **Route builder loses the colors.** "It takes you to a route page but then it doesn't give you the same color code. You have to... click on each one... it's annoying." (Don, Session 10).
- **Sync is unreliable → Friday manual reconciliation.** "Right now they ask his guys every Friday to go into the CRM and make sure that the stuff they put in map my customer got pushed into the CRM correctly." — "100%." (Currie/Don, Session 10).
- **Training never syncs as structured data** — only a generic "note." Zero structured training records in the CRM as a result.
- **Not available to the office (BD).** Michelle Hogan: "For those of us in the office, it would be very helpful... see if we had a big account next to a tiny account." (Session 1).

### Must-replicate-or-improve (non-negotiables)
1. Color-coded map (5 statuses) + **colors persist into the route editor** (the explicit MMC complaint to fix).
2. YTD + last-order-date on pins.
3. One-tap status filters ("prospects only / sold only / audits due").
4. **Accurate** voice-to-text producing **structured** activity records (not note blobs).
5. **Full offline**, auto-sync on reconnect — eliminating the Friday check entirely.
6. Digital ROSE consignment audit form with variance auto-calc + optional signature.
7. Bidirectional Outlook calendar sync; iPad support.
8. Enforced check-in/check-out: "They shouldn't be allowed to do anything else until they check out." (Currie, Session 10).

**Strategic driver:** consolidate ~$3–5K/yr MMC (plus HubSpot, Dropbox) into Pulse. "This is gonna change how the guys do business out there on the field." (Currie).

---

## B) Mobile UI/UX gaps (deduped, prioritized, evidence-tied)

### P0 — blocks the premium bar / blocks the client's core ask
| # | Gap | Evidence (verified) |
|---|-----|----------|
| P0-1 | **No map at all.** The flagship MMC replacement (color pins, YTD/last-order, status filters, route colors) does not exist. | No map lib in `package.json`/source. |
| P0-2 | **No offline conflict-resolution UI.** Queue *tracks* `conflict` (409/412/423) but offers no merge/keep/discard path. | `mobile-draft-queue.ts`; `sync-status-content.tsx` `<ConflictGuidance>` placeholder only. High-value ROSE audits can stall silently. |
| P0-3 | **No list virtualization.** All lists are `ScrollView` + `.map()`; 50+ items degrade. | Zero `FlatList`/`FlashList`. `leads.tsx`, `accounts.tsx`, `consignment.tsx`. |
| P0-4 | **No dark mode / outdoor high-contrast.** | `app.json` `userInterfaceStyle:"light"`; no `useColorScheme`/`Appearance`. Functional, not cosmetic, for a sunlight field app. |
| P0-5 | **No accessibility names + no Dynamic Type.** Only the notification bell has `accessibilityLabel`; type is fixed px. | `(tabs)/_layout.tsx`; `theme.ts` fixed `fontSize`. |

### P1 — should land before field rollout
| # | Gap | Evidence |
|---|-----|----------|
| P1-1 | **No auto-sync / background retry / offline indicator.** Retry is a manual button; no `NetInfo`. | `sync-status-content.tsx` manual retry. The Friday-reconciliation killer is unmet without auto-retry-on-reconnect. |
| P1-2 | **No optimistic UI** on check-in/ROSE submit; blocks on slow networks. | `route.tsx`, `consignment.tsx`. |
| P1-3 | **No deep links** for push → record. Client wants "deep link → that customer account." | No `linking` config. |
| P1-4 | **Training execution is a stub.** | `(tabs)/training.tsx` = 39 bytes; `app/training.tsx` 21KB unrouted. |
| P1-5 | **Thumb-zone ergonomics** — deep forms inline in a top-anchored ScrollView, not bottom sheets/FAB. | `consignment.tsx`, `lead/[id].tsx`. |
| P1-6 | **Weak empty/loading/error states** (no skeletons). | `leads.tsx`, `consignment.tsx`. |

### P2 — polish & field resilience
44pt touch targets on inline text buttons; WCAG contrast + icon-not-color-alone on status pills; live form validation; consistent success/error haptics; keyboard type/return-key tuning; pull-to-refresh; iPad split-view; UTC timestamp verification; iOS swipe-back.

---

## C) Premium-mobile recommendations
*Format: change → (client need) + (industry pattern) + (gap closed).*

1. **Map-first home:** `react-native-maps`/MapLibre + clustering + custom color+icon markers, `@gorhom/bottom-sheet` for detail/filters. → must-replicate 1–3 · map-first pattern · **P0-1**.
2. **Route editor with the SAME color/icon markers**, optimized by due-date/priority. → the explicit "annoying" MMC complaint · Badger-style routing · **P0-1**.
3. **Conflict-resolution sheet** (server vs local → keep-mine/keep-server/discard) + per-record sync badges. → kill the Friday check; never lose a ROSE count · Salesforce Briefcase visible-sync · **P0-2**.
4. **All lists → `FlashList`/`FlatList`** + pagination + result counts. → scan large territories · **P0-3**.
5. **Dark mode + true high-contrast tokens** (AAA for counts/prices), redundant color+icon encoding. → outdoor/in-car/sunlight · **P0-4**.
6. **Accessibility names on every Pressable/TextInput + Dynamic Type.** → web parity · WCAG AA · **P0-5**.
7. **`NetInfo` auto-retry-on-reconnect + persistent offline indicator.** → eliminate Friday reconciliation · queue + visible state · **P1-1**.
8. **Optimistic UI for check-in & ROSE submit.** → minimal-friction capture · <30s capture + optimistic updates · **P1-2**.
9. **Expo Linking deep-link map wired to push** (`pulsefield://lead/:id`, `/account/:id`, `/rose-audit/:siteId`). → "deep link → that customer account" · **P1-3**.
10. **Complete the training screen** (calendar + log-at-checkout + Outlook sync) or feature-flag off. → structured training (explicit MMC failure) · **P1-4**.
11. **Move ROSE/disposition/stage-change into bottom-sheet modals + FAB** for primary check-in. → one-handed in cars · tab bar + bottom sheet + FAB · **P1-5**.
12. **Capture-speed kit:** tap-to-increment counters, "same as last visit" defaults, accurate speech→structured fields, live validation, haptics. → beat MMC voice-to-text · sub-30s capture · **P1-6, P2**.

---

## D) Prioritized roadmap (highest client-value, lowest-risk first)
*Effort bands are rough order-of-magnitude for one experienced RN engineer; not commitments.*

### NOW — the headline ask + data-trust foundation (~6–9 wks)
- **Map-first home** + color/icon pins + status filters + YTD/last-order callouts (Rec 1). *~3–4 wks. Largest unknown — clustering perf needs a device spike first.*
- **Color-coded route editor** reusing markers (Rec 2). *~1–2 wks after map.*
- **Conflict-resolution UI + per-record sync badges** (Rec 3). *~1 wk; queue state already exists.*
- **`NetInfo` auto-retry + offline indicator** (Rec 7). *~3–5 days. Retires the Friday reconciliation.*
- **List virtualization** (Rec 4). *~3–5 days.*

### NEXT — premium polish parity + field ergonomics (~4–6 wks)
- Dark mode + outdoor high-contrast (Rec 5) *~1 wk*; Accessibility names + Dynamic Type (Rec 6) *~1 wk*; Optimistic check-in/ROSE (Rec 8) *~3–5 days*; Bottom-sheet forms + FAB (Rec 11) *~1 wk*; Deep links → push (Rec 9) *~3–5 days*; Capture-speed kit (Rec 12) *~1 wk*.

### LATER — close the open feature + final polish (~3–5 wks)
- Training execution + Outlook bidirectional sync (Rec 10). *Largest item; depends on Graph integration contract.*
- P2 polish: 44pt targets, pull-to-refresh, iPad split-view, UTC audit, swipe-back.

---

## Open decisions / where transcripts are silent (need a call before building)
- **Map library + route-optimizer API** (Google/Mapbox/Waze) — biggest estimate risk; needs a device spike before dates.
- **Offline conflict policy** — what happens when a TM edits offline while HQ edits online (merge vs. user-assisted, per record type). Undefined in transcripts.
- **Voice-to-text engine** — on-device vs. cloud (offline implications); accuracy threshold/language scope unspecified.
- **Signature, audit-form versioning, Outlook "related-event" scope, TM/RD/BD permission matrix** — all unresolved; flag for the next discovery pass.
- **iPad** is a stated must-have but untested (`supportsTablet:true` declared, no responsive layout).
