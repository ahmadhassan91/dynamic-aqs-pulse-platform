import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

// WCAG 2.1 A/AA axe-core baseline across the public login page and the core
// authenticated internal routes. First run is a BASELINE: soft assertions so every
// route is scanned and reported; convert to hard expect() once violations are cleared.
const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(e2eDir, '.generated-fixtures.json');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const INTERNAL_ROUTES = [
  '/leads',
  '/customers',
  '/territories',
  '/calendar',
  '/training',
  '/consignment',
  '/digital-assets',
  '/admin',
  '/admin/users',
];

async function readFixtures() {
  return JSON.parse(await fs.readFile(fixturePath, 'utf8'));
}

function summarize(route, results) {
  const summary = results.violations
    .map((v) => `${v.id}[${v.impact ?? 'n/a'}]x${v.nodes.length}`)
    .join(', ');
  // Printed to the run log so the baseline is readable per route.
  console.log(`[a11y] ${route}: ${results.violations.length} violation rule(s)${summary ? ' -> ' + summary : ''}`);
  // Dump up to 3 offending elements per rule so the source is unambiguous.
  for (const v of results.violations) {
    for (const node of v.nodes.slice(0, 3)) {
      const html = (node.html ?? '').replace(/\s+/g, ' ').slice(0, 160);
      console.log(`[a11y-node] ${route} ${v.id}: ${html}`);
    }
  }
}

test('public login page — axe WCAG 2.1 AA', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.getByRole('heading', { name: 'Welcome to Pulse CRM' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  summarize('/auth/login', results);
  expect.soft(results.violations, '/auth/login a11y violations').toEqual([]);
});

test('authenticated internal routes — axe WCAG 2.1 AA baseline', async ({ page }) => {
  const fixtures = await readFixtures();
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(fixtures.internalAuth.email);
  await page.getByLabel('Password').fill(fixtures.internalAuth.password);
  await Promise.all([
    page.waitForURL(/\/leads$/),
    page.getByRole('button', { name: 'Sign in', exact: true }).click(),
  ]);

  for (const route of INTERNAL_ROUTES) {
    await page.goto(route);
    await page.waitForLoadState('networkidle').catch(() => {});
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    summarize(route, results);
    expect.soft(results.violations, `${route} a11y violations`).toEqual([]);
  }
});
