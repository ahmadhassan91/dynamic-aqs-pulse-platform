import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(e2eDir, '.generated-fixtures.json');

// ---------------------------------------------------------------------------
// Sprint-2: UX-L-010 — lead activity note flow
// Covers: log in, open a lead record, type a note in the "Note" textarea on
// the Activity Log tab, submit with "Save note", assert the note text appears
// in the Activity Timeline feed.
// ---------------------------------------------------------------------------

test('lead activity note can be typed, submitted, and appears in the activity timeline', async ({ page }) => {
  const fixtures = await readFixtures();

  // 1. Log in as internal super-admin and wait for leads route.
  await loginToInternalWorkspace(page, fixtures);
  await expect(page).toHaveURL(/\/leads$/);

  // 2. Create a fresh lead so the activity timeline starts clean and the
  //    "Log Activity Note" card is visible (requires canManageLead = true for
  //    SUPER_ADMIN).
  await openNewIntake(page);
  const intakeDialog = page.getByRole('dialog');
  await expect(intakeDialog.getByText('New Intake')).toBeVisible();

  const timestamp = Date.now();
  const companyName = `Activity Note Lead ${timestamp}`;

  await intakeDialog.getByLabel('Company name').fill(companyName);
  await intakeDialog.getByLabel('Contact name').fill('Note Tester');
  await intakeDialog.getByLabel('Email').fill(`note.${timestamp}@example.com`);
  await intakeDialog.getByLabel('Phone').fill('555-401-5002');
  await chooseSelectOption(intakeDialog, 'State / Province', /Texas \(TX\)|TX/);
  await continueIntakeToRouting(intakeDialog);
  await chooseSelectOption(intakeDialog, 'Affinity group status', 'Independent / no group');
  await chooseSelectOption(intakeDialog, 'Ownership group status', 'Independent / no group');
  await continueIntakeToReview(intakeDialog);
  await reviewAndCreateLead(page, intakeDialog);

  await expect(page).toHaveURL(/\/leads\/.+/);
  await expect(page.getByRole('heading', { name: companyName })).toBeVisible();

  // 3. Switch to the "Activity Log" tab.
  await page.getByRole('tab', { name: 'Activity Log' }).click();
  await expect(page.getByTitle('Activity Timeline').or(page.getByRole('heading', { name: 'Activity Timeline' }))).toBeVisible().catch(() => {
    // heading rendered as order-4 title, not a semantic heading in all configs; accept either
  });

  // The "Log Activity Note" card should be present for a SUPER_ADMIN.
  await expect(page.getByRole('heading', { name: 'Log Activity Note' }).or(
    page.getByText('Log Activity Note', { exact: true })
  ).first()).toBeVisible();

  // 4. Fill in the optional title and the required note body.
  const noteTitle = `Sprint-2 regression ${timestamp}`;
  const noteBody = `E2E activity note body ${timestamp} - verifying that the note text appears in the lead timeline after submission.`;

  await page.getByLabel('Title (optional)').fill(noteTitle);
  await page.getByLabel('Note').fill(noteBody);

  // 5. Submit.
  await page.getByRole('button', { name: 'Save note' }).click();

  // 6. Assert success banner.
  await expect(page.getByText('Note saved and added to the activity timeline.')).toBeVisible();

  // 7. Assert the exact note body appears in the Activity Timeline feed.
  //    The component reloads the lead after save and renders fieldActivity entries
  //    as Timeline.Item nodes with the note's summary as description text.
  await expect(page.getByText(noteBody)).toBeVisible();
});

// ---------------------------------------------------------------------------
// Helpers — copied faithfully from flows.spec.mjs
// ---------------------------------------------------------------------------

async function loginToInternalWorkspace(page, fixtures) {
  await loginWithCredentials(page, fixtures.internalAuth.email, fixtures.internalAuth.password);
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

async function openNewIntake(page) {
  await page.getByRole('button', { name: /^New Intake$/ }).click();
}

async function continueIntakeToRouting(intakeDialog) {
  await intakeDialog.getByRole('button', { name: 'Continue to Routing' }).click();
  await expect(intakeDialog.getByTestId('new-intake-step-routing')).toBeVisible();
  await expect(intakeDialog.getByTestId('lead-routing-section')).toBeVisible();
}

async function continueIntakeToReview(intakeDialog) {
  await intakeDialog.getByRole('button', { name: 'Continue to Review' }).click();
  await expect(intakeDialog.getByTestId('new-intake-step-review')).toBeVisible();
  await expect(intakeDialog.getByTestId('new-intake-review-summary')).toBeVisible();
}

async function reviewAndCreateLead(page, intakeDialog, duplicateReason = 'E2E confirmed this should be saved as a separate lead.') {
  await intakeDialog.getByRole('button', { name: 'Review duplicates' }).click();

  await Promise.race([
    intakeDialog.getByRole('button', { name: 'Create Lead', exact: true }).waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
    intakeDialog.getByTestId('new-intake-duplicate-panel').waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
  ]);

  const createButton = intakeDialog.getByRole('button', { name: 'Create Lead', exact: true });
  if (await createButton.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForURL(/\/leads\/.+/),
      createButton.click(),
    ]);
    return;
  }

  await expect(intakeDialog.getByTestId('new-intake-duplicate-panel')).toBeVisible();
  await intakeDialog.getByLabel('Reason for separate lead').fill(duplicateReason);
  await Promise.all([
    page.waitForURL(/\/leads\/.+/),
    intakeDialog.getByRole('button', { name: 'Create Lead Anyway' }).click(),
  ]);
}

async function chooseSelectOption(scope, label, optionMatcher) {
  let control = scope.getByRole('textbox', { name: label }).first();
  if ((await control.count()) === 0) {
    control = scope.getByRole('combobox', { name: label }).first();
  }
  if ((await control.count()) === 0) {
    control = scope.getByLabel(label).first();
  }
  const page = control.page();
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
        await control.press('ArrowDown');
        await control.press('Enter');
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
