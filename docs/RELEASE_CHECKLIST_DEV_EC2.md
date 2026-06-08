# Manual Dev EC2 Release Checklist & Smoke

Repeatable proof for each **manual** release to the dev EC2 host. Because dev deploys are
manual (no automatic deploy-on-merge), every release must produce the **same** evidence.

Deploy pipeline: `.github/workflows/deploy-dev-ec2.yml` (trigger: push to `dev`, or
`workflow_dispatch`). It builds `@pulse/{contracts,config,db,api,crm-web}` and rsync+SSH
deploys to the dev EC2 instance. Host: `https://pulse-crm.theclustox.com`.

---

## 0. When to deploy (decision gate)

Deploy to EC2 **only** when at least one is true:
- Runtime **app/API behavior** changed (anything under `apps/api/src`, `apps/crm-web/src`, `apps/mobile`, or `packages/*/src` that ships at runtime).
- **Deploy scripts / env / runtime config** changed (`.github/workflows/deploy-dev-ec2.yml`, server env, infra).
- A **public smoke proof** is explicitly needed.

Do **NOT** deploy for pure **test / CI-infra** changes (test files, `*.test.*`, coverage
config, CI workflows, this checklist). For those: commit + push + prove via CI/local and stop.

---

## 1. Pre-release gates (must be green before deploying)

Run from repo root.

```bash
# Type safety across the workspace
node_modules/.bin/tsc --noEmit -p packages/contracts/tsconfig.json
node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json
node_modules/.bin/tsc --noEmit -p apps/crm-web/tsconfig.json
node_modules/.bin/tsc --noEmit -p apps/mobile/tsconfig.json

# API regression suite + coverage ratchet (the authoritative gate; mirrors CI test-pr.yml)
pnpm --filter @pulse/api test          # 306+ tests, must be 0 fail; coverage >= 70/55/80

# Contracts compile-time type assertions
pnpm --filter @pulse/contracts test

# Cheap crm-web checks (no running stack required)
pnpm --filter @pulse/crm-web test:unit            # prototype-parity (node:test)
pnpm --filter @pulse/crm-web test:route-coverage  # every app route has coverage or a live waiver

# Heavier crm-web e2e (require a built + seeded stack; run when web/UI behavior changed)
pnpm --filter @pulse/crm-web test:e2e             # primary flows
pnpm --filter @pulse/crm-web test:ux-clutter:quick
# pnpm --filter @pulse/crm-web test:ux-depth      # depth budgets (optional)
# pnpm --filter @pulse/crm-web test:ux-visual     # visual budgets (optional)
```

CI mirror: opening/updating a PR runs `.github/workflows/test-pr.yml` (API suite + Postgres +
Node 24). A PR must be green before the release is cut.

---

## 2. Deploy

1. Confirm section 0 says "deploy" and section 1 is green.
2. Merge/push the release commit to `dev` (or run the `Deploy dev EC2` workflow via
   `workflow_dispatch`).
3. Watch the GitHub Actions run to completion (build + rsync + restart).

---

## 3. Post-deploy smoke (record the output each time)

```bash
HOST=https://pulse-crm.theclustox.com

# API liveness / readiness / dependencies
curl -fsS "$HOST/api/v1/health/live"     # expect {"status":"ok"}
curl -fsS "$HOST/api/v1/health/ready"    # expect {"status":"ok"} (not "degraded")
curl -fsS "$HOST/api/v1/health/db"       # DB connectivity
curl -fsS "$HOST/api/v1/health/queue"    # pg-boss queue
```

Manual UI smoke (log in as an internal admin):
- [ ] CRM login succeeds; dashboard renders.
- [ ] Leads workbench loads; open a lead; log an activity note (UX-L-010 write path).
- [ ] Accounts list loads and paginates.
- [ ] Calendar workbench renders.
- [ ] Admin → Users loads.

Acumatica remains **parked** — do not smoke pricing/inventory/live-sync paths.

---

## 4. Rollback

If smoke fails: re-run the `Deploy dev EC2` workflow pinned to the previous green commit
(`workflow_dispatch` with the prior SHA), then re-run section 3. Capture the failing health
output / screenshot in the release notes.

---

## 5. Evidence to capture per release

- Pre-release gate output (API suite pass count + coverage line, contracts/tsc green).
- GitHub Actions deploy run URL.
- Section 3 health responses + UI smoke checkboxes.
- Deploy decision (section 0) and the SHA released.
