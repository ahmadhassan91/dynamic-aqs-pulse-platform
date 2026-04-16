import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(e2eDir, '.generated-fixtures.json');

test('internal workspace auth and core module routes stay backend-wired', async ({ page }) => {
  const fixtures = await readFixtures();

  await loginToInternalWorkspace(page, fixtures);

  await expect(page).toHaveURL(/\/leads$/);
  await expect(page.getByRole('heading', { name: 'Residential Lead Hub' })).toBeVisible();

  await page.goto('/leads/forms');
  await expect(page.getByRole('heading', { name: 'Pulse Website Lead Forms' })).toBeVisible();

  await page.goto('/territories');
  await expect(page.getByRole('heading', { name: 'Territory command center' })).toBeVisible();

  await page.goto('/customers');
  await expect(page.getByRole('heading', { name: 'Account Management' })).toBeVisible();

  await page.goto(`/customers/${fixtures.customer.accountId}`);
  await expect(page.getByRole('heading', { name: fixtures.customer.displayName })).toBeVisible();
  await page.getByRole('tab', { name: 'Dealer Portal' }).click();
  await expect(page.getByRole('heading', { name: 'Provision Dealer Portal User' })).toBeVisible();

  await page.goto('/training');
  await expect(page.getByRole('heading', { name: 'Training Management' })).toBeVisible();
  const trainingOverview = page.getByRole('tabpanel', { name: 'Overview' });
  await expect(trainingOverview.getByText('IAQ Certification Curriculum', { exact: true }).last()).toBeVisible();
  await expect(trainingOverview.getByText('Product Installations', { exact: true }).last()).toBeVisible();

  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: 'Centralized operating calendar' })).toBeVisible();
  await page.getByText('Day', { exact: true }).click({ force: true });
  await expect(page.getByText('Daily schedule lane')).toBeVisible();
  await page.getByText('Open slot').first().click({ force: true });
  await expect(page.getByRole('heading', { name: 'Centralized scheduler' })).toBeVisible();
  await page.getByText('Week', { exact: true }).click({ force: true });
  await expect(page.getByText('The centralized calendar now launches real discovery and training scheduling.')).toBeVisible();
  await page.getByText('Month', { exact: true }).click({ force: true });
  await expect(page.getByText('Open').first()).toBeVisible();

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'System Administration' })).toBeVisible();
});

test('public native website form submits a real lead into Pulse CRM', async ({ page }) => {
  const fixtures = await readFixtures();

  await page.goto(`/forms/lead/${fixtures.publicWebsiteForm.siteId}`);
  await expect(page.getByRole('heading', { name: 'Contact an IAQ Professional' })).toBeVisible();

  await page.getByLabel('First name').fill('Morgan');
  await page.getByLabel('Last name').fill('Field');
  await page.getByLabel('Company name').fill('Field Comfort Partners');
  await page.getByLabel('# of Service Technicians').fill('6');
  await page.getByLabel('Email').fill('morgan.field@example.com');
  await page.getByLabel('Mobile phone number or Direct phone').fill('555-401-5000');
  await page.getByLabel('Street address').fill('2500 Market Street');
  await page.getByLabel('City').fill('Dallas');
  await chooseSelectOption(page, 'State / Province', /Texas \(TX\)|TX/);
  await page.getByLabel('Zip / Postal Code').fill('75201');
  await chooseSelectOption(page, 'For HVAC Contractors, I am inquiring about:', 'Training and onboarding');
  await page.getByLabel('Please provide a brief summary of your request:').fill('We need onboarding support for a new contractor group.');
  await chooseSelectOption(page, 'How did you hear about us?', 'Dealer referral');
  await page.getByLabel('Who can we thank for referring you?').fill('Michelle Hogan');
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.getByText('Submitted to Pulse CRM')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Thanks, we.ve received your request\./ })).toBeVisible();
});

test('public CIS flow loads draft data, saves, and submits for internal review', async ({ page }) => {
  const fixtures = await readFixtures();

  await page.goto(`/public/cis/${fixtures.cis.token}`);
  await expect(page.getByRole('heading', { name: 'Customer Information Sheet' })).toBeVisible();
  await expect(page.getByLabel('Primary Contact Name')).toHaveValue('Jordan E2E');

  await page.getByLabel('Company Website').fill('https://updated-e2e.example.com');
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page.getByText('Draft saved successfully.')).toBeVisible();

  await page.getByLabel('I authorize the required card-on-file step for account review').check();
  await page.getByLabel('I certify the information above is accurate and authorize Dynamic AQS to continue account review').check();
  await page.getByRole('button', { name: 'Submit CIS Package' }).click();

  await expect(page.getByText('Your CIS package has been submitted for internal review.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'CIS Package Submitted' })).toBeVisible();
});

test('dealer portal login opens the branded dashboard and account center', async ({ page }) => {
  const fixtures = await readFixtures();

  await page.goto('/dealer/login');
  await expect(page.getByRole('heading', { name: 'Dealer Portal Sign In' })).toBeVisible();

  await page.getByLabel('Email').fill(fixtures.dealerPortal.email);
  await page.getByLabel('Password').fill(fixtures.dealerPortal.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/dealer\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dealer dashboard' })).toBeVisible();
  await expect(page.getByText('Account Context')).toBeVisible();
  await expect(page.getByText('Portal Users', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Open Account Center' }).click();
  await expect(page).toHaveURL(/\/dealer\/account$/);
  await expect(page.getByRole('heading', { name: 'Account center' })).toBeVisible();
  await expect(page.getByText('Portal Provisioning')).toBeVisible();
});

async function loginToInternalWorkspace(page, fixtures) {
  await page.goto('/auth/login');
  await expect(page.getByRole('heading', { name: 'Welcome to Pulse CRM' })).toBeVisible();
  await page.getByLabel('Email').fill(fixtures.internalAuth.email);
  await page.getByLabel('Password').fill(fixtures.internalAuth.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function chooseSelectOption(page, label, optionMatcher) {
  const control = page.getByLabel(label).first();
  await control.click();
  const searchText = resolveSelectSearchText(optionMatcher);
  const visibleText = resolveSelectVisibleText(optionMatcher);
  const optionPattern = new RegExp(`^${escapeRegExp(visibleText)}$`);

  if (await control.isEditable()) {
    await control.fill('');
    await control.pressSequentially(searchText);
    const option = page.getByRole('option', { name: optionPattern }).last();
    try {
      await option.click({ timeout: 3_000 });
    } catch {
      try {
        await page.getByText(visibleText, { exact: true }).last().click({ timeout: 3_000 });
      } catch {
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
      }
    }

    await expect.poll(async () => {
      const value = await control.inputValue();
      return value.trim();
    }).not.toBe('');
    return;
  }

  await page.getByRole('option', { name: optionPattern }).last().click();
}

function resolveSelectSearchText(optionMatcher) {
  if (typeof optionMatcher === 'string') {
    return optionMatcher;
  }

  const source = optionMatcher.source;
  if (source.includes('Texas')) {
    return 'Texas';
  }

  return source
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\|.*/, '')
    .replace(/[\\^$.*+?()[\]{}]/g, '')
    .trim();
}

function resolveSelectVisibleText(optionMatcher) {
  if (typeof optionMatcher === 'string') {
    return optionMatcher;
  }

  if (optionMatcher.source.includes('Texas')) {
    return 'Texas (TX)';
  }

  return resolveSelectSearchText(optionMatcher);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let cachedFixtures;

async function readFixtures() {
  if (cachedFixtures) {
    return cachedFixtures;
  }

  const raw = await fs.readFile(fixturePath, 'utf8');
  cachedFixtures = JSON.parse(raw);
  return cachedFixtures;
}
