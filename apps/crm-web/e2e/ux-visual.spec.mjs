import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootDir = path.resolve(e2eDir, '../../..');
const fixturePath = path.join(e2eDir, '.generated-fixtures.json');
const visualOutputDir = path.join(repoRootDir, 'output', 'playwright', 'ux-03');

const clutterBudget = {
  maxPrimaryButtons: 1,
  maxVisibleSecondaryButtons: 2,
  maxTopMetrics: 4,
  maxVisibleTabs: 4,
  maxEmptyPanels: 1,
};

test.beforeAll(async () => {
  await fs.rm(visualOutputDir, { recursive: true, force: true });
  await fs.mkdir(visualOutputDir, { recursive: true });
});

test('capture CRM and dealer default UX budgets', async ({ page, browser }) => {
  const fixtures = await readFixtures();
  const internalReport = [];

  await loginWithCredentials(page, fixtures.internalAuth.email, fixtures.internalAuth.password);

  const internalRoutes = [
    { slug: 'leads-work-queue', path: '/leads', heading: /Lead Work Queue/i, assertVisualBudget: true },
    { slug: 'leads-insights', path: '/leads/analytics', heading: /Lead Work Queue/i, assertVisualBudget: true },
    { slug: 'calendar', path: '/calendar', heading: /CRM Calendar/i, assertVisualBudget: true },
    { slug: 'territories', path: '/territories', heading: /Territory Management/i, assertVisualBudget: true },
    { slug: 'territory-map', path: '/territory_map', heading: /Territory Coverage Map/i, assertVisualBudget: true },
    { slug: 'training', path: '/training', heading: /Training Workbench/i, assertVisualBudget: true },
    { slug: 'consignment', path: '/consignment', heading: /Consignment Workspace/i, assertVisualBudget: true },
    { slug: 'product-catalog-readiness', path: '/product-management', heading: /Product Management/i, assertVisualBudget: true },
    { slug: 'product-dealer-visibility', path: '/product-management?tab=visibility', heading: /Product Management/i, assertVisualBudget: true },
    ...(fixtures.product ? [{
      slug: 'product-detail',
      path: `/product-management/products/${fixtures.product.productId}`,
      heading: new RegExp(escapeRegExp(fixtures.product.displayName), 'i'),
      visualBudgetWaiver: {
        owner: 'Product + Marketing',
        reason: 'Product detail density is deferred to UX-03 Slice C detail rail standardization.',
        expires: '2026-07-15',
      },
    }] : []),
    { slug: 'digital-assets-library', path: '/digital-assets', heading: /Digital Assets/i, assertVisualBudget: true },
    { slug: 'digital-assets-share-sets', path: '/digital-assets?tab=collections', heading: /Digital Assets/i, assertVisualBudget: true },
    { slug: 'digital-assets-delivery-health', path: '/digital-assets?tab=delivery-health', heading: /Digital Assets/i, assertVisualBudget: true },
    { slug: 'accounts', path: '/customers', heading: /Account Management/i, assertVisualBudget: true },
    {
      slug: 'account-detail',
      path: `/customers/${fixtures.customer.accountId}`,
      heading: new RegExp(escapeRegExp(fixtures.customer.displayName), 'i'),
      visualBudgetWaiver: {
        owner: 'Accounts',
        reason: 'Account detail density is deferred to UX-03 Slice C detail rail standardization.',
        expires: '2026-07-15',
      },
    },
    { slug: 'admin', path: '/admin', heading: /System Administration/i, assertVisualBudget: true },
    { slug: 'admin-users', path: '/admin/users', heading: /System Administration/i, assertVisualBudget: true },
    {
      slug: 'business-rules',
      path: '/admin/catalog-rules',
      heading: /Dealer Catalog Rules/i,
      assertVisualBudget: true,
    },
  ];

  assertCapturedRoutesHaveBudgetDecision(internalRoutes, 'internal routes');

  for (const route of internalRoutes) {
    internalReport.push(await captureRouteBudget(page, route));
  }

  await writeReport('internal-report.json', internalReport);

  const dealerReport = [];
  const personas = [
    { slug: 'dealer-admin', persona: fixtures.dealerPortal, routes: ['dashboard', 'catalog', 'account'] },
    { slug: 'dealer-affinity', persona: fixtures.dealerCatalogPersonas.affinity, routes: ['dashboard', 'catalog'] },
    { slug: 'dealer-ownership', persona: fixtures.dealerCatalogPersonas.ownership, routes: ['dashboard', 'catalog'] },
    { slug: 'dealer-independent', persona: fixtures.dealerCatalogPersonas.independent, routes: ['dashboard', 'catalog'] },
    { slug: 'dealer-hybrid', persona: fixtures.dealerCatalogPersonas.hybrid, routes: ['dashboard', 'catalog'] },
  ];
  const routeMap = {
    dashboard: { path: '/dealer/dashboard', heading: /Start Here/i, assertVisualBudget: true },
    catalog: { path: '/dealer/catalog', heading: /Products and Files/i, assertVisualBudget: true },
    account: { path: '/dealer/account', heading: /Account center/i, assertVisualBudget: true },
  };

  assertCapturedRoutesHaveBudgetDecision(Object.values(routeMap), 'dealer routes');

  for (const entry of personas) {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3101', viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    try {
      await loginToDealerPortal(page, entry.persona);
      for (const routeName of entry.routes) {
        const route = routeMap[routeName];
        dealerReport.push(await captureRouteBudget(page, {
          ...route,
          slug: `${entry.slug}-${routeName}`,
        }));
      }
    } finally {
      await context.close();
    }
  }

  await writeReport('dealer-report.json', dealerReport);
});

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

async function captureRouteBudget(page, route) {
  let navigationError = null;

  try {
    await page.goto(route.path);
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  }

  const routeReady = navigationError === null
    && await waitForRouteHeading(page, route.heading);
  const evidence = await captureScreenshots(page, route.slug, route.path);
  const budget = await captureVisualBudget(page, route.slug, route.path, evidence);
  const context = `${route.slug} (${route.path}) expected heading ${route.heading}; screenshots: ${evidence.viewportScreenshot}, ${evidence.fullPageScreenshot}`;

  expect.soft(routeReady, navigationError ? `${context}; navigation error: ${navigationError}` : context).toBe(true);

  if (route.assertVisualBudget && routeReady) {
    assertVisualBudget(budget);
  }

  return {
    ...evidence,
    routeReady,
    navigationError,
    visualBudgetWaiver: route.visualBudgetWaiver ?? null,
    visualBudget: budget,
  };
}

async function waitForRouteHeading(page, heading) {
  try {
    await page.getByRole('heading', { name: heading }).waitFor({ state: 'visible', timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

async function captureScreenshots(page, slug, routePath) {
  await page.waitForTimeout(300);
  const viewportPath = path.join(visualOutputDir, `${slug}-viewport.png`);
  const fullPagePath = path.join(visualOutputDir, `${slug}-full.png`);

  await page.screenshot({ path: viewportPath });
  await page.screenshot({ path: fullPagePath, fullPage: true });

  return {
    slug,
    routePath,
    viewportScreenshot: path.relative(repoRootDir, viewportPath),
    fullPageScreenshot: path.relative(repoRootDir, fullPagePath),
  };
}

async function captureVisualBudget(page, slug, routePath, evidence) {
  const counts = await page.locator('body').evaluate(() => {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const root = document.querySelector('main, [role="main"]') ?? document.body;
    const all = Array.from(root.querySelectorAll('*'));

    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }

      if (element.closest('[hidden], [aria-hidden="true"]')) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && rect.bottom > 0
        && rect.right > 0
        && rect.top < viewportHeight
        && rect.left < viewportWidth;
    };

    const readableLabel = (element) => [
      element.getAttribute('aria-label'),
      element.textContent,
      element.getAttribute('title'),
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

    const isInsideNavigation = (element) => Boolean(
      element.closest('nav, aside, [role="navigation"], [data-testid*="navigation" i], [data-testid*="sidebar" i]'),
    );

    const isMenuOrTab = (element) => Boolean(
      element.closest('[role="menu"], [role="menubar"], [role="tablist"]')
        || element.getAttribute('role') === 'menuitem'
        || element.getAttribute('role') === 'tab',
    );

    const isEmbeddedMapControl = (element) => Boolean(
      element.closest('.maplibregl-ctrl, .mapboxgl-ctrl'),
    );

    const isRowActionChrome = (element) => Boolean(
      element.closest('[data-ux-row-action="true"]'),
    );

    const buttonLikeElements = all.filter((element) => {
      if (!isVisible(element) || isInsideNavigation(element) || isMenuOrTab(element) || isEmbeddedMapControl(element) || isRowActionChrome(element)) {
        return false;
      }

      const tagName = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      const className = String(element.getAttribute('class') ?? '');
      const linkStyledAsButton = tagName === 'a'
        && element.hasAttribute('href')
        && (role === 'button' || element.hasAttribute('data-variant') || /button|actionicon/i.test(className));
      return tagName === 'button' || role === 'button' || linkStyledAsButton;
    }).filter((element) => readableLabel(element).length > 0);

    const isPrimaryAction = (element) => {
      const variant = element.getAttribute('data-variant') ?? '';
      if (['filled', 'gradient'].includes(variant)) {
        return true;
      }

      const className = String(element.getAttribute('class') ?? '');
      if (/filled|gradient|primary/i.test(className)) {
        return true;
      }

      return false;
    };

    const primaryButtons = buttonLikeElements.filter(isPrimaryAction);
    const secondaryButtons = buttonLikeElements.filter((element) => !primaryButtons.includes(element));
    const visibleTabs = all.filter((element) => isVisible(element) && element.getAttribute('role') === 'tab');
    const topMetrics = all.filter((element) => (
      isVisible(element)
        && element.getBoundingClientRect().top < viewportHeight * 0.9
        && (
          element.classList.contains('premium-stat-card')
          || /(^|-)metric-card($|-)/i.test(element.getAttribute('data-testid') ?? '')
          || /(^|-)stat-card($|-)/i.test(element.getAttribute('data-testid') ?? '')
        )
    ));
    const emptyPanels = all.filter((element) => {
      if (!isVisible(element)) {
        return false;
      }

      const text = readableLabel(element).toLowerCase();
      if (!text || text.length > 180) {
        return false;
      }

      const hasMatchingChild = Array.from(element.children).some((child) => (
        child instanceof HTMLElement
          && isVisible(child)
          && /\b(no|none|empty|unavailable|not configured|not yet|nothing)\b/.test(readableLabel(child).toLowerCase())
      ));

      return !hasMatchingChild
        && /\b(no|none|empty|unavailable|not configured|not yet|nothing)\b/.test(text)
        && Boolean(element.closest('section, article, [class*="paper" i], [class*="card" i], [data-testid*="panel" i]'));
    });

    const summarize = (elements) => elements.slice(0, 5).map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        label: readableLabel(element).slice(0, 90),
        role: element.getAttribute('role') ?? element.tagName.toLowerCase(),
        testId: element.getAttribute('data-testid'),
        top: Math.round(rect.top),
      };
    });

    return {
      primaryButtons: primaryButtons.length,
      visibleSecondaryButtons: secondaryButtons.length,
      topMetrics: topMetrics.length,
      visibleTabs: visibleTabs.length,
      emptyPanels: emptyPanels.length,
      samples: {
        primaryButtons: summarize(primaryButtons),
        visibleSecondaryButtons: summarize(secondaryButtons),
        topMetrics: summarize(topMetrics),
        visibleTabs: summarize(visibleTabs),
        emptyPanels: summarize(emptyPanels),
      },
    };
  });

  return {
    slug,
    routePath,
    ...counts,
    budget: clutterBudget,
    evidence: {
      viewportScreenshot: evidence.viewportScreenshot,
      fullPageScreenshot: evidence.fullPageScreenshot,
    },
  };
}

function assertVisualBudget(result) {
  const context = `${result.slug} (${result.routePath}) screenshots: ${result.evidence.viewportScreenshot}, ${result.evidence.fullPageScreenshot}`;

  expect.soft(result.primaryButtons, `${context} primary action samples: ${formatSamples(result.samples.primaryButtons)}`)
    .toBeLessThanOrEqual(result.budget.maxPrimaryButtons);
  expect.soft(result.visibleSecondaryButtons, `${context} secondary action samples: ${formatSamples(result.samples.visibleSecondaryButtons)}`)
    .toBeLessThanOrEqual(result.budget.maxVisibleSecondaryButtons);
  expect.soft(result.topMetrics, `${context} metric samples: ${formatSamples(result.samples.topMetrics)}`)
    .toBeLessThanOrEqual(result.budget.maxTopMetrics);
  expect.soft(result.visibleTabs, `${context} tab samples: ${formatSamples(result.samples.visibleTabs)}`)
    .toBeLessThanOrEqual(result.budget.maxVisibleTabs);
  expect.soft(result.emptyPanels, `${context} empty panel samples: ${formatSamples(result.samples.emptyPanels)}`)
    .toBeLessThanOrEqual(result.budget.maxEmptyPanels);
}

function assertCapturedRoutesHaveBudgetDecision(routes, context) {
  const missing = routes
    .filter((route) => !route.assertVisualBudget && !route.visualBudgetWaiver)
    .map((route) => `${route.slug ?? route.path} (${route.path})`);

  expect.soft(missing, `${context} must have visual-budget enforcement or a waiver`).toEqual([]);
}

function formatSamples(samples) {
  if (!samples.length) {
    return 'none';
  }

  return samples
    .map((sample) => `${sample.role}${sample.testId ? `[${sample.testId}]` : ''}@${sample.top}:${sample.label || '(unlabelled)'}`)
    .join(' | ');
}

async function writeReport(filename, report) {
  await fs.writeFile(path.join(visualOutputDir, filename), JSON.stringify(report, null, 2), 'utf8');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
