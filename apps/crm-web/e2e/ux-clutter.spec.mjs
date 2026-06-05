import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootDir = path.resolve(e2eDir, '../../..');
const fixturePath = path.join(e2eDir, '.generated-fixtures.json');
const clutterOutputDir = path.join(repoRootDir, 'output', 'playwright', 'ux-05-clutter');
const criticalOnly = process.env.PULSE_UX_CLUTTER_SCOPE === 'critical';

const budgets = {
  default: {
    maxFirstViewportSections: 6,
    maxHeroBadges: 2,
    maxPrimaryButtons: 1,
    maxRepeatedEmptyStates: 1,
    maxScrollScreens: 3.5,
    maxSecondaryButtons: 3,
    maxTableColumns: 7,
    maxTabs: 5,
    maxTopLevelPanels: 10,
    maxVisibleBadges: 10,
    maxVisibleRowActions: 12,
    maxVisibleSections: 10,
    maxVisibleTables: 2,
    maxRowActionsPerRow: 1,
  },
  deep: {
    maxFirstViewportSections: 8,
    maxHeroBadges: 2,
    maxPrimaryButtons: 1,
    maxRepeatedEmptyStates: 2,
    maxScrollScreens: 5.5,
    maxSecondaryButtons: 4,
    maxTableColumns: 8,
    maxTabs: 6,
    maxTopLevelPanels: 14,
    maxVisibleBadges: 14,
    maxVisibleRowActions: 14,
    maxVisibleSections: 14,
    maxVisibleTables: 3,
    maxRowActionsPerRow: 2,
  },
  setup: {
    maxFirstViewportSections: 8,
    maxHeroBadges: 2,
    maxPrimaryButtons: 1,
    maxRepeatedEmptyStates: 2,
    maxScrollScreens: 5,
    maxSecondaryButtons: 4,
    maxTableColumns: 8,
    maxTabs: 6,
    maxTopLevelPanels: 12,
    maxVisibleBadges: 14,
    maxVisibleRowActions: 12,
    maxVisibleSections: 12,
    maxVisibleTables: 3,
    maxRowActionsPerRow: 2,
  },
};

test.beforeAll(async () => {
  await fs.rm(clutterOutputDir, { recursive: true, force: true });
  await fs.mkdir(clutterOutputDir, { recursive: true });
});

test('UX-05 clutter budgets capture deep CRM routes', async ({ page }) => {
  const fixtures = await readFixtures();
  const internalReport = [];

  await loginWithCredentials(page, fixtures.internalAuth.email, fixtures.internalAuth.password);

  const internalRoutes = [
    route('leads-default', '/leads', /Lead Work Queue/i, 'default', 'List-first lead work queue; board and report metrics stay secondary.', {
      critical: true,
      forbiddenTerms: ['Lead source mix', 'Routing distribution', 'Residential leads', 'Digital intake', 'Awaiting CIS', 'Ready first order'],
    }),
    route('lead-detail', `/leads/${fixtures.cis.leadId}`, new RegExp(escapeRegExp(fixtures.cis.companyName), 'i'), 'deep', 'Action-first lead detail; general data review stays behind Details.', {
      critical: true,
      forbiddenTerms: ['General Information'],
    }),
    route('accounts-default', '/customers', /Account Management/i, 'default', 'Needs follow-up default; All accounts behind mode.', {
      critical: true,
      forbiddenTerms: ['Account summary'],
    }),
    route('account-detail', `/customers/${fixtures.customer.accountId}`, new RegExp(escapeRegExp(fixtures.customer.displayName), 'i'), 'deep', 'Account focus primary tabs; readiness and related work behind More.', {
      critical: true,
      forbiddenTerms: ['Readiness, handoff, and parked dependencies', 'Activity & Document Review', 'Recent Account Activity', 'Provision Dealer Portal User', 'Payment Methods'],
    }),
    route('calendar-default', '/calendar', /CRM Calendar/i, 'default', 'No default event selection; Day health before Event detail.', {
      critical: true,
      forbiddenTerms: ['Event detail', 'Open linked record', 'More event details'],
    }),
    route('territory-default', '/territories', /Territory Management/i, 'default', 'Territory Action Queue default; performance, map, registry, and setup stay behind details or More.', {
      critical: true,
      forbiddenTerms: [
        'Lead routing posture',
        'Bulk customer transfer',
        'Bulk lead transfer',
        'Create region',
        'Create shipping hub',
        'Create shipping center',
        'Create territory',
        'Coverage review',
        'Edit territory coverage and ownership',
      ],
    }),
    route('territory-list', '/territories?tab=list', /Territory Management/i, 'setup', 'Territory registry and assignment gaps baseline.'),
    route('territory-admin', '/territories?tab=admin', /Territory Management/i, 'setup', 'Focused transfer queues and stepped setup baseline.'),
    route('training-default', '/training', /Training Workbench/i, 'default', 'Priority queue and setup/reporting duplication baseline.', { critical: true }),
    route('training-ops', '/training?tab=ops', /Training Workbench/i, 'setup', 'Training priority queue depth baseline.'),
    route('training-accounts', '/training?tab=accounts', /Training Workbench/i, 'setup', 'Training account coverage depth baseline.'),
    route('training-catalog', '/training?tab=catalog', /Training Workbench/i, 'setup', 'Training setup forms baseline before catalog setup wizard.'),
    route('consignment-default', '/consignment', /Consignment Workspace/i, 'default', 'Single work queue candidate baseline.', {
      critical: true,
      forbiddenTerms: ['Acumatica', 'ERP', 'inventory', 'PO', 'purchase order', 'manual variance', 'warehouse confirmation', 'warehouse setup waiting', 'approved handoff'],
    }),
    route('product-default', '/product-management', /Product Management/i, 'default', 'Products and dealer group baseline.', {
      critical: true,
      forbiddenTerms: ['Acumatica', 'Widen', 'pricing', 'price class', 'import', 'Preview source files', 'Source file review'],
    }),
    route('product-visibility', '/product-management?tab=visibility', /Product Management/i, 'setup', 'Dealer group selection should not auto-open publish detail.', {
      critical: true,
      forbiddenTerms: ['Selected', 'Products shown', 'Live version', 'Review before publish:'],
    }),
    route('product-detail', `/product-management/products/${fixtures.product.productId}`, new RegExp(escapeRegExp(fixtures.product.displayName), 'i'), 'deep', 'Product readiness board/detail density baseline.'),
    route('digital-assets-default', '/digital-assets', /Digital Assets/i, 'default', 'Fast share first candidate baseline.', { critical: true }),
    route('admin-default', '/admin', /System Administration/i, 'default', 'Users-first admin baseline.'),
    route('admin-business-rules', '/admin/catalog-rules', /Dealer Group Rules/i, 'setup', 'Dealer Group Rules wizard default-draft baseline.', { critical: true }),
  ].filter(includeRoute);

  if (fixtures.consignment?.siteId) {
    internalRoutes.push(route(
      'consignment-site-detail',
      `/consignment/${fixtures.consignment.siteId}`,
      new RegExp(escapeRegExp(fixtures.customer.displayName), 'i'),
      'deep',
      'Optional consignment site detail baseline when fixture data is present.',
      {
        forbiddenTerms: ['Acumatica', 'ERP', 'inventory', 'PO', 'purchase order', 'manual variance', 'warehouse confirmation', 'warehouse setup waiting', 'approved handoff'],
      },
    ));
  }

  for (const entry of internalRoutes) {
    internalReport.push(await captureClutterRoute(page, entry));
  }

  await writeReport('internal-clutter-report.json', internalReport);
  const summary = summarizeReports(internalReport);
  await writeReport('internal-summary.json', summary);

  expect.soft(summary.routeReadinessFailures, `Routes failed to render: ${formatFailures(summary.routeReadiness)}`).toBe(0);

  const leadDetail = internalReport.find((entry) => entry.slug === 'lead-detail');
  expect(leadDetail?.routeReady).toBe(true);
  expect(leadDetail?.heroBadges).toBeLessThanOrEqual(2);
  expect(leadDetail?.primaryButtons).toBeLessThanOrEqual(1);
  expect(leadDetail?.secondaryButtons).toBeLessThanOrEqual(3);
  expect(leadDetail?.tabs).toBeLessThanOrEqual(3);
  expect(leadDetail?.samples.buttons.some((sample) => (
    /\b(Park lead|Close lead|Reopen lead|Resume lead)\b/i.test(sample.label)
  ))).toBe(false);

  const adminRules = internalReport.find((entry) => entry.slug === 'admin-business-rules');
  expect(adminRules?.routeReady).toBe(true);
  expect(adminRules?.tableCount).toBeLessThanOrEqual(1);
  expect(adminRules?.primaryButtons).toBeLessThanOrEqual(1);
  expect(adminRules?.samples.visibleSections.some((sample) => (
    /\b(Sample Account Decisions|Affected products and files|Publish Rule Set)\b/i.test(sample.label)
  ))).toBe(false);

  const productDefault = internalReport.find((entry) => entry.slug === 'product-default');
  if (productDefault) {
    expect(productDefault.routeReady).toBe(true);
    expect(productDefault.copyFindings).toEqual([]);
    expect(productDefault.primaryButtons).toBeLessThanOrEqual(1);
    expect(productDefault.tabs).toBeLessThanOrEqual(2);
    expect(productDefault.samples.buttons.some((sample) => (
      /\b(Add Section|Add SKU Family|Preview source files|Open setup|Publish|Rollback)\b/i.test(sample.label)
    ))).toBe(false);
  }

  const digitalDefault = internalReport.find((entry) => entry.slug === 'digital-assets-default');
  expect(digitalDefault?.routeReady).toBe(true);
  expect(digitalDefault?.primaryButtons).toBeLessThanOrEqual(1);
  expect(digitalDefault?.tabs).toBeLessThanOrEqual(2);
  expect(digitalDefault?.samples.visibleSections.some((sample) => (
    /\b(Migration Review|Advanced Import|Source and migration trace|Product usage|File versions)\b/i.test(sample.label)
  ))).toBe(false);

  const trainingDefault = internalReport.find((entry) => entry.slug === 'training-default');
  expect(trainingDefault?.routeReady).toBe(true);
  expect(trainingDefault?.tableCount).toBeLessThanOrEqual(1);
  expect(trainingDefault?.primaryButtons).toBeLessThanOrEqual(1);
  expect(trainingDefault?.samples.visibleSections.some((sample) => (
    /\b(Current certified tracks|Session execution snapshot|Compliance reporting|Catalog Setup)\b/i.test(sample.label)
  ))).toBe(false);

  const territoryDefault = internalReport.find((entry) => entry.slug === 'territory-default');
  expect(territoryDefault?.routeReady).toBe(true);
  expect(territoryDefault?.tableCount).toBeLessThanOrEqual(1);
  expect(territoryDefault?.maxTableColumns).toBeLessThanOrEqual(5);
  expect(territoryDefault?.maxRowActionsPerRow).toBeLessThanOrEqual(1);
  expect(territoryDefault?.primaryButtons).toBeLessThanOrEqual(1);
  expect(territoryDefault?.copyFindings).toEqual([]);

  const consignmentDefault = internalReport.find((entry) => entry.slug === 'consignment-default');
  expect(consignmentDefault?.routeReady).toBe(true);
  expect(consignmentDefault?.tableCount).toBeLessThanOrEqual(1);
  expect(consignmentDefault?.maxTableColumns).toBeLessThanOrEqual(6);
  expect(consignmentDefault?.maxRowActionsPerRow).toBeLessThanOrEqual(1);
  expect(consignmentDefault?.primaryButtons).toBeLessThanOrEqual(1);
  expect(consignmentDefault?.secondaryButtons).toBeLessThanOrEqual(2);
  expect(consignmentDefault?.tabs).toBe(0);
  expect(consignmentDefault?.visibleSections).toBeLessThanOrEqual(2);
  expect(consignmentDefault?.topLevelPanels).toBeLessThanOrEqual(2);
  expect(consignmentDefault?.copyFindings).toEqual([]);

  const accountsDefault = internalReport.find((entry) => entry.slug === 'accounts-default');
  expect(accountsDefault?.routeReady).toBe(true);
  expect(accountsDefault?.tableCount).toBeLessThanOrEqual(1);
  expect(accountsDefault?.primaryButtons).toBeLessThanOrEqual(1);
  expect(accountsDefault?.copyFindings).toEqual([]);

  const accountDetail = internalReport.find((entry) => entry.slug === 'account-detail');
  expect(accountDetail?.routeReady).toBe(true);
  expect(accountDetail?.tabs).toBeLessThanOrEqual(3);
  expect(accountDetail?.primaryButtons).toBeLessThanOrEqual(1);
  expect(accountDetail?.copyFindings).toEqual([]);

  const calendarDefault = internalReport.find((entry) => entry.slug === 'calendar-default');
  expect(calendarDefault?.routeReady).toBe(true);
  expect(calendarDefault?.primaryButtons).toBeLessThanOrEqual(1);
  expect(calendarDefault?.copyFindings).toEqual([]);
});

test('UX-05 clutter budgets capture dealer portal routes', async ({ browser }) => {
  const fixtures = await readFixtures();
  const dealerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3101', viewport: { width: 1440, height: 1000 } });
  const dealerPage = await dealerContext.newPage();
  const dealerReport = [];

  try {
    await loginToDealerPortal(dealerPage, fixtures.dealerPortal);
    const dealerRoutes = [
      dealerRoute('dealer-dashboard', '/dealer/dashboard', /Start Here/i, 'default', 'Dealer Start Here and files-first baseline.', {
        critical: true,
        forbiddenTerms: ['Company Access Directory', 'Account Context', 'Contact Directory', 'Location Directory', 'Portal Users', 'publish', 'published', 'ready to provision', 'made available', 'Admin', 'admin access'],
      }),
      dealerRoute('dealer-catalog', '/dealer/catalog', /Products and Files/i, 'default', 'Files-first catalog baseline.', {
        critical: true,
        forbiddenTerms: ['View files and details', 'Has files', 'Missing files', 'publish', 'published', 'not ready', 'ready for your company', 'No files are attached yet', 'Files publish from product detail'],
      }),
      dealerRoute('dealer-account-center', '/dealer/account', /Account center/i, 'default', 'Dealer account support/status baseline.', {
        forbiddenTerms: ['publish', 'published', 'ready to provision', 'Dynamic managed', 'admin access', 'Dealer admins', 'non-admin', 'Order and invoice activity', 'Not available in this portal yet'],
      }),
      dealerRoute('dealer-product-detail', `/dealer/catalog/${fixtures.product.presentationId}`, new RegExp(escapeRegExp(fixtures.product.displayName), 'i'), 'deep', 'Dealer product file-first detail baseline.', {
        critical: true,
        forbiddenTerms: ['Product Overview', 'Dealer-facing details', 'publish', 'published', 'not ready', 'Unavailable', 'No files are attached yet', 'File not ready yet'],
      }),
    ].filter(includeRoute);

    for (const entry of dealerRoutes) {
      dealerReport.push(await captureClutterRoute(dealerPage, entry));
    }
  } finally {
    await dealerContext.close();
  }

  await writeReport('dealer-clutter-report.json', dealerReport);
  const summary = summarizeReports(dealerReport);
  await writeReport('dealer-summary.json', summary);

  expect.soft(summary.routeReadinessFailures, `Routes failed to render: ${formatFailures(summary.routeReadiness)}`).toBe(0);

  const dealerDashboard = dealerReport.find((entry) => entry.slug === 'dealer-dashboard');
  expect(dealerDashboard?.routeReady).toBe(true);
  expect(dealerDashboard?.copyFindings).toEqual([]);

  const dealerCatalog = dealerReport.find((entry) => entry.slug === 'dealer-catalog');
  expect(dealerCatalog?.routeReady).toBe(true);
  expect(dealerCatalog?.copyFindings).toEqual([]);

  const dealerProductDetail = dealerReport.find((entry) => entry.slug === 'dealer-product-detail');
  expect(dealerProductDetail?.routeReady).toBe(true);
  expect(dealerProductDetail?.copyFindings).toEqual([]);
});

function route(slug, routePath, heading, budgetKey, notes, options = {}) {
  return {
    budget: budgets[budgetKey],
    budgetKey,
    critical: Boolean(options.critical),
    forbiddenTerms: options.forbiddenTerms ?? [],
    heading,
    notes,
    routePath,
    slug,
  };
}

function includeRoute(entry) {
  return !criticalOnly || entry.critical;
}

function dealerRoute(slug, routePath, heading, budgetKey, notes, options = {}) {
  return route(slug, routePath, heading, budgetKey, notes, {
    ...options,
    forbiddenTerms: [
      'dealer catalog view',
      'erp',
      'migration',
      'resolver',
      'source system',
      'widen',
      ...(options.forbiddenTerms ?? []),
    ],
  });
}

async function readFixtures() {
  return JSON.parse(await fs.readFile(fixturePath, 'utf8'));
}

async function loginWithCredentials(page, email, password) {
  await page.goto('/auth/login');
  await expect(page.getByRole('heading', { name: 'Welcome to Pulse CRM' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await Promise.all([
    page.waitForURL(/\/leads$/),
    page.getByRole('button', { name: 'Sign in', exact: true }).click(),
  ]);
}

async function loginToDealerPortal(page, persona) {
  await page.goto('/dealer/login');
  await expect(page.getByRole('heading', { name: 'Dealer Portal Sign In' })).toBeVisible();
  await page.getByLabel('Email').fill(persona.email);
  await page.getByLabel('Password').fill(persona.password);
  await Promise.all([
    page.waitForURL(/\/dealer\/dashboard$/),
    page.getByRole('button', { name: 'Sign In' }).click(),
  ]);
}

async function captureClutterRoute(page, entry) {
  let navigationError = null;

  try {
    await page.goto(entry.routePath);
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  }

  const routeReady = navigationError === null && await waitForRouteHeading(page, entry.heading);
  const evidence = await captureScreenshots(page, entry);
  const metrics = await captureClutterMetrics(page, entry, evidence);
  const copyFindings = await captureCopyFindings(page, entry);
  const warnings = [...buildBudgetWarnings(metrics, entry.budget), ...copyFindings];

  return {
    ...metrics,
    budget: entry.budget,
    budgetKey: entry.budgetKey,
    notes: entry.notes,
    routeReady,
    navigationError,
    copyFindings,
    warnings,
    warningCount: warnings.length,
  };
}

async function captureCopyFindings(page, entry) {
  if (!entry.forbiddenTerms.length) {
    return [];
  }

  const bodyText = await page.locator('main, [role="main"]').first().innerText({ timeout: 2_000 }).catch(() => '');
  const normalized = bodyText.toLowerCase();
  return entry.forbiddenTerms
    .filter((term) => hasForbiddenTerm(normalized, term))
    .map((term) => ({
      actual: term,
      max: 0,
      message: 'Dealer-facing route exposes internal/provider vocabulary by default.',
      metric: 'forbiddenDealerTerm',
    }));
}

function hasForbiddenTerm(normalizedText, term) {
  const normalizedTerm = term.toLowerCase();
  if (/^[a-z0-9]{1,3}$/.test(normalizedTerm)) {
    return new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, 'i').test(normalizedText);
  }

  return normalizedText.includes(normalizedTerm);
}

async function waitForRouteHeading(page, heading) {
  try {
    await page.getByRole('heading', { name: heading }).waitFor({ state: 'visible', timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

async function captureScreenshots(page, entry) {
  await page.waitForTimeout(300);
  const viewportPath = path.join(clutterOutputDir, `${entry.slug}-viewport.png`);
  const fullPagePath = path.join(clutterOutputDir, `${entry.slug}-full.png`);

  await page.screenshot({ path: viewportPath });
  await page.screenshot({ path: fullPagePath, fullPage: true });

  return {
    fullPageScreenshot: path.relative(repoRootDir, fullPagePath),
    viewportScreenshot: path.relative(repoRootDir, viewportPath),
  };
}

async function captureClutterMetrics(page, entry, evidence) {
  const metrics = await page.locator('body').evaluate(() => {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const root = document.querySelector('main, [role="main"]') ?? document.body;
    const elements = Array.from(root.querySelectorAll('*'));

    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && rect.width > 0
        && rect.height > 0
        && rect.bottom > 0
        && rect.right > 0
        && rect.top < viewportHeight
        && rect.left < viewportWidth
        && !element.closest('[hidden], [aria-hidden="true"], header, nav, aside, [role="banner"], [role="navigation"]');
    };

    const isRendered = (element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && rect.width > 0
        && rect.height > 0
        && !element.closest('[hidden], [aria-hidden="true"], header, nav, aside, [role="banner"], [role="navigation"]');
    };

    const readableLabel = (element) => [
      element.getAttribute('aria-label'),
      element.textContent,
      element.getAttribute('title'),
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

    const summarize = (items) => items.slice(0, 8).map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        label: readableLabel(element).slice(0, 110),
        role: element.getAttribute('role') ?? element.tagName.toLowerCase(),
        testId: element.getAttribute('data-testid'),
        top: Math.round(rect.top),
      };
    });

    const visibleHeadings = elements.filter((element) => (
      isVisible(element)
        && (
          /^h[1-4]$/i.test(element.tagName)
          || element.getAttribute('role') === 'heading'
        )
        && readableLabel(element).length > 0
    ));

    const panelSelectors = 'section, article, [class*="mantine-Paper-root"], [class*="mantine-Card-root"], [data-testid*="panel" i], [data-testid*="card" i]';
    const panelCandidates = elements.filter((element) => {
      if (!isVisible(element) || !element.matches(panelSelectors)) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      const hasReadableHeading = Array.from(element.querySelectorAll('h1,h2,h3,h4,[role="heading"]')).some((child) => (
        child instanceof HTMLElement && readableLabel(child).length > 0
      ));
      return rect.width >= Math.min(260, viewportWidth * 0.25)
        && rect.height >= 64
        && (hasReadableHeading || rect.height >= 120);
    });
    const topLevelPanels = panelCandidates.filter((element) => !panelCandidates.some((candidate) => (
      candidate !== element
        && candidate.contains(element)
        && candidate.getBoundingClientRect().top <= element.getBoundingClientRect().top + 2
    )));

    const visibleTables = elements.filter((element) => isVisible(element) && (element.tagName.toLowerCase() === 'table' || element.getAttribute('role') === 'table'));
    const tableColumnCounts = visibleTables.map((table) => {
      const headers = Array.from(table.querySelectorAll('th,[role="columnheader"]')).filter(isRendered);
      if (headers.length) return headers.length;
      const firstRow = table.querySelector('tr,[role="row"]');
      return firstRow ? Array.from(firstRow.querySelectorAll('td,[role="cell"],[role="gridcell"]')).filter(isRendered).length : 0;
    });

    const rowActions = elements.filter((element) => {
      if (!isVisible(element)) {
        return false;
      }

      const tagName = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      if (tagName !== 'button' && tagName !== 'a' && role !== 'button' && role !== 'menuitem') {
        return false;
      }

      const label = readableLabel(element).toLowerCase();
      return element.closest('tr, [role="row"], [data-ux-row-action="true"]')
        || /\b(open|view|edit|assign|history|review|actions for|row actions)\b/.test(label);
    });
    const rows = elements.filter((element) => isVisible(element) && (element.tagName.toLowerCase() === 'tr' || element.getAttribute('role') === 'row'));
    const rowActionCounts = rows.map((row) => rowActions.filter((action) => row.contains(action)).length);
    const tabs = elements.filter((element) => isVisible(element) && element.getAttribute('role') === 'tab');
    const badgeCandidates = elements.filter((element) => {
      if (!isVisible(element)) {
        return false;
      }

      const className = String(element.getAttribute('class') ?? '');
      const testId = String(element.getAttribute('data-testid') ?? '');
      return /badge/i.test(className) || /badge/i.test(testId);
    });
    const badges = badgeCandidates.filter((element) => !badgeCandidates.some((candidate) => (
      candidate !== element && candidate.contains(element)
    )));

    const isPrimaryAction = (element) => {
      const variant = element.getAttribute('data-variant') ?? '';
      const className = String(element.getAttribute('class') ?? '');
      return ['filled', 'gradient'].includes(variant) || /filled|gradient|primary/i.test(className);
    };
    const buttons = elements.filter((element) => {
      if (!isVisible(element) || element.closest('[role="menu"], [role="menubar"], [role="tablist"]')) {
        return false;
      }
      const tagName = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      return (tagName === 'button' || role === 'button') && readableLabel(element).length > 0;
    });
    const primaryButtons = buttons.filter(isPrimaryAction);
    const secondaryButtons = buttons.filter((element) => !primaryButtons.includes(element));

    const emptyStates = elements.filter((element) => {
      if (!isVisible(element)) {
        return false;
      }

      const text = readableLabel(element).toLowerCase();
      if (!text || text.length > 220) {
        return false;
      }

      const hasMatchingChild = Array.from(element.children).some((child) => (
        child instanceof HTMLElement
          && isVisible(child)
          && /\b(no|none|empty|unavailable|not configured|not yet|nothing|no data|no records)\b/.test(readableLabel(child).toLowerCase())
      ));

      return !hasMatchingChild
        && /\b(no|none|empty|unavailable|not configured|not yet|nothing|no data|no records)\b/.test(text)
        && Boolean(element.closest('section, article, [class*="paper" i], [class*="card" i], [data-testid*="panel" i]'));
    });

    const rootRect = root.getBoundingClientRect();
    const documentHeight = Math.max(
      root.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      Math.round(rootRect.height),
    );

    return {
      firstViewportSections: visibleHeadings.filter((element) => element.getBoundingClientRect().top < viewportHeight * 0.95).length,
      heroBadges: badges.filter((element) => element.getBoundingClientRect().top < viewportHeight * 0.45).length,
      maxTableColumns: Math.max(0, ...tableColumnCounts),
      maxRowActionsPerRow: Math.max(0, ...rowActionCounts),
      primaryButtons: primaryButtons.length,
      repeatedEmptyStates: emptyStates.length,
      secondaryButtons: secondaryButtons.length,
      scrollHeight: documentHeight,
      scrollScreens: Number((documentHeight / viewportHeight).toFixed(2)),
      tableCount: visibleTables.length,
      tabs: tabs.length,
      topLevelPanels: topLevelPanels.length,
      visibleBadges: badges.length,
      visibleRowActions: rowActions.length,
      visibleSections: visibleHeadings.length,
      viewport: {
        height: viewportHeight,
        width: viewportWidth,
      },
      samples: {
        emptyStates: summarize(emptyStates),
        badges: summarize(badges),
        buttons: summarize(buttons),
        rowActions: summarize(rowActions),
        tables: summarize(visibleTables),
        tabs: summarize(tabs),
        topLevelPanels: summarize(topLevelPanels),
        visibleSections: summarize(visibleHeadings),
      },
    };
  });

  return {
    ...metrics,
    evidence,
    routePath: entry.routePath,
    slug: entry.slug,
  };
}

function buildBudgetWarnings(metrics, budget) {
  return [
    warnIf('firstViewportSections', metrics.firstViewportSections, budget.maxFirstViewportSections, 'Too many first-viewport sections compete before scroll.'),
    warnIf('visibleSections', metrics.visibleSections, budget.maxVisibleSections, 'Too many headings/sections compete in the first rendered route.'),
    warnIf('topLevelPanels', metrics.topLevelPanels, budget.maxTopLevelPanels, 'Too many card/panel surfaces are visible at once.'),
    warnIf('scrollScreens', metrics.scrollScreens, budget.maxScrollScreens, 'Route requires too many viewport-heights of scanning.'),
    warnIf('maxTableColumns', metrics.maxTableColumns, budget.maxTableColumns, 'A visible table exceeds the target column budget.'),
    warnIf('tableCount', metrics.tableCount, budget.maxVisibleTables, 'Too many visible tables compete on one route.'),
    warnIf('maxRowActionsPerRow', metrics.maxRowActionsPerRow, budget.maxRowActionsPerRow, 'Rows expose too many actions before a row menu/detail disclosure.'),
    warnIf('visibleRowActions', metrics.visibleRowActions, budget.maxVisibleRowActions, 'Too many row-level actions are visible before disclosure.'),
    warnIf('repeatedEmptyStates', metrics.repeatedEmptyStates, budget.maxRepeatedEmptyStates, 'Repeated empty/unavailable states add noise.'),
    warnIf('heroBadges', metrics.heroBadges, budget.maxHeroBadges, 'Hero area exposes too many badges.'),
    warnIf('visibleBadges', metrics.visibleBadges, budget.maxVisibleBadges, 'Badges are overused as decoration/status noise.'),
    warnIf('primaryButtons', metrics.primaryButtons, budget.maxPrimaryButtons, 'More than one primary button is visible.'),
    warnIf('secondaryButtons', metrics.secondaryButtons, budget.maxSecondaryButtons, 'Too many secondary buttons are visible before More/detail disclosure.'),
    warnIf('tabs', metrics.tabs, budget.maxTabs, 'Too many visible tabs compete at the same level.'),
  ].filter(Boolean);
}

function warnIf(metric, actual, max, message) {
  if (actual <= max) {
    return null;
  }

  return {
    actual,
    max,
    message,
    metric,
  };
}

function summarizeReports(reports) {
  const routeReadiness = reports.map((entry) => ({
    navigationError: entry.navigationError,
    routePath: entry.routePath,
    routeReady: entry.routeReady,
    slug: entry.slug,
  }));

  const warningRoutes = reports
    .filter((entry) => entry.warningCount > 0)
    .map((entry) => ({
      routePath: entry.routePath,
      slug: entry.slug,
      warningCount: entry.warningCount,
      warnings: entry.warnings,
    }));

  return {
    generatedAt: new Date().toISOString(),
    routeCount: reports.length,
    routeReadiness,
    routeReadinessFailures: routeReadiness.filter((entry) => !entry.routeReady).length,
    warningCount: warningRoutes.reduce((total, entry) => total + entry.warningCount, 0),
    warningRoutes,
  };
}

async function writeReport(filename, report) {
  await fs.writeFile(path.join(clutterOutputDir, filename), JSON.stringify(report, null, 2), 'utf8');
}

function formatFailures(readiness) {
  const failures = readiness.filter((entry) => !entry.routeReady);
  if (!failures.length) {
    return 'none';
  }
  return failures.map((entry) => `${entry.slug} (${entry.routePath})${entry.navigationError ? `: ${entry.navigationError}` : ''}`).join(' | ');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
