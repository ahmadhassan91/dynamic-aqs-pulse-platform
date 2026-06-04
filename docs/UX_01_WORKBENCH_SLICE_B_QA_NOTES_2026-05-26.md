# UX-01 Workbench Slice B Mobile QA Notes

Date: 2026-05-26

Scope: Mobile + QA only.

## Tab Compression Check

The mobile tab bar stays compressed to:

- `Today`
- `Route`
- `More`

Hidden tab screens remain registered in the Expo tab layout with `href: null`, so they are not shown in the bottom bar but can still be opened from action buttons.

## Reachability Matrix

| Flow | Entry Point After Compression | Route |
| --- | --- | --- |
| Lead inbox | `Today` footer action, `More` work queues, notifications | `/(tabs)/leads` |
| Account list | `Today` footer action, `More` work queues | `/(tabs)/accounts` |
| Route plan and CRM-backed visits | Bottom tab, `Today` start action | `/(tabs)/route` |
| Sync status and offline drafts | Header bell, `Today` sync action, `More` capture/review | `/sync-status` |
| OCR business card preview | `Today` start action, `More` capture/review | `/ocr-capture` |
| Voice notes | `Today` start action, `More` capture/review | `./voice-notes` hidden tab route |
| ROSE audits / consignment | `Today` start action, `More` work queues, notifications | `/(tabs)/consignment` |
| Formal training execution | `Today` start action, `More` work queues, notifications/account context | `/training` |
| Asset library and customer share links | Bottom `More` tab | `/(tabs)/assets` |
| Notifications | Header bell and Today bell | `/notifications` |

## UX Refinements

- Renamed the Today metric from `Consign` to `ROSE` to match the field audit vocabulary.
- Renamed `Voice note` to `Voice notes` on Today so the action matches the screen title.
- Replaced future-looking account copy with route/account action copy.
- Replaced More-screen tab-bar meta copy with field-task copy.
- Kept hidden-module access explicit in More through capture/review and work-queue groups.

## Pulse Frontend Quality Gate

Prototype surfaces preserved:

- Field-first Today screen remains the default operator surface.
- Route remains a primary tab.
- More acts as the compressed hub for less frequent capture, queue, sync, and asset work.
- Sync truth remains visible through the header bell, Today action, More action, and notifications.

Backend-wired surfaces verified:

- This slice did not add new backend calls.
- Existing routes continue to point at the implemented live/mobile flows for leads, accounts, route visits, ROSE audits, training, voice notes, OCR preview, sync status, and assets.

Remaining non-dependent gaps:

- Browser/device smoke was not rerun in this slice; validation was static route reachability plus mobile TypeScript checks.
- Native Android emulator QA remains parked per the mobile foundation notes.

UI that should be removed instead of shipped:

- None found in the scoped mobile files.

## Verification

- `pnpm --filter @pulse/mobile typecheck`
- `pnpm --filter @pulse/mobile lint`
