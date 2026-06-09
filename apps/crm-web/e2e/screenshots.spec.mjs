import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(e2eDir, '.generated-fixtures.json');
const shotsDir = path.resolve(e2eDir, '../../../output/playwright/screenshots');

async function readFixtures() {
  return JSON.parse(await fs.readFile(fixturePath, 'utf8'));
}

async function shot(page, name, fullPage = true) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(shotsDir, `${name}.png`), fullPage });
  console.log(`[shot] ${name}.png`);
}

const ROUTES = [
  ['01-leads', '/leads'],
  ['02-customers', '/customers'],
  ['03-territories', '/territories'],
  ['04-calendar', '/calendar'],
  ['05-training', '/training'],
  ['06-consignment', '/consignment'],
  ['07-digital-assets', '/digital-assets'],
  ['08-admin', '/admin'],
  ['09-admin-users', '/admin/users'],
];

test('capture implemented surfaces', async ({ page }) => {
  // Public login page
  await page.goto('/auth/login');
  await shot(page, '00-login');

  // Authenticate as the seeded internal admin
  const fixtures = await readFixtures();
  await page.getByLabel('Email').fill(fixtures.internalAuth.email);
  await page.getByLabel('Password').fill(fixtures.internalAuth.password);
  await Promise.all([
    page.waitForURL(/\/leads$/),
    page.getByRole('button', { name: 'Sign in', exact: true }).click(),
  ]);

  for (const [name, route] of ROUTES) {
    await page.goto(route);
    await shot(page, name);
  }

  // Admin "Add User" modal — shows the masked Temporary Password field (PasswordInput fix)
  try {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.getByRole('button', { name: /add user/i }).first().click({ timeout: 6000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(shotsDir, '10-admin-add-user-modal.png') });
    console.log('[shot] 10-admin-add-user-modal.png');
  } catch (err) {
    console.log(`[shot] admin modal skipped: ${err}`);
  }

  // Dark mode — toggle via the header control, then re-capture key routes.
  try {
    await page.goto('/leads');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await page.waitForTimeout(400);
    for (const [name, route] of ROUTES) {
      await page.goto(route);
      await shot(page, `${name}-dark`);
    }
    // Territory coverage map — verify the basemap tiles + overlay panels are dark-scheme.
    await page.goto('/territory_map');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2200);
    await shot(page, '11-territory-map-dark');
  } catch (err) {
    console.log(`[shot] dark mode skipped: ${err}`);
  }
});

test('responsive viewports (tablet + mobile)', async ({ page }) => {
  const fixtures = await readFixtures();
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(fixtures.internalAuth.email);
  await page.getByLabel('Password').fill(fixtures.internalAuth.password);
  await Promise.all([
    page.waitForURL(/\/leads$/),
    page.getByRole('button', { name: 'Sign in', exact: true }).click(),
  ]);

  const viewports = [['tablet', 768, 1024], ['mobile', 390, 844]];
  const routes = [['leads', '/leads'], ['customers', '/customers'], ['territories', '/territories']];
  for (const [vp, w, h] of viewports) {
    await page.setViewportSize({ width: w, height: h });
    for (const [name, route] of routes) {
      await page.goto(route);
      await shot(page, `rsp-${vp}-${name}`);
    }
  }
});
