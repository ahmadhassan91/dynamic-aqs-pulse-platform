# Module Skills Index

Date: 2026-04-14

Focused local skills created for the main Pulse modules:

- `pulse-leads-module`
  - [/Users/clustox1/.codex/skills/pulse-leads-module/SKILL.md](/Users/clustox1/.codex/skills/pulse-leads-module/SKILL.md)
  - backbone journey from intake through first-order boundary
- `pulse-accounts-module`
  - [/Users/clustox1/.codex/skills/pulse-accounts-module/SKILL.md](/Users/clustox1/.codex/skills/pulse-accounts-module/SKILL.md)
  - customer core, contacts, locations, and lead-conversion outputs
- `pulse-territory-module`
  - [/Users/clustox1/.codex/skills/pulse-territory-module/SKILL.md](/Users/clustox1/.codex/skills/pulse-territory-module/SKILL.md)
  - assignment, ownership, visibility, overrides, and propagation
- `pulse-training-module`
  - [/Users/clustox1/.codex/skills/pulse-training-module/SKILL.md](/Users/clustox1/.codex/skills/pulse-training-module/SKILL.md)
  - catalog, certification, session execution, and mobile-safe training flows
- `pulse-user-admin-module`
  - [/Users/clustox1/.codex/skills/pulse-user-admin-module/SKILL.md](/Users/clustox1/.codex/skills/pulse-user-admin-module/SKILL.md)
  - internal user admin, auth/session restore, and admin workspace behavior
- `pulse-roles-permissions-module`
  - [/Users/clustox1/.codex/skills/pulse-roles-permissions-module/SKILL.md](/Users/clustox1/.codex/skills/pulse-roles-permissions-module/SKILL.md)
  - RBAC, route access, action permission checks, and dealer/internal separation

These sit alongside the broader cross-cutting skills already in use:

- foundation guardrails
- schema review
- regression quality gate
- backend quality gate
- frontend quality gate
- prototype de-mocking

Working rule:

- use the focused module skill when a slice is clearly inside one module boundary
- pair it with the cross-cutting quality skills when changing schema, APIs, UI wiring, or regressions
- prefer the module skill first, then add the quality gates needed for the slice
