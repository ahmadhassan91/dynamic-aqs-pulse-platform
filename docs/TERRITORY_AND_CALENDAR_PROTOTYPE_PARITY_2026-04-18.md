# Territory And Calendar Prototype Parity

Date: 2026-04-18

## Shipped

- `/calendar` now uses a prototype-facing `CRM Calendar` shell while preserving the real live Pulse scheduler, real day/week/month/list views, real Outlook sync wiring, and the real centralized event detail path.
- `/territories` now uses the prototype tab language directly: `Dashboard`, `Map View`, `Territory List`, `Admin Config`, and `Calendar`.
- `Map View` now embeds the live territory map inside the territory workspace instead of showing only supporting summaries.
- Territory map coloring and shipping-hub markers now align to the approved Feb 2026 paper map style through live territory coverage, manager ownership, and shipping-center metadata instead of a generic palette.
- `Admin Config` now exposes prototype-style territory cards plus a state-assignment modal with assigned-state count, impacted-state summary, added states, removed states, and a live save path back into the real territory update APIs.
- A territory-local `Calendar` tab now embeds the same live Pulse calendar so territory operations can stay in the territory shell without forking schedule truth.

## Intentionally Kept Truthful

- No fake ERP revenue was added to territory cards.
- No fake audit-due counter was added just to match the mock.
- Territory editing remains state/province coverage based; polygon drawing and restructure workflows are still parked.
- The paper-map visual parity is driven by live territory data. If Dynamic changes TM or shipping ownership later, the live map can follow the data instead of staying frozen to the demo.

## Verification

- `node --experimental-strip-types --test apps/crm-web/test/prototype-parity.test.ts`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web build`
- `npx playwright test -c apps/crm-web/e2e/playwright.config.mjs`

## Parked Follow-Through

- prototype-style revenue/audit tiles until real authoritative data exists
- polygon/boundary editing and merge/split territory workflows
- route optimization and provider-backed field-routing depth
- deeper territory-local calendar filtering by territory owner once the scheduling model needs it
