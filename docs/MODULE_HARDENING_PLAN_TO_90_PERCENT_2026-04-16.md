# Module Hardening Plan To 90 Percent

Date: 2026-04-16

## Why this plan exists

The current product is well past prototype stage in several areas, but the meetings and shared artifacts show that a few modules still have meaningful operational gaps. The goal of this plan is to keep us focused on the modules Dynamic AQS cares most about before we move on to new areas.

Modules covered here:
- foundation / auth / users / roles / permissions
- lead management
- territory management
- training
- calendar

## Current readiness estimate

These are implementation-side estimates after re-reading PRDs plus raw meeting artifacts.

| Module | Estimated readiness now | Why it is not at 90% yet |
| --- | ---: | --- |
| Foundation / Auth / Users / Permissions | 68% | Entra rollout is alpha-only, record-scope enforcement is incomplete, forgot/reset paths are not fully closed, and delegated/support access still drift in requirements |
| Lead Management | 84% | Native forms and import are strong, but generic dedupe, routing-basis closure, alert delivery, mobile capture, and training-backed onboarding evidence remain open |
| Territory Management | 76% | Kernel and map are real, but scope filters, note-authorship preservation, exception reporting, SGT precedence, and route-planning depth remain open |
| Training | 81% | Core scheduling/execution/certification exists, but reporting, participant depth, value-attribution tracking, and external-site coexistence are not yet complete |
| Calendar | 74% | Centralized calendar is real, but admin rollout settings, Outlook pilot closure, shared-calendar behavior, and visits/audits are not yet complete |

## Recommended hardening order

### 1. Foundation / Auth / Users / Permissions

This should stay first because every other module depends on it.

Target hardening slices:
1. Admin-managed Entra group mapping and better access-denial diagnostics
2. Record-scope visibility kernel
3. Field-level masking / entitlement shaping
4. Failed-login and denied-access audit events
5. Final internal forgot/reset password posture
6. Dealer password lifecycle hardening
7. Delegated admin and expiring support access

90% exit criteria:
- Entra rollout can be governed without env-only mappings
- role/module/action/record scope all align
- internal and dealer auth paths are intentionally separated and documented
- reset/forgot posture is explicit and implemented
- failed auth events are auditable

### 2. Lead Management

Lead is already the strongest domain module. The remaining work is mainly governance and operational hardening.

Target hardening slices:
1. Shared dedupe kernel across website/manual/import/customer contexts
2. Merge/update governance for imports
3. Native-form rollout governance and verified domain/origin checks
4. Real outbound alert delivery
5. Routing-basis and SGT/TM split decision closure
6. Training-backed onboarding evidence
7. Mobile capture/OCR path

90% exit criteria:
- Dynamic can trust web/manual/import lead intake in production
- duplicate decisions are governed and repeatable
- readiness reflects real downstream evidence
- routing and ownership defaults are decision-closed

### 3. Calendar

Calendar is now central enough that it should be hardened before we leave these modules.

Target hardening slices:
1. Finish Admin -> Integrations -> Calendar settings
2. Close regression coverage for role-aware scheduler and Outlook rollout
3. Pilot Outlook with 1-3 internal users
4. Add visits/audits as live event families
5. Finalize shared-calendar and meeting-provider behavior

90% exit criteria:
- centralized calendar is the trusted view for discovery/training/visits/audits
- admins can control rollout safely
- Outlook is pilot-valid and no longer “alpha in spirit”
- scheduling from calendar is dependable and governed

### 4. Territory Management

Territory should follow once foundation, leads, and calendar are more governed, because it depends heavily on visibility and ownership rules.

Target hardening slices:
1. Record-scope territory visibility
2. Strategic Growth / National TM precedence closure
3. Note authorship preservation during reassignment
4. Map/account summary enrichment
5. Territory exception and workload reporting
6. Route-planning refinement

90% exit criteria:
- TMs, RDs, admins, and support see the right territory data
- ownership transfer does not corrupt history
- map is genuinely useful for field planning
- Dynamic’s current shipping/TM model is reflected cleanly

### 5. Training

Training is further along than territory in core workflow, but still needs operational and reporting depth.

Target hardening slices:
1. D0 reporting and no-contact/no-training exception views
2. Rich participant/technician roster model
3. Certification expiry/renewal/printable support
4. Training-adjacent giveaway/value-delivered tracking
5. External training-site coexistence/import policy
6. Mobile UI parity later

90% exit criteria:
- Dynamic can schedule, execute, report, and certify training confidently
- training history is trustworthy enough for leadership and customer-value conversations
- certification and cadence management are no longer partially manual

## Cross-module dependencies to keep explicit

- Foundation gating:
  - record-scope visibility
  - field masking
  - Entra/role governance
- Provider gating:
  - Outlook pilot validation
  - Teams/WebEx policy decision
- Decision gating:
  - SGT versus TM precedence
  - internal forgot/reset posture
  - support/read-only expiry model
  - route-planning provider boundary

## Recommended immediate execution order

1. Finish current calendar/admin integration slice and regression-close it
2. Write/approve final foundation-auth hardening decisions
3. Implement record-scope visibility kernel
4. Harden lead dedupe + onboarding evidence
5. Harden calendar source families and Outlook pilot behavior
6. Harden territory reporting and authorship preservation
7. Harden training reporting, participant depth, and certification ops

## Bottom line

If we keep this order, we can realistically push these modules into the 85% to 90% range without pretending blocked items are complete. The biggest trap now would be moving to fresh modules while visibility, auth governance, dedupe, and reporting are still loose in the current ones.
