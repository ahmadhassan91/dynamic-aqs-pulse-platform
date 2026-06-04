# UX-04 Slice F - Mobile Unified Next Action Implementation

Date: 2026-06-01

## Purpose

Dynamic AQS repeatedly asked for the system to stay simple and field-friendly. Mobile should not make TMs/RDs decide between separate Today, Notifications, Sync, Route, ROSE, and Lead priority rules. This slice adds one ranked field-day action model and lets the main mobile surfaces consume it.

## Implemented

- Added `apps/mobile/src/lib/mobile-next-action.ts` as a pure policy layer.
- Added `apps/mobile/src/components/mobile-next-action-card.tsx` as the shared action surface.
- Replaced Today's static `Next move` route CTA with the model-driven `Start here` card.
- Replaced Notifications' hand-built alert stack with the same primary action plus secondary ranked signals.
- Replaced Sync Status' independent `What should I do now?` card with the same shared top action, while keeping detailed draft review/retry controls below.
- Updated the mobile tab header badge to use the shared alert model instead of only counting unsynced drafts.
- Centralized mobile field-data and next-action composition in `apps/mobile/src/hooks/use-mobile-next-actions.ts` so Today, Notifications, Sync Status, and the header badge use the same 20-item fetch window.
- Moved the shared field-data and next-action composition into `MobileNextActionProvider`, mounted only after authenticated session hydration, so Today, Notifications, Sync Status, and the mobile header no longer trigger independent duplicate fetch batches.
- Hardened mobile field-data refresh with stale-request invalidation and sign-out clearing so old CRM data cannot linger after auth/API context changes.
- Converted mobile Training execution into a five-step flow: check in, details, proof, follow-up, submit.
- Converted mobile ROSE execution into a five-step flow: counts, notes, evidence, attestation, submit.
- Hardened Training completion so duplicate taps cannot submit twice and completed sessions leave the active mobile queue.
- Hardened ROSE audit execution with latest-request guards, whole-number count validation, variance evidence gating, and idempotent backend variance work-item/discrepancy creation.
- Renamed the mobile "More" tab route from `/assets` to `/more` to avoid Expo/Metro's static asset route collision while keeping asset sharing inside the More screen.
- Split native stored session payloads across small SecureStore chunks so the app no longer relies on a single over-2 KB encrypted value; legacy single-key sessions are still readable.
- Added `apps/mobile/test/mobile-next-action.test.ts` to pin ranking, badge count, and honest sync-review behavior.

## Ranking Rules

1. Checked-in route visit saved on the phone.
2. Phone-sync blockers: storage not ready, sign-in required, office review/conflict.
3. Urgent lead workflow items.
4. Lead SLA risk.
5. Due training count when supplied by a live source.
6. Due ROSE audit.
7. Open consignment work/discrepancy items.
8. Voice-note review count when supplied by a live source.
9. Generic phone-saved updates ready for retry.
10. Clean fallback: open Route and continue field work.

## Dependency Boundaries Preserved

- Training and voice-note ranking inputs are optional and only used when a live count is supplied; the current shared field-data hook does not pretend those are already globally fetched.
- Sync copy still says manual retry; it does not claim background sync, push/deep links, conflict merging, route optimization, or offline media/file cache.
- ROSE copy says inventory context may need manual verification; it does not claim Acumatica inventory truth or Acumatica save completion.

## Validation

- `pnpm --filter @pulse/mobile test` passed: 41/41.
- `pnpm --filter @pulse/mobile typecheck` passed.
- `pnpm --filter @pulse/mobile lint` passed.
- `pnpm --filter @pulse/mobile build` passed.
- `pnpm --filter @pulse/api test:consignment` passed: service tests 2/2 and regression tests 13/13.
- `git diff --check` passed.
- Local UAT stack health passed at `http://127.0.0.1:8111/api/v1/health/live` and `/api/v1/health/ready`; Acumatica remains parked with the expected 503 external-dependency health result.
- Dependency-free UAT seed passed: `pnpm seed:uat`.
- Playwright rendered QA passed on Expo web at phone viewport for login, Today, Notifications, Sync Status, Route, Consignment, Training, and More: screenshots in `output/mobile-render-qa-2026-06-01/01-login.png` through `09-more.png`.
- Expo/iOS simulator rendered proof captured for Today, More, and Consignment: `output/mobile-render-qa-2026-06-01/10-ios-today-rendered.png`, `15-ios-more-rendered.png`, and `16-ios-consignment-rendered.png`.
- Native simulator QA exposed the SecureStore value-size warning; the follow-up chunked session-store fix passed mobile typecheck, test, and web export again.
- Provider-level next-action fetch cleanup passed `pnpm --filter @pulse/mobile typecheck` and `pnpm --filter @pulse/mobile test` with 41/41 mobile tests.

## Still Pending

- Native simulator deep-link screenshots were captured for Today, More, and Consignment; a fuller manual native pass for Notifications, Sync Status, Route, Training, and Voice Notes can be added when we do the next mobile QA cycle.
- True background sync, conflict merge, push/deep links, large offline media cache, route optimization, and Acumatica inventory/PO execution remain parked until dependencies and rules are confirmed.
