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
  await expect(page.getByRole('heading', { name: 'Lead Work Queue' })).toBeVisible();
  const leadQueue = page.getByTestId('lead-work-queue');
  await expect(leadQueue).toBeVisible();
  await expect(leadQueue.getByRole('columnheader', { name: 'Next action' })).toBeVisible();
  await expect(leadQueue.getByRole('columnheader', { name: 'Stage / next action' })).toHaveCount(0);
  await expect(page.getByTestId('lead-pipeline-board')).toHaveCount(0);
  const firstLeadRow = leadQueue.locator('tbody tr').first();
  await expect(firstLeadRow.getByRole('cell').first()).toContainText(/Make Initial Contact|Schedule Discovery Call|Complete Discovery|Send CIS Link|Review Returned CIS|Follow Up CIS|Submit for Credit Approval|Track Finance Decision|Complete Onboarding|Secure First Order|Review Lead/);
  await expect(firstLeadRow.getByRole('link', { name: 'Open lead' })).toHaveCount(1);
  await page.getByRole('main').getByRole('button', { name: 'More' }).first().click();
  await expect(page.getByRole('menuitem', { name: 'Pipeline board' })).toBeVisible();
  await page.keyboard.press('Escape');
  await openNewIntake(page);
  const intakeDialog = page.getByRole('dialog');
  await expect(intakeDialog.getByText('New Intake')).toBeVisible();
  await intakeDialog.getByLabel('Company name').fill('Acme Comfort Group');
  await intakeDialog.getByLabel('Email').fill('intake@example.com');
  await intakeDialog.getByLabel('Phone').fill('555-401-5000');
  await expect(intakeDialog.getByLabel('Company name')).toHaveValue('Acme Comfort Group');
  await continueIntakeToRouting(intakeDialog);
  await expect(intakeDialog.getByRole('textbox', { name: 'Affinity group status' })).toHaveValue('');
  await expect(intakeDialog.getByRole('textbox', { name: 'Ownership group status' })).toHaveValue('');
  await intakeDialog.getByRole('button', { name: 'Continue to Review' }).click();
  await expect(page.getByText('Choose an affinity group status before creating a manual lead.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'New Intake' })).not.toBeVisible();

  await page.goto('/leads/forms');
  await expect(page.getByRole('heading', { name: 'Pulse Website Lead Forms' })).toBeVisible();
  await page.getByRole('tab', { name: 'Dealer Classification' }).click();
  await expect(page.getByText('Product Management uses those classifications')).toBeVisible();
  const affinityPanel = page.getByRole('heading', { name: 'Affinity groups' }).locator('xpath=ancestor::*[contains(@class, "mantine-Paper-root")][1]');
  const ownershipPanel = page.getByRole('heading', { name: 'Ownership groups' }).locator('xpath=ancestor::*[contains(@class, "mantine-Paper-root")][1]');
  await expect(affinityPanel).toBeVisible();
  await expect(ownershipPanel).toBeVisible();
  const affinityBox = await affinityPanel.boundingBox();
  const ownershipBox = await ownershipPanel.boundingBox();
  expect(affinityBox).not.toBeNull();
  expect(ownershipBox).not.toBeNull();
  expect(ownershipBox.y).toBeGreaterThan(affinityBox.y + affinityBox.height - 8);

  await page.goto('/territories');
  await expect(page.getByRole('heading', { name: 'Territory Management' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Territory Hub' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Territory Map' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Account List' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Action Queue' })).toBeVisible();
  await expect(page.getByTestId('territory-action-queue')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lead routing posture' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Map View' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Territory Registry' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Setup & Transfers' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Calendar' })).toHaveCount(0);
  await page.getByRole('tablist').getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('menuitem', { name: 'Map View' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Territory Registry' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Setup & Transfers' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Calendar' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/customers');
  await expect(page.getByRole('heading', { name: 'Account Management' })).toBeVisible();
  await expect(page.getByText('Account follow-up queue')).toBeVisible();
  await expect(page.getByText('All accounts', { exact: true })).toHaveCount(0);
  await page.getByText(/All accounts \(/).click();
  await expect(page.getByText('All accounts', { exact: true })).toBeVisible();

  await page.goto(`/customers/${fixtures.customer.accountId}`);
  await expect(page.getByRole('heading', { name: fixtures.customer.displayName })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Profile' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Contacts' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Locations' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Activity & Docs|Payment Methods|Training|Dealer Portal/ })).toHaveCount(0);
  await page.getByRole('tablist').getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Account readiness' }).click();
  await expect(page.getByRole('heading', { name: 'Account readiness', exact: true })).toBeVisible();
  await expect(page.getByText('Dealer membership resolves as independent.')).toBeVisible();
  await expect(page.getByText('The source lead is linked for audit and handoff traceability.')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('tablist').getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Dealer Portal' }).click();
  await expect(page.getByRole('heading', { name: 'Provision Dealer Portal User' })).toBeVisible();
  const portalUserAction = page.getByRole('button', { name: /Actions for / }).first();
  if (await portalUserAction.count()) {
    await portalUserAction.click();
    await expect(page.getByRole('menuitem', { name: 'Reset password' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Invite link' })).toBeVisible();
    await page.keyboard.press('Escape');
  }

  await page.goto('/training');
  await expect(page.getByRole('heading', { name: 'Training Workbench' })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'More' }).first().click();
  await page.getByRole('menuitem', { name: 'Coverage Summary' }).click();
  const trainingOverview = page.getByTestId('training-overview-panel');
  await expect(trainingOverview.getByText('IAQ Certification Curriculum', { exact: true }).last()).toBeVisible();
  await expect(trainingOverview.getByText('Product Installations', { exact: true }).last()).toBeVisible();

  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: 'CRM Calendar' })).toBeVisible();
  await expect(page.getByText('Day health')).toBeVisible();
  await expect(page.getByText('Event detail', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open linked record' })).toHaveCount(0);
  const calendarFilter = page.getByRole('textbox', { name: 'Calendar filter' });
  await expect(calendarFilter).toHaveValue('All Events');
  await calendarFilter.click();
  await expect(page.getByRole('option', { name: 'Discovery Calls' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Training Sessions' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Site Visits' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Audits' })).toBeVisible();
  await page.keyboard.press('Escape');
  await chooseSelectOption(page, 'Calendar view', 'Day');
  await expect(page.getByTestId('calendar-day-grid')).toBeVisible();
  await expect(page.getByTestId('calendar-time-grid')).toBeVisible();
  await expect(page.getByText('8:00 AM', { exact: true }).first()).toBeVisible();
  await page.getByTestId('calendar-open-slot').first().click({ force: true });
  await expect(page.getByRole('heading', { name: 'Centralized scheduler' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Centralized scheduler' })).not.toBeVisible();
  await chooseSelectOption(page, 'Calendar view', 'Week');
  await expect(page.getByTestId('calendar-week-grid')).toBeVisible();
  await expect(page.getByTestId('calendar-time-grid')).toBeVisible();
  await expect(page.getByTestId('calendar-week-grid').getByText('Sun', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('9:00 AM', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Month view' }).click();
  await expect(page.getByText('Open').first()).toBeVisible();

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'System Administration' })).toBeVisible();

  await page.goto('/admin/roles');
  await expect(page.getByText('Use these as ready-made access profiles')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Admin access profiles' }).getByText('Operations Admin')).toBeVisible();
  await expect(page.getByRole('button', { name: /Full access footprint/ })).toBeVisible();
});

test('training and consignment seeded operator work stays visible and dealer-safe', async ({ page }) => {
  const fixtures = await readFixtures();

  await loginToInternalWorkspace(page, fixtures);

  await page.goto('/training');
  await expect(page.getByRole('heading', { name: 'Training Workbench' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Priority Queue' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Scheduled Sessions' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Account Coverage' })).toHaveCount(0);
  await page.getByRole('main').getByRole('button', { name: 'More' }).first().click();
  await page.getByRole('menuitem', { name: 'Scheduled Sessions' }).click();
  const sessionsPanel = page.getByTestId('training-sessions-panel');
  await expect(sessionsPanel).toBeVisible();
  await expect(sessionsPanel.getByText(fixtures.training.title, { exact: true }).first()).toBeVisible();
  await expect(sessionsPanel.getByText('E2E Dealer Comfort', { exact: true }).first()).toBeVisible();
  await expect(sessionsPanel.getByText('Taylor Trainer', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('4 follow-ups')).toHaveCount(0);
  const seededSessionRow = sessionsPanel.getByRole('row', { name: new RegExp(escapeRegExp(fixtures.training.title)) });
  await seededSessionRow.getByRole('button', { name: 'Row actions' }).click();
  await page.getByRole('menuitem', { name: 'Update session' }).click();
  const executionDialog = page.getByRole('dialog', { name: new RegExp(`Update ${escapeRegExp(fixtures.training.title)}`) });
  await chooseSelectOption(executionDialog, 'Action', 'Complete session');
  await expect(executionDialog.getByTestId('training-completion-stepper')).toBeVisible();
  await expect(executionDialog.getByTestId('training-completion-step')).toBeVisible();
  await expect(executionDialog.getByTestId('training-proof-step')).toHaveCount(0);
  await executionDialog.getByLabel('Checkout notes').fill('Completed onsite training and reviewed next steps with the dealer team.');
  await expect(executionDialog.getByRole('button', { name: 'Complete Session' })).toBeEnabled();
  await executionDialog.getByRole('button', { name: 'Add proof / follow-up' }).click();
  await expect(executionDialog.getByTestId('training-proof-step')).toBeVisible();
  await expect(executionDialog.getByTestId('training-certification-step')).toHaveCount(0);
  await executionDialog.getByRole('button', { name: 'Add proof / follow-up' }).click();
  await expect(executionDialog.getByTestId('training-certification-step')).toBeVisible();
  await executionDialog.getByRole('button', { name: 'Add proof / follow-up' }).click();
  await expect(executionDialog.getByTestId('training-follow-up-step')).toBeVisible();
  await executionDialog.getByLabel('Create follow-up task').check();
  await expect(executionDialog.getByLabel('Follow-up title')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(executionDialog).not.toBeVisible();

  await page.goto('/consignment');
  await expect(page.getByRole('heading', { name: 'Consignment Workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Next site work' })).toBeVisible();
  await expect(page.getByText('E2E Dealer Comfort', { exact: true })).toBeVisible();
  await expect(page.getByText('Finish overdue ROSE audit', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText(/\b(Acumatica|ERP|inventory|PO|purchase order|manual variance|warehouse confirmation|warehouse setup waiting|approved handoff)\b/i);

  await page.goto(`/consignment/${fixtures.consignment.siteId}`);
  await expect(page.getByText('Consignment site', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E2E Dealer Comfort' })).toBeVisible();
  await expect(page.getByText('E2E Consignment Bay', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('consignment-current-site-work')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Current site work' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Activation Readiness' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Audit History' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Finish audit' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: 'More' })).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('button', { name: /Add Agreement|Confirm baseline|Mark Active|Schedule ROSE/ })).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText(/\b(Acumatica|ERP|inventory|PO|purchase order|manual variance|warehouse confirmation|warehouse setup waiting|approved handoff)\b/i);
});

test('admin user management keeps creation, import, and row actions discoverable', async ({ page }) => {
  const fixtures = await readFixtures();

  await loginToInternalWorkspace(page, fixtures);

  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'System Administration' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Users & Access' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('table', { name: 'Admin users' })).toBeVisible();

  await page.getByRole('button', { name: 'Add User' }).click();
  await expect(page.getByRole('dialog', { name: 'Create New User' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Create New User' })).not.toBeVisible();

  await page.getByRole('button', { name: 'More user actions' }).click();
  await page.getByRole('menuitem', { name: 'Import Users' }).click();
  await expect(page.getByRole('dialog', { name: 'Import Users' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Import Users' })).not.toBeVisible();

  await page.getByRole('button', { name: 'Row actions' }).first().click();
  await expect(page.getByRole('menuitem', { name: 'Edit user' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Reset password' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Activate user|Deactivate user/ })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/admin/integrations?provider=calendar');
  await expect(page.getByTestId('admin-integrations-provider-selector')).toBeVisible();
  await expect(page.getByTestId('admin-integration-panel-calendar')).toBeVisible();
  await expect(page.getByTestId('admin-integration-panel-entra')).toHaveCount(0);
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

test('public website form explains when a submission is attached to an existing lead', async ({ page }) => {
  const fixtures = await readFixtures();
  const companyName = `Duplicate Match ${Date.now()}`;

  await loginToInternalWorkspace(page, fixtures);
  await expect(page).toHaveURL(/\/leads$/);
  await openNewIntake(page);
  const intakeDialog = page.getByRole('dialog');
  await expect(intakeDialog.getByText('New Intake')).toBeVisible();
  await intakeDialog.getByLabel('Company name').fill(companyName);
  await intakeDialog.getByLabel('Contact name').fill('Existing Pulse Lead');
  await intakeDialog.getByLabel('Email').fill(`existing.${Date.now()}@example.com`);
  await intakeDialog.getByLabel('Phone').fill('555-401-5099');
  await chooseSelectOption(intakeDialog, 'State / Province', /Texas \(TX\)|TX/);
  await continueIntakeToRouting(intakeDialog);
  await chooseSelectOption(intakeDialog, 'Affinity group status', 'Independent / no group');
  await chooseSelectOption(intakeDialog, 'Ownership group status', 'Independent / no group');
  await continueIntakeToReview(intakeDialog);
  await reviewAndCreateLead(page, intakeDialog);

  await expect(page).toHaveURL(/\/leads\/.+/);
  const existingLeadId = page.url().split('/').pop();
  expect(existingLeadId).toBeTruthy();

  await page.goto('/forms/lead/solace-air');
  await expect(page.getByRole('heading', { name: 'Contact an IAQ Professional' })).toBeVisible();
  await page.getByText('Contractor', { exact: true }).click();
  await page.getByLabel('First name').fill('Ahmad');
  await page.getByLabel('Last name').fill('Duplicate');
  await page.getByLabel('Company name').fill(companyName);
  await page.getByLabel('# of Service Technicians').fill('3');
  await page.getByLabel('Email').fill(`public.${Date.now()}@example.com`);
  await page.getByLabel('Mobile phone number or Direct phone').fill('555-401-5011');
  await page.getByLabel('Street address').fill('2500 Market Street');
  await page.getByLabel('City').fill('Dallas');
  await chooseSelectOption(page, 'State / Province', /Texas \(TX\)|TX/);
  await page.getByLabel('Zip / Postal Code').fill('75201');
  await chooseSelectOption(page, 'For HVAC Contractors, I am inquiring about:', 'Training and onboarding');
  await page.getByLabel('Please provide a brief summary of your request:').fill('Please attach this to the in-flight contractor opportunity.');
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.getByText('Matched to Existing Pulse Lead')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'We found an existing Pulse lead for this request.' })).toBeVisible();
  await expect(page.getByText(new RegExp(`Linked lead ID: ${existingLeadId}`))).toBeVisible();
  await expect(page.getByText('Duplicate review status: pending review')).toBeVisible();
});

test('manual intake shows duplicate candidates before acknowledged create-new override', async ({ page }) => {
  const fixtures = await readFixtures();
  const timestamp = Date.now();
  const companyName = `Manual Duplicate ${timestamp}`;
  const email = `manual.duplicate.${timestamp}@example.com`;
  const phone = '555-401-5991';

  await loginToInternalWorkspace(page, fixtures);
  await expect(page).toHaveURL(/\/leads$/);

  await openNewIntake(page);
  let intakeDialog = page.getByRole('dialog');
  await expect(intakeDialog.getByText('New Intake')).toBeVisible();
  await intakeDialog.getByLabel('Company name').fill(companyName);
  await intakeDialog.getByLabel('Contact name').fill('Manual Original');
  await intakeDialog.getByLabel('Email').fill(email);
  await intakeDialog.getByLabel('Phone').fill(phone);
  await chooseSelectOption(intakeDialog, 'State / Province', /Texas \(TX\)|TX/);
  await continueIntakeToRouting(intakeDialog);
  await chooseSelectOption(intakeDialog, 'Affinity group status', 'Independent / no group');
  await chooseSelectOption(intakeDialog, 'Ownership group status', 'Independent / no group');
  await continueIntakeToReview(intakeDialog);
  await reviewAndCreateLead(page, intakeDialog);

  await expect(page).toHaveURL(/\/leads\/.+/);
  const originalLeadId = page.url().split('/').pop();
  expect(originalLeadId).toBeTruthy();

  await page.goto('/leads');
  await openNewIntake(page);
  intakeDialog = page.getByRole('dialog');
  await expect(intakeDialog.getByText('New Intake')).toBeVisible();
  await intakeDialog.getByLabel('Company name').fill(companyName);
  await intakeDialog.getByLabel('Contact name').fill('Manual Duplicate');
  await intakeDialog.getByLabel('Email').fill(email);
  await intakeDialog.getByLabel('Phone').fill(phone);
  await chooseSelectOption(intakeDialog, 'State / Province', /Texas \(TX\)|TX/);
  await continueIntakeToRouting(intakeDialog);
  await chooseSelectOption(intakeDialog, 'Affinity group status', 'Independent / no group');
  await chooseSelectOption(intakeDialog, 'Ownership group status', 'Independent / no group');
  await continueIntakeToReview(intakeDialog);
  await intakeDialog.getByRole('button', { name: 'Review duplicates' }).click();

  await expect(intakeDialog.getByTestId('new-intake-duplicate-panel')).toBeVisible();
  await expect(intakeDialog.getByText('Potential duplicate matches')).toBeVisible();
  await expect(intakeDialog.getByText(companyName).first()).toBeVisible();
  await expect(intakeDialog.getByText(email).first()).toBeVisible();
  await expect(intakeDialog.getByRole('button', { name: 'Create Lead Anyway' })).toBeDisabled();

  await intakeDialog.getByLabel('Reason for separate lead').fill('Confirmed this is a separate branch from the same show.');
  await intakeDialog.getByRole('button', { name: 'Create Lead Anyway' }).click();

  await expect(page).toHaveURL(/\/leads\/.+/);
  const duplicateLeadId = page.url().split('/').pop();
  expect(duplicateLeadId).toBeTruthy();
  expect(duplicateLeadId).not.toBe(originalLeadId);
});

test('public mixed website form accepts text entry without crashing', async ({ page }) => {
  await page.goto('/forms/lead/solace-air');
  await expect(page.getByRole('heading', { name: 'Contact an IAQ Professional' })).toBeVisible();

  await page.getByText('Contractor', { exact: true }).click();
  await page.getByLabel('First name').fill('Ahmad');
  await page.getByLabel('Last name').fill('Hassan');
  await page.getByLabel('Company name').fill('Clustox Comfort');
  await page.getByLabel('# of Service Technicians').fill('3');
  await page.getByLabel('Email').fill('ahmad.hassan@example.com');
  await page.getByLabel('Mobile phone number or Direct phone').fill('555-401-5010');

  await expect(page.getByLabel('First name')).toHaveValue('Ahmad');
  await expect(page.getByLabel('Last name')).toHaveValue('Hassan');
  await expect(page.getByLabel('Company name')).toHaveValue('Clustox Comfort');
});

test('internal lead kanban supports dragging a card into the next stage', async ({ page }) => {
  const fixtures = await readFixtures();
  const companyName = `Drag Lead ${Date.now()}`;

  await loginToInternalWorkspace(page, fixtures);
  await expect(page).toHaveURL(/\/leads$/);

  await openNewIntake(page);
  const intakeDialog = page.getByRole('dialog');
  await expect(intakeDialog.getByText('New Intake')).toBeVisible();
  await intakeDialog.getByLabel('Company name').fill(companyName);
  await intakeDialog.getByLabel('Contact name').fill('Drag Tester');
  await intakeDialog.getByLabel('Email').fill(`drag.${Date.now()}@example.com`);
  await intakeDialog.getByLabel('Phone').fill('555-401-5001');
  await chooseSelectOption(intakeDialog, 'State / Province', /Texas \(TX\)|TX/);
  await continueIntakeToRouting(intakeDialog);
  await chooseSelectOption(intakeDialog, 'Affinity group status', 'Independent / no group');
  await chooseSelectOption(intakeDialog, 'Ownership group status', 'Independent / no group');
  await continueIntakeToReview(intakeDialog);
  await reviewAndCreateLead(page, intakeDialog);

  await expect(page).toHaveURL(/\/leads\/.+/);
  await expect(page.getByRole('tab', { name: 'Work' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('lead-work-flow')).toBeVisible();
  await expect(page.getByTestId('lead-next-best-action-card')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Contacted' })).toHaveCount(0);
  const leadDetailUrl = page.url();

  await page.goto('/leads');
  await expect(page.getByTestId('lead-work-queue')).toBeVisible();
  await expect(page.getByTestId('lead-pipeline-board')).toHaveCount(0);
  await page.getByRole('main').getByRole('button', { name: 'More' }).first().click();
  await page.getByRole('menuitem', { name: 'Pipeline board' }).click();
  await expect(page.getByTestId('lead-pipeline-board')).toBeVisible();

  const sourceCard = page
    .getByText(companyName, { exact: true })
    .locator('xpath=ancestor::*[@draggable="true"][1]');
  const targetColumn = page
    .getByText('2. Discovery Scheduled', { exact: true })
    .locator('xpath=ancestor::*[@data-testid="lead-stage-column-discovery_scheduled"][1]');

  await expect(sourceCard).toBeVisible();
  await expect(targetColumn).toBeVisible();
  await sourceCard.dragTo(targetColumn);

  await page.goto(leadDetailUrl);
  await expect(page.getByRole('heading', { name: companyName })).toBeVisible();
  await expect(page.getByText('2. Discovery Scheduled', { exact: true }).first()).toBeVisible();
});

test('super admin can edit a lead record and sees prototype-style hero and card insights', async ({ page }) => {
  const fixtures = await readFixtures();
  const companyName = `Insight Lead ${Date.now()}`;

  await loginToInternalWorkspace(page, fixtures);
  await expect(page).toHaveURL(/\/leads$/);

  await openNewIntake(page);
  const intakeDialog = page.getByRole('dialog');
  await expect(intakeDialog.getByText('New Intake')).toBeVisible();
  await intakeDialog.getByLabel('Company name').fill(companyName);
  await intakeDialog.getByLabel('Contact name').fill('Insight Tester');
  await intakeDialog.getByLabel('Email').fill(`insight.${Date.now()}@example.com`);
  await intakeDialog.getByLabel('Phone').fill('555-401-5033');
  await chooseSelectOption(intakeDialog, 'State / Province', /California \(CA\)|CA/);
  await continueIntakeToRouting(intakeDialog);
  await chooseSelectOption(intakeDialog, 'Affinity group status', 'Independent / no group');
  await chooseSelectOption(intakeDialog, 'Ownership group status', 'Independent / no group');
  await continueIntakeToReview(intakeDialog);
  await reviewAndCreateLead(page, intakeDialog, 'E2E verifies lead detail edit flow with a distinct lead run.');
  await expect(page).toHaveURL(/\/leads\/.+/);
  await expect(page.getByRole('tab', { name: 'Work' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('lead-work-flow')).toBeVisible();
  await expect(page.getByTestId('lead-next-best-action-card')).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'More' }).first().click();
  await page.getByRole('menuitem', { name: 'Edit lead details' }).click();
  const editDialog = page.getByRole('dialog');
  await expect(editDialog.getByText('Edit Lead Details')).toBeVisible();
  await chooseSelectOption(editDialog, 'Lead source', 'Branded Website');
  await editDialog.getByLabel('Source site', { exact: true }).fill('SolaceAir.com');
  await editDialog.getByLabel('Brand tag').fill('SLA');
  await chooseSelectOption(editDialog, 'Lead rating', 'Warm');
  await editDialog.getByLabel('Potential value').fill('18000');
  await editDialog.getByLabel('Notes').fill('Hero and kanban insight regression.');
  await editDialog.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByRole('heading', { name: companyName })).toBeVisible();
  await expect(page.getByText('SolaceAir.com', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('SLA', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Warm', { exact: true }).first()).toBeVisible();

  await page.getByRole('main').getByRole('button', { name: 'More' }).first().click();
  await page.getByRole('menuitem', { name: 'Park lead' }).click();
  const parkDialog = page.getByRole('dialog', { name: 'Park this lead?' });
  await expect(parkDialog).toBeVisible();
  await chooseSelectOption(parkDialog, 'Reason for parking', 'No response');
  await parkDialog.getByLabel('Follow-up note').fill('E2E pause before resume.');
  await parkDialog.getByRole('button', { name: 'Park lead' }).click();
  await expect(page.getByTestId('lead-lifecycle-status-card')).toContainText('Parked');

  await page.getByRole('main').getByRole('button', { name: 'More' }).first().click();
  await page.getByRole('menuitem', { name: 'Resume lead' }).click();
  const resumeDialog = page.getByRole('dialog', { name: 'Resume this lead?' });
  await expect(resumeDialog).toBeVisible();
  await resumeDialog.getByRole('button', { name: 'Resume lead' }).click();
  await expect(page.getByTestId('lead-lifecycle-status-card')).toHaveCount(0);

  await page.goto('/leads');
  await expect(page.getByTestId('lead-work-queue')).toBeVisible();
  await expect(page.getByTestId('lead-pipeline-board')).toHaveCount(0);
  await page.getByRole('main').getByRole('button', { name: 'More' }).first().click();
  await page.getByRole('menuitem', { name: 'Pipeline board' }).click();
  await expect(page.getByTestId('lead-pipeline-board')).toBeVisible();
  await page.getByPlaceholder('Search leads, companies, emails...').fill(companyName);

  const insightCard = page
    .getByText(companyName, { exact: true })
    .locator('xpath=ancestor::*[@draggable="true"][1]');

  await expect(insightCard).toContainText('SOLACEAIR.COM');
  await expect(insightCard).toContainText('SLA');
  await expect(insightCard).toContainText('Warm');
  await expect(insightCard).toContainText('$18,000');
  await expect(insightCard).toContainText('Make Initial Contact');
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
  await expect(page.getByRole('heading', { name: 'Start Here' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Next Action' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Account Support' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Product Files' })).toBeVisible();
  await expect(page.getByText('Portal Users', { exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'Open Account Center' }).click();
  await expect(page).toHaveURL(/\/dealer\/account$/);
  await expect(page.getByRole('heading', { name: 'Account center' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Company portal status' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Portal User Access' })).toBeVisible();
  await page.getByRole('button', { name: 'Invite User' }).click();
  const inviteDialog = page.getByRole('dialog', { name: 'Invite Portal User' });
  await inviteDialog.getByLabel('First name').fill('E2E');
  await inviteDialog.getByLabel('Last name').fill('Buyer');
  await inviteDialog.getByLabel('Email').fill('dealer-buyer.e2e@example.com');
  await inviteDialog.getByLabel('Title').fill('Buyer');
  await inviteDialog.getByRole('button', { name: 'Create Invite' }).click();
  await expect(page.getByRole('cell', { name: 'dealer-buyer.e2e@example.com' }).first()).toBeVisible();
  await expect(page.getByText('Invite link created:')).toBeVisible();
});

test('navigation highlights territory routes without duplicate active links', async ({ page }) => {
  const fixtures = await readFixtures();

  await loginToInternalWorkspace(page, fixtures);

  await page.goto('/territories');
  await expectCurrentNavItem(page, 'Territory Hub', '/territories?tab=dashboard');
  await expectInactiveNavItem(page, 'Territory Map', '/territory_map');
  await expectInactiveNavItem(page, 'Account List', '/territories?tab=list');

  await page.goto('/territory_map');
  await expectInactiveNavItem(page, 'Territory Hub', '/territories?tab=dashboard');
  await expectCurrentNavItem(page, 'Territory Map', '/territory_map');
  await expectInactiveNavItem(page, 'Account List', '/territories?tab=list');
});

test('navigation keeps single-screen modules as direct links', async ({ page }) => {
  const fixtures = await readFixtures();

  await loginToInternalWorkspace(page, fixtures);

  await expect(page.getByRole('button', { name: 'Products and Files', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Products', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Digital Assets', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Users & Access', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Administration', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Administration', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Consignment', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Consignment', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Training', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Training', exact: true })).toHaveCount(0);
});

test('dealer navigation distinguishes account center from account health hash', async ({ page }) => {
  const fixtures = await readFixtures();

  await loginToDealerPortal(page, fixtures.dealerPortal);

  await page.goto('/dealer/account');
  await expectCurrentNavItem(page, 'Account Center', '/dealer/account');
  await expectInactiveNavItem(page, 'Account Health', '/dealer/account#account-health');

  await page.goto('/dealer/account#account-health');
  await expectInactiveNavItem(page, 'Account Center', '/dealer/account');
  await expectCurrentNavItem(page, 'Account Health', '/dealer/account#account-health');
});

test('RD and TM personas can use scoped Dynamic workspaces', async ({ browser }) => {
  const fixtures = await readFixtures();

  await withInternalPersona(browser, fixtures.personas.regionalDirector.email, fixtures.personas.regionalDirector.password, async (page) => {
    await expect(page).toHaveURL(/\/leads$/);
    await page.goto('/territories');
    await expect(page.getByRole('heading', { name: 'Territory Management' })).toBeVisible();
    await expect(page.getByTestId('territory-action-queue')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lead routing posture' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Show Details' }).click();
    await expect(page.getByRole('heading', { name: 'Lead routing posture' })).toBeVisible();
    await page.goto('/territory_map');
    await expect(page.getByRole('heading', { name: 'Territory Coverage Map' })).toBeVisible();
    await page.goto('/customers');
    await expect(page.getByRole('heading', { name: 'Account Management' })).toBeVisible();
    await page.goto('/training');
    await expect(page.getByRole('heading', { name: 'Training Workbench' })).toBeVisible();
    await page.goto('/consignment');
    await expect(page.getByRole('heading', { name: 'Consignment Workspace' })).toBeVisible();
    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: 'CRM Calendar' })).toBeVisible();
  });

  await withInternalPersona(browser, fixtures.personas.territoryManager.email, fixtures.personas.territoryManager.password, async (page) => {
    await expect(page).toHaveURL(/\/leads$/);
    await page.goto('/territories');
    await expect(page.getByRole('heading', { name: 'Territory Management' })).toBeVisible();
    await expect(page.getByText('Scoped territory work from account, lead, training, and consignment state.')).toBeVisible();
    await page.getByRole('tablist').getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('menuitem', { name: 'Work Queues' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Setup & Transfers' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.goto('/customers');
    await expect(page.getByRole('heading', { name: 'Account Management' })).toBeVisible();
    await page.goto('/training');
    await expect(page.getByRole('heading', { name: 'Training Workbench' })).toBeVisible();
    await page.goto('/consignment');
    await expect(page.getByRole('heading', { name: 'Consignment Workspace' })).toBeVisible();
  });
});

test('UX-07 role persona signoff covers optimized default work surfaces', async ({ browser, page }) => {
  const fixtures = await readFixtures();

  await loginToInternalWorkspace(page, fixtures);
  await assertInternalDefaultRoutes(page, ['leads', 'territories', 'customers', 'training', 'consignment', 'product-management', 'digital-assets', 'admin', 'calendar']);
  await page.goto('/admin/integrations?provider=calendar');
  await expect(page.getByTestId('admin-integration-panel-calendar')).toBeVisible();

  await withInternalPersona(browser, fixtures.personas.regionalDirector.email, fixtures.personas.regionalDirector.password, async (rdPage) => {
    await assertInternalDefaultRoutes(rdPage, ['territories', 'customers', 'training', 'consignment', 'calendar']);
    await expect(rdPage.getByRole('main')).not.toContainText(/\b(Bulk customer transfer|Bulk lead transfer|Create territory|Create region)\b/i);
  });

  await withInternalPersona(browser, fixtures.personas.territoryManager.email, fixtures.personas.territoryManager.password, async (tmPage) => {
    await assertInternalDefaultRoutes(tmPage, ['territories', 'customers', 'training', 'consignment', 'calendar']);
    await expect(tmPage.getByRole('main')).not.toContainText(/\b(Bulk customer transfer|Bulk lead transfer|Create territory|Create region)\b/i);
  });

  await withInternalPersona(browser, fixtures.personas.dynamicSupport.email, fixtures.personas.dynamicSupport.password, async (supportPage) => {
    await assertInternalDefaultRoutes(supportPage, ['leads', 'customers', 'product-management', 'digital-assets', 'admin', 'calendar']);
    await supportPage.goto('/admin');
    await expect(supportPage.getByRole('tab', { name: 'Users & Access' })).toHaveAttribute('aria-selected', 'true');
  });

  await withDealerPersona(browser, fixtures.dealerPortal, async (dealerPage) => {
    await expect(dealerPage.getByRole('heading', { name: 'Products and Files' })).toBeVisible();
    await dealerPage.goto('/dealer/dashboard');
    await expect(dealerPage.getByRole('heading', { name: 'Start Here' })).toBeVisible();
    await expect(dealerPage.getByRole('main')).not.toContainText(/\b(publish|published|ready|not ready|order and invoice|invoice activity|made available)\b/i);
    await dealerPage.goto('/dealer/account');
    await expect(dealerPage.getByRole('heading', { name: 'Account center' })).toBeVisible();
    await expect(dealerPage.getByRole('main')).not.toContainText(/\b(order and invoice|invoice activity|not available in this portal yet)\b/i);
  });
});

test('dealer catalog personas see the right catalog or review boundary', async ({ browser }) => {
  const fixtures = await readFixtures();

  await withDealerPersona(browser, fixtures.dealerCatalogPersonas.affinity, async (page) => {
    await expect(page.getByRole('heading', { name: 'Products and Files' })).toBeVisible();
    await expect(page.getByText('Nexstar E2E Air Cleaner')).toBeVisible();
    await expect(page.getByText('Ownership E2E Air Cleaner')).not.toBeVisible();
    await expect(page.getByRole('main').getByText(/publish|published|Missing files|not ready|No files are attached yet|Files publish from product detail/i)).toHaveCount(0);
  });

  await withDealerPersona(browser, fixtures.dealerCatalogPersonas.ownership, async (page) => {
    await expect(page.getByText('Ownership E2E Air Cleaner')).toBeVisible();
    await expect(page.getByText('Nexstar E2E Air Cleaner')).not.toBeVisible();
  });

  await withDealerPersona(browser, fixtures.dealerCatalogPersonas.independent, async (page) => {
    await expect(page.getByText('Independent E2E Air Cleaner')).toBeVisible();
  });

  await withDealerPersona(browser, fixtures.dealerCatalogPersonas.hybrid, async (page) => {
    await expect(page.getByText('No products are available yet')).toBeVisible();
    await expect(page.getByText('No products are available in your catalog right now. Contact Dynamic AQS support if you need a specific product or file.')).toBeVisible();
    await expect(page.getByRole('main')).not.toContainText(/\b(ready for your company|made available)\b/i);
  });
});

async function loginToInternalWorkspace(page, fixtures) {
  await loginWithCredentials(page, fixtures.internalAuth.email, fixtures.internalAuth.password);
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

async function withInternalPersona(browser, email, password, assertion) {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3101' });
  const page = await context.newPage();

  try {
    await loginWithCredentials(page, email, password);
    await assertion(page);
  } finally {
    await context.close();
  }
}

async function withDealerPersona(browser, persona, assertion) {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3101' });
  const page = await context.newPage();

  try {
    await loginToDealerPortal(page, persona);
    await page.goto('/dealer/catalog');
    await assertion(page);
  } finally {
    await context.close();
  }
}

async function assertInternalDefaultRoutes(page, routeKeys) {
  const routes = {
    leads: ['/leads', /Lead Work Queue/i],
    territories: ['/territories', /Territory Management/i],
    customers: ['/customers', /Account Management/i],
    training: ['/training', /Training Workbench/i],
    consignment: ['/consignment', /Consignment Workspace/i],
    'product-management': ['/product-management', /Product Management/i],
    'digital-assets': ['/digital-assets', /Digital Assets/i],
    admin: ['/admin', /System Administration/i],
    calendar: ['/calendar', /CRM Calendar/i],
  };

  for (const key of routeKeys) {
    const [routePath, heading] = routes[key];
    await page.goto(routePath);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByRole('main')).not.toContainText(/\b(Acumatica|ERP|Widen|resolver|manifest|source ID|provider|migration|purchase order|manual variance|warehouse confirmation|approved handoff)\b/i);
  }
}

function navItem(page, label, href) {
  return page.locator(`a[href="${href}"]`).filter({ hasText: label }).first();
}

async function expectCurrentNavItem(page, label, href) {
  const item = navItem(page, label, href);
  await expect(item).toBeVisible();
  await expect(item).toHaveAttribute('aria-current', 'page');
}

async function expectInactiveNavItem(page, label, href) {
  const item = navItem(page, label, href);
  await expect(item).toBeVisible();
  await expect(item).not.toHaveAttribute('aria-current', 'page');
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
