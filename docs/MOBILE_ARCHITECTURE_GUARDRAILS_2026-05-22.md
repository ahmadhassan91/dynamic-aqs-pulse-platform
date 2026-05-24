# Pulse Field Mobile Architecture Guardrails

Date: 2026-05-22

These rules keep the Expo mobile app scalable as the field app grows beyond the first working slices.

## Principles

- Keep route files thin. Screens in `apps/mobile/app/` should mostly compose UI, wire navigation, and call feature hooks.
- Put feature orchestration in hooks under `apps/mobile/src/hooks/`.
- Put reusable UI in `apps/mobile/src/components/`.
- Put transport-only API wrappers in `apps/mobile/src/lib/api.ts`.
- Put persistence adapters in `apps/mobile/src/lib/*-cache.ts`, `session-store.ts`, or `mobile-draft-queue.ts`.
- Keep contracts imported from `@pulse/contracts`; do not redefine backend payload shapes in screens.

## SOLID Mapping

| Principle | Mobile Rule |
| --- | --- |
| SRP | A screen renders a flow; a hook owns data orchestration; a lib owns API/storage mechanics. |
| OCP | Extend features by adding hooks/components instead of rewriting shared API/session/draft internals. |
| ISP | Keep hooks narrow: `useFieldData`, `useMobileAssets`, and draft helpers expose only what their screen needs. |
| DIP | Screens depend on hooks and contract types, not raw fetch, SecureStore, or backend route strings. |

## Current Examples

- `useFieldData` centralizes dashboard CRM pulls and section-level partial failure behavior.
- `useMobileAssets` centralizes asset search, cache fallback, and share-link creation.
- `useTrainingExecution` centralizes formal training session load/check-in/proof/complete orchestration so the Training screen stays presentation-focused.
- `useConsignmentRoseAudit` centralizes ROSE site selection, evidence capture/upload, line-count variance, attestation, CRM submit, and offline draft fallback.
- `mobile-draft-queue` owns offline draft persistence, retry classification, and conflict status.
- `asset-cache` owns asset metadata cache behavior and keeps binary offline file caching explicitly out of scope.

## Non-Negotiables

- Do not store media bytes, base64 payloads, local file URIs, or storage keys in offline drafts.
- Do not show "draft saved" until native durable storage has been awaited by the draft adapter.
- Do not use SecureStore as a broad cache or database. Keep cached asset metadata lean, and park binary/large offline caches until the storage adapter is approved.
- Do not add provider-specific route optimization, push, deep-link, or Acumatica behavior without a signed dependency decision.
- Do not let mobile screens directly construct many backend routes; add typed API wrappers first.
- Do not count parked dependencies as complete in QA or progress tracker language.

## Next Architecture Improvements

- Extract ROSE visual sections into shared components only if another mobile screen needs the same count/evidence/attestation UI.
- Add lightweight hook tests around draft retry classification and asset cache fallback.
- Introduce a feature-folder convention only when the current `hooks/components/lib` split becomes too crowded.
