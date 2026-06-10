import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootDir = path.resolve(e2eDir, '../../..');
const appDir = path.join(repoRootDir, 'apps', 'crm-web', 'src', 'app');
const outputDir = path.join(repoRootDir, 'output', 'playwright', 'ux-03-route-coverage');
// Dynamic "today" so waiver-expiry checks actually catch stale waivers
// (previously hard-coded, which let expired waivers pass silently).
const todayIso = new Date().toISOString().slice(0, 10);

const routeInventory = [
  visual('/admin', 'Admin dashboard default workbench'),
  waived('/admin/activity', 'admin-task', 'Audit and activity monitor is an admin task surface, not a default workbench.', 'Admin', '2026-07-15', ['functional-e2e-pending']),
  visual('/admin/catalog-rules', 'Dealer catalog rules Draft -> Preview -> Publish wizard'),
  waived('/admin/integrations', 'parked-dependency', 'Provider and integration setup stays parked from default work until external access is ready.', 'Admin Integrations', '2026-07-15', ['functional-e2e-pending']),
  waived('/admin/lead-capture', 'admin-alias', 'Alias-style lead capture admin surface; canonical website-form behavior is covered under leads.', 'Lead Capture', '2026-06-30', ['functional-e2e']),
  waived('/admin/roles', 'admin-task', 'Access profile behavior route is covered functionally; visual standardization follows Slice C.', 'Admin', '2026-06-30', ['functional-e2e']),
  visual('/admin/users', 'Admin user management workbench'),
  waived('/auth/entra/callback', 'auth-public', 'OAuth callback is a transient redirect state, not a workbench route.', 'Platform Auth', '2026-06-30', ['auth-flow']),
  waived('/auth/forgot-password', 'auth-public', 'Public password recovery utility route, not workbench budgeted.', 'Platform Auth', '2026-06-30', ['auth-flow']),
  waived('/auth/login', 'auth-public', 'Login helper route is covered by functional auth flow, not workbench budgeted.', 'Platform Auth', '2026-06-30', ['functional-e2e']),
  waived('/auth/reset-password', 'auth-public', 'Tokenized password recovery route, not workbench budgeted.', 'Platform Auth', '2026-06-30', ['auth-flow']),
  visual('/calendar', 'Calendar default workbench'),
  waived('/cis/:token', 'token-public', 'Legacy CIS alias must remain covered as a public token route until retired or merged.', 'CIS Owner', '2026-06-30', ['token-public']),
  visual('/consignment', 'Consignment default workbench'),
  waived('/consignment/:siteId', 'detail-route', 'Consignment site detail is covered functionally and by depth checks; visual promotion can follow after role UAT on the compact current-site-work model.', 'Consignment Ops', '2026-07-15', ['functional-e2e', 'depth-e2e']),
  visual('/customers', 'Accounts default workbench'),
  waived('/customers/:id', 'detail-route', 'Account detail density is deferred to UX-03 Slice C detail rail standardization.', 'Accounts', '2026-07-15', ['functional-e2e']),
  waived('/customers/field-activity', 'task-route', 'Field review subflow is a task route; visual work follows Slice C account cleanup.', 'Accounts + Field Ops', '2026-07-15', ['functional-e2e-pending']),
  waived('/dealer', 'dealer-public', 'Dealer landing performs auth-aware redirect and is not a workbench route.', 'Dealer Portal', '2026-06-30', ['redirect']),
  waived('/dealer/accept-invite', 'dealer-public', 'Tokenized invite activation route, not a default dealer workbench.', 'Dealer Portal', '2026-06-30', ['auth-flow']),
  visual('/dealer/account', 'Dealer account center default workbench'),
  visual('/dealer/catalog', 'Dealer products and files default workbench'),
  waived('/dealer/catalog/:presentationId', 'dealer-detail', 'Dealer product detail route is covered as a deep-link detail surface in Slice C.', 'Dealer Portal + Product', '2026-07-15', ['functional-e2e-pending']),
  visual('/dealer/dashboard', 'Dealer Start Here default workbench'),
  waived('/dealer/login', 'dealer-public', 'Dealer auth entry is covered by functional login flow, not workbench budgeted.', 'Dealer Portal', '2026-06-30', ['functional-e2e']),
  visual('/digital-assets', 'Digital assets default workbench'),
  waived('/forms/lead/:siteId', 'token-public', 'Public website lead form is a token route and not part of internal workbench budgets.', 'Lead Capture', '2026-06-30', ['functional-e2e']),
  waived('/', 'redirect', 'Auth-aware workspace redirect, not a rendered workbench route.', 'Platform Auth', '2026-06-30', ['redirect']),
  visual('/leads', 'Lead Work Queue default workbench'),
  waived('/leads/:id', 'detail-route', 'Lead detail behavior is covered by UX-07 action-first depth checks; full visual route promotion waits for the remaining intake/detail cleanup.', 'Leads', '2026-07-15', ['functional-e2e', 'depth-e2e', 'ux-05-clutter-critical']),
  waived('/leads/activities', 'task-route', 'Workflow queue subroute is covered functionally and will inherit table cleanup in Slice C.', 'Leads', '2026-07-15', ['functional-e2e-pending']),
  waived('/leads/analytics', 'report-route', 'Lead Insights is a report surface, not a default workbench route.', 'Leads', '2026-07-15', ['report-waiver']),
  waived('/leads/finance', 'task-route', 'Permissioned finance queue route; UI cleanup follows finance queue standardization.', 'Finance + Leads', '2026-07-15', ['functional-e2e-pending']),
  waived('/leads/forms', 'task-route', 'Website form admin behavior is covered functionally; visual cleanup follows Slice C.', 'Lead Capture', '2026-06-30', ['functional-e2e']),
  waived('/leads/import', 'advanced-route', 'Advanced import and migration surface stays outside default workbench budget.', 'Leads', '2026-07-15', ['advanced-waiver']),
  visual('/product-management', 'Product publish-readiness default workbench'),
  waived('/product-management/products/:productId', 'detail-route', 'Product detail is covered by depth checks; visual waiver remains for dense file, readiness, and dealer visibility detail rail work.', 'Product + Marketing', '2026-07-15', ['visual-captured-waived', 'depth-e2e']),
  waived('/public/cis/:token', 'token-public', 'Public CIS package flow is a token route, not an internal workbench.', 'CIS Owner', '2026-06-30', ['functional-e2e']),
  waived('/reports', 'report-route', 'Reports workspace is a saved-report surface; visual-budget promotion follows reporting UAT.', 'Reports', '2026-07-15', ['report-waiver']),
  waived('/settings/lead-capture', 'redirect', 'Legacy settings route redirects to the admin lead-capture surface.', 'Platform', '2026-06-30', ['redirect']),
  visual('/territories', 'Territory default workbench'),
  visual('/territory_map', 'Territory map default workbench'),
  visual('/training', 'Training default workbench'),
];

test.beforeAll(async () => {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
});

test('every app route has UX-03 coverage or a waiver', async () => {
  const actualRoutes = await discoverRoutes();
  const actualRouteSet = new Set(actualRoutes.map((entry) => entry.route));
  const inventoryRouteSet = new Set(routeInventory.map((entry) => entry.route));

  const missing = actualRoutes
    .filter((entry) => !inventoryRouteSet.has(entry.route))
    .map((entry) => `${entry.route} (${entry.pageFile})`);
  const stale = routeInventory
    .filter((entry) => !actualRouteSet.has(entry.route))
    .map((entry) => entry.route);

  expect.soft(missing, 'Routes missing from UX-03 inventory').toEqual([]);
  expect.soft(stale, 'Routes in UX-03 inventory that no longer exist').toEqual([]);

  for (const entry of routeInventory) {
    if (entry.visualBudget === 'enforced') {
      expect.soft(entry.coverage, `${entry.route} should list visual-budget coverage`).toContain('visual-budget');
      expect.soft(entry.waiver ?? null, `${entry.route} is visual-budgeted and should not carry a waiver`).toBeNull();
    } else {
      assertValidWaiver(entry);
    }
  }

  const routeByPath = new Map(actualRoutes.map((entry) => [entry.route, entry]));
  const report = routeInventory.map((entry) => ({
    ...entry,
    pageFile: routeByPath.get(entry.route)?.pageFile ?? null,
  }));

  await fs.writeFile(
    path.join(outputDir, 'route-inventory.json'),
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      routeCount: actualRoutes.length,
      visualBudgetRoutes: report.filter((entry) => entry.visualBudget === 'enforced').length,
      waivedRoutes: report.filter((entry) => entry.visualBudget !== 'enforced').length,
      routes: report,
    }, null, 2),
    'utf8',
  );
});

function visual(route, notes) {
  return {
    route,
    notes,
    visualBudget: 'enforced',
    coverage: ['visual-budget'],
  };
}

function waived(route, routeClass, reason, owner, expires, coverage = []) {
  return {
    route,
    routeClass,
    visualBudget: 'waived',
    coverage,
    waiver: {
      reason,
      owner,
      expires,
    },
  };
}

async function discoverRoutes() {
  const pageFiles = await listPageFiles(appDir);
  return pageFiles
    .map((pageFile) => ({
      route: toRoute(pageFile),
      pageFile: path.relative(repoRootDir, pageFile),
    }))
    .sort((left, right) => left.route.localeCompare(right.route));
}

async function listPageFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...await listPageFiles(entryPath));
    } else if (entry.name === 'page.tsx') {
      results.push(entryPath);
    }
  }

  return results;
}

function toRoute(pageFile) {
  const routePath = path.relative(appDir, pageFile).replace(/\/page\.tsx$/, '');
  if (!routePath || routePath === 'page.tsx') {
    return '/';
  }

  const normalized = routePath
    .split(path.sep)
    .filter((part) => part !== 'page.tsx')
    .map((part) => {
      const dynamicMatch = part.match(/^\[(.+)]$/);
      return dynamicMatch ? `:${dynamicMatch[1]}` : part;
    })
    .join('/');

  return `/${normalized}`;
}

function assertValidWaiver(entry) {
  const context = `${entry.route} waiver`;
  expect.soft(entry.waiver?.reason, `${context} must have a reason`).toEqual(expect.any(String));
  expect.soft(entry.waiver?.owner, `${context} must have an owner`).toEqual(expect.any(String));
  expect.soft(entry.waiver?.expires, `${context} must have an expiry`).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));

  if (entry.waiver?.expires) {
    expect.soft(
      entry.waiver.expires >= todayIso,
      `${context} expiry must not be before ${todayIso}`,
    ).toBe(true);
  }
}
