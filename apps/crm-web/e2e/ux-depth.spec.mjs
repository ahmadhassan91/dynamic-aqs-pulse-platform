import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootDir = path.resolve(e2eDir, '../../..');
const fixturePath = path.join(e2eDir, '.generated-fixtures.json');
const depthOutputDir = path.join(repoRootDir, 'output', 'playwright', 'ux-02-depth');

const dialogBudget = {
  maxDialogButtons: 3,
  maxPrimaryButtons: 1,
  maxEmptyMessages: 1,
};

test.beforeAll(async () => {
  await fs.rm(depthOutputDir, { recursive: true, force: true });
  await fs.mkdir(depthOutputDir, { recursive: true });
});

test('common internal detail modals stay action-light and task-first', async ({ page }) => {
  const fixtures = await readFixtures();
  const report = [];

  await loginWithCredentials(page, fixtures.internalAuth.email, fixtures.internalAuth.password);

  await page.goto(`/leads/${fixtures.cis.leadId}`);
  await expect(page.getByRole('heading', { name: fixtures.cis.companyName })).toBeVisible();
  await expect(page.getByTestId('lead-next-best-action-card')).toBeVisible();
  await expect(page.getByTestId('lead-work-step-cis')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Contacted' })).toHaveCount(0);
  await openHeaderMoreItem(page, 'Edit lead details');
  report.push(await captureDialogBudget(page, 'lead-edit-record', 'Edit Lead Details'));
  await page.keyboard.press('Escape');

  await page.goto(`/product-management/products/${fixtures.product.productId}`);
  await expect(page.getByRole('heading', { name: fixtures.product.displayName })).toBeVisible();
  await openHeaderMoreItem(page, 'Fix product info');
  report.push(await captureDialogBudget(page, 'product-fix-product-info', 'Fix product info'));
  await page.keyboard.press('Escape');

  await page.goto('/digital-assets');
  await expect(page.getByRole('heading', { name: 'Digital Assets' })).toBeVisible();
  await openHeaderMoreItem(page, 'Upload Files');
  report.push(await captureDialogBudget(page, 'digital-assets-upload-files', 'Upload Files'));
  await page.keyboard.press('Escape');

  await page.goto('/consignment');
  await expect(page.getByRole('heading', { name: 'Consignment Workspace' })).toBeVisible();
  await openHeaderMoreItem(page, 'Create Site');
  report.push(await captureDialogBudget(page, 'consignment-create-site', 'Add Consignment Site'));
  await page.keyboard.press('Escape');

  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: 'CRM Calendar' })).toBeVisible();
  await page.getByRole('button', { name: 'Schedule Discovery/Training' }).click();
  report.push(await captureDialogBudget(page, 'calendar-centralized-scheduler', 'Centralized scheduler'));

  await writeReport('internal-dialog-report.json', report);
});

test('TM and RD scoped workspaces avoid setup-first default clutter', async ({ browser }) => {
  const fixtures = await readFixtures();
  const report = [];

  await withInternalPersona(browser, fixtures.personas.regionalDirector, async (page) => {
    await page.goto('/territories');
    await expect(page.getByRole('heading', { name: 'Territory Management' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Setup & Transfers' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Calendar' })).toHaveCount(0);
    await expect(page.getByTestId('territory-action-queue')).toBeVisible();
    const nextWorkTable = page.getByRole('table', { name: 'Next territory work' });
    if (await nextWorkTable.count()) {
      await expect(nextWorkTable).toBeVisible();
      await expect(nextWorkTable.getByRole('columnheader')).toHaveCount(5);
    }
    report.push(await capturePageBudget(page, 'rd-territory-default'));
  });

  await withInternalPersona(browser, fixtures.personas.territoryManager, async (page) => {
    await page.goto('/territories');
    await expect(page.getByRole('heading', { name: 'Territory Management' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Setup & Transfers' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Calendar' })).toHaveCount(0);
    await expect(page.getByTestId('territory-action-queue')).toBeVisible();
    const nextWorkTable = page.getByRole('table', { name: 'Next territory work' });
    if (await nextWorkTable.count()) {
      await expect(nextWorkTable).toBeVisible();
      await expect(nextWorkTable.getByRole('columnheader')).toHaveCount(5);
    }
    report.push(await capturePageBudget(page, 'tm-territory-default'));
  });

  await writeReport('persona-workspace-report.json', report);
});

test('UX-03 slice C advanced tables stay sampled, passive, and row-action based', async ({ page }) => {
  const fixtures = await readFixtures();

  await loginWithCredentials(page, fixtures.internalAuth.email, fixtures.internalAuth.password);

  await page.goto('/product-management?tab=admin');
  await expect(page.getByRole('heading', { name: 'Product Management' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Source file review' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Blocking Gaps' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview source files' }).click();
  await expect(page.getByText('Source preview only')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Legacy product source preview' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Possible section' })).toBeVisible();

  await page.goto('/training?tab=ops');
  await expect(page.getByRole('heading', { name: 'Training Workbench' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Recertification queue' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Coaching workload upcoming sessions' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Coaching' }).click();
  await expect(page.getByRole('table', { name: 'Coaching workload upcoming sessions' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Recertification queue' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Overdue Cadence' }).click();
  await expect(page.getByRole('table', { name: 'Overdue cadence queue' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Coaching workload upcoming sessions' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Session Issues' }).click();
  await expect(page.getByRole('table', { name: 'Training execution exceptions' })).toBeVisible();

  await page.goto('/territories');
  await expect(page.getByRole('heading', { name: 'Territory Management' })).toBeVisible();
  await expect(page.getByTestId('territory-action-queue')).toBeVisible();
  const nextTerritoryWorkTable = page.getByRole('table', { name: 'Next territory work' });
  await expect(nextTerritoryWorkTable).toBeVisible();
  await expect(nextTerritoryWorkTable.getByRole('columnheader')).toHaveCount(5);
  await expect(page.getByRole('menuitem', { name: /Open (lead|account)/ })).toHaveCount(0);
  const nextWorkRowAction = nextTerritoryWorkTable.getByRole('button', { name: /Actions for / }).first();
  await expect(nextWorkRowAction).toBeVisible();
  await nextWorkRowAction.click();
  await expect(page.getByRole('menuitem', { name: /Open (lead|account)/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: /Open (lead|account)/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Lead routing posture' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show Details' }).click();
  await expect(page.getByRole('heading', { name: 'Lead routing posture' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Territory workload snapshot' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Regional rollups' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Regions' }).click();
  await expect(page.getByRole('heading', { name: 'Regional rollups' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Owner workload' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Owners' }).click();
  await expect(page.getByRole('heading', { name: 'Owner workload' })).toBeVisible();

  await page.goto('/territories?tab=list');
  await expect(page.getByRole('heading', { name: 'Territory Management' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Territory registry' })).toBeVisible();
  const registryPanel = page
    .getByRole('heading', { name: 'Territory registry' })
    .locator('xpath=ancestor::*[contains(@class, "mantine-Paper-root")][1]');
  await expect(registryPanel.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
  const territoryRowAction = registryPanel.getByRole('button', { name: /Actions for / }).first();
  await expect(territoryRowAction).toBeVisible();
  await territoryRowAction.click();
  await expect(page.getByRole('menuitem', { name: 'Edit territory' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'Edit territory' })).toHaveCount(0);

  await page.goto('/territories?tab=admin');
  await expect(page.getByTestId('territory-setup-stepper')).toHaveCount(0);
  await page.getByText(/Leads \(\d+\)/).click();
  await expect(page.getByRole('heading', { name: 'Bulk lead transfer' })).toBeVisible();
  const leadTransferPanel = page
    .getByRole('heading', { name: 'Bulk lead transfer' })
    .locator('xpath=ancestor::*[contains(@class, "mantine-Paper-root")][1]');
  await expect(leadTransferPanel.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
  const leadRowAction = leadTransferPanel.getByRole('button', { name: /Actions for / }).first();
  if (await leadRowAction.count()) {
    await leadRowAction.click();
    await expect(page.getByRole('menuitem', { name: 'Open lead' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Assignment history' })).toBeVisible();
    await page.keyboard.press('Escape');
  }
  await page.getByText('Setup & transfers', { exact: true }).click();
  await expect(page.getByTestId('territory-setup-stepper')).toBeVisible();
  const setupStepper = page.getByTestId('territory-setup-stepper');
  await expect(page.getByTestId('territory-region-step')).toBeVisible();
  await setupStepper.getByText('Shipping hub', { exact: true }).click();
  await expect(page.getByTestId('territory-shipping-center-step')).toBeVisible();
  await setupStepper.getByText('Territory', { exact: true }).click();
  await expect(page.getByTestId('territory-territory-step')).toBeVisible();
  await setupStepper.getByText('Coverage review', { exact: true }).click();
  await expect(page.getByTestId('territory-setup-review-step')).toBeVisible();

  await page.goto('/admin/catalog-rules');
  await expect(page.getByRole('heading', { name: 'Dealer Group Rules' })).toBeVisible();
  await expect(page.getByTestId('catalog-rules-draft-step')).toBeVisible();
  await expect(page.getByTestId('catalog-rule-sets-table')).toBeHidden();
  await expect(page.getByTestId('catalog-rule-preview-decisions-table')).toHaveCount(0);
  await expect(page.getByTestId('catalog-rule-preview-impact-table')).toHaveCount(0);
  await expect(page.getByTestId('catalog-rules-preview-step')).toHaveCount(0);
  await expect(page.getByTestId('catalog-rules-publish-step')).toHaveCount(0);
  await expect(page.getByTestId('catalog-rules-publish-rule-set')).toHaveCount(0);
});

test('UX-03 slice D role-first queues keep setup and parked dependencies out of default work', async ({ page }) => {
  const fixtures = await readFixtures();

  await loginWithCredentials(page, fixtures.internalAuth.email, fixtures.internalAuth.password);

  await page.goto('/consignment');
  await expect(page.getByRole('heading', { name: 'Consignment Workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Next site work' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Next site work' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Follow-up Queue|ROSE & Readiness/ })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Reports' })).toHaveCount(0);
  await expect(page.getByText('Mailbox')).toHaveCount(0);

  await page.goto('/product-management');
  await expect(page.getByRole('heading', { name: 'Product Management' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Products' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Setup' })).toHaveCount(0);
  await expect(page.getByText('Need info')).toBeVisible();
  await expect(page.getByText('Need files')).toBeVisible();
  await expect(page.getByText('Need visibility')).toBeVisible();
  await expect(page.getByText('Ready to publish')).toBeVisible();
  await expect(page.getByText('Products become eligible here; live catalog versions are published from Who Sees What after review.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Status' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Products needing review' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Catalog section / SKU family' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Publish readiness' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Next fix' })).toBeVisible();
  await expect(page.getByText('Source file review')).toHaveCount(0);
  await expect(page.getByText('Preview source files')).toHaveCount(0);
  await page.getByRole('tablist').getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('menuitem', { name: 'Catalog sections' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'SKU families' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Source file review' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/product-management?tab=visibility');
  await expect(page.getByRole('tab', { name: 'Who Sees What' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Select a Dealer group').first()).toBeVisible();
  await expect(page.getByText('Selected', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Products shown')).toHaveCount(0);
  await expect(page.getByText('Needs dealer group', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Live version')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Publish catalog view' })).toHaveCount(0);
  await page.getByRole('button', { name: 'How dealer groups work' }).click();
  await expect(page.getByText('Dealer group playbook')).toBeVisible();
  await expect(page.getByText(/Affinity and ownership\/PE are separate account signals/i)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('Dealer groups', { exact: true }).getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Add Dealer group' }).click();
  const catalogViewDialog = page.getByRole('dialog', { name: 'Create Dealer group' });
  await expect(catalogViewDialog).toBeVisible();
  await expect(catalogViewDialog.getByText('Who is this for?')).toBeVisible();
  await expect(catalogViewDialog.getByText('What should they see?')).toBeVisible();
  await expect(catalogViewDialog.getByText('Review before publish')).toBeVisible();
  await expect(catalogViewDialog.getByRole('button', { name: 'Next: scope' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/digital-assets');
  await expect(page.getByRole('heading', { name: 'Digital Assets' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /Advanced Import|Migration Review|Needs Attention|Delivery Health/i })).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('button', { name: 'Upload Files' })).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('button', { name: /Copy customer link|Create share link/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Find and share approved files' })).toBeVisible();
  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('menuitem', { name: 'Upload Files' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Needs Attention' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Migration Review' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'System Administration' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Users & Access' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Daily Admin Work' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Setup and Evidence' })).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('button', { name: 'Add User' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Admin users' })).toBeVisible();

  await page.goto('/admin/integrations');
  await expect(page.getByRole('heading', { name: 'System Administration' })).toBeVisible();
  await expect(page.getByTestId('admin-integrations-provider-selector')).toBeVisible();
  await expect(page.getByTestId('admin-integration-panel-entra')).toBeVisible();
  await expect(page.getByTestId('admin-integration-panel-calendar')).toHaveCount(0);
  await expect(page.getByTestId('admin-integration-panel-payments')).toHaveCount(0);
  await expect(page.getByTestId('admin-integration-panel-lead-alerts')).toHaveCount(0);
  await page.getByLabel('Integration setup area').click();
  await page.getByRole('option', { name: 'Outlook calendar' }).click();
  await expect(page.getByTestId('admin-integration-panel-calendar')).toBeVisible();
  await expect(page.getByTestId('admin-integration-panel-entra')).toHaveCount(0);

  await page.goto('/admin/integrations?provider=calendar');
  await expect(page.getByTestId('admin-integration-panel-calendar')).toBeVisible();
  await expect(page.getByTestId('admin-integration-panel-entra')).toHaveCount(0);
});

test('UX-05 slice E Training and Consignment show one queue before setup/reporting', async ({ browser, page }) => {
  const fixtures = await readFixtures();

  await withInternalPersona(browser, fixtures.personas.trainingOps, async (trainingPage) => {
    await trainingPage.goto('/training');
    await expect(trainingPage.getByRole('heading', { name: 'Training Workbench' })).toBeVisible();
    await expect(trainingPage.getByRole('tab', { name: 'Priority Queue' })).toHaveAttribute('aria-selected', 'true');
    const queues = trainingPage.getByRole('tablist', { name: 'Training priority queues' });
    await expect(queues).toBeVisible();
    await expect(queues.getByRole('tab', { name: /Recertification/ })).toHaveAttribute('aria-selected', 'true');
    await expect(trainingPage.getByRole('table', { name: 'Recertification queue' })).toBeVisible();
    await expect(trainingPage.getByRole('table', { name: /Coaching workload upcoming sessions|Overdue cadence queue|Training execution exceptions/i })).toHaveCount(0);
    await expect(trainingPage.getByRole('main').getByRole('heading', {
      name: /Overdue programs|Pending proof decisions|unresolved exceptions|Current certified tracks|Session execution snapshot/i,
    })).toHaveCount(0);
    await expect(trainingPage.getByRole('main').getByRole('button', { name: 'More' }).first()).toBeVisible();
    await expect(trainingPage.getByRole('heading', { name: /Compliance Reports|Catalog Setup/ })).toHaveCount(0);
  });

  await loginWithCredentials(page, fixtures.internalAuth.email, fixtures.internalAuth.password);
  await page.goto('/consignment');
  const main = page.getByRole('main');
  await expect(page.getByRole('heading', { name: 'Consignment Workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Next site work' })).toBeVisible();
  const nextSiteWork = page.getByRole('table', { name: 'Next site work' });
  await expect(nextSiteWork).toBeVisible();
  await expect(nextSiteWork.getByRole('columnheader')).toHaveCount(6);
  for (const header of ['Next work', 'Account / Site', 'Owner', 'Due', 'Status']) {
    await expect(nextSiteWork.getByRole('columnheader', { name: header })).toBeVisible();
  }
  await expect(nextSiteWork.getByRole('columnheader', {
    name: /Warehouse|Inventory|PO|Purchase order|Agreement|BLUE|ROSE metrics/i,
  })).toHaveCount(0);
  const queueRow = nextSiteWork.getByRole('row', { name: /E2E Dealer Comfort/ });
  await expect(queueRow).toContainText('Finish overdue ROSE audit');
  await expect(queueRow).toContainText('Main Office');
  await expect(queueRow).toContainText('Terry Territory');
  await expect(queueRow).toContainText('Audit overdue');
  await expect(queueRow.getByRole('button', { name: 'Row actions' })).toHaveCount(1);
  await queueRow.getByRole('button', { name: 'Row actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Open site' })).toBeVisible();
  await expect(page.getByRole('menuitem')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tab', { name: /Follow-up Queue|ROSE & Readiness/ })).toHaveCount(0);
  await expect(main.getByText(/Today's Priorities|Overdue Audits|Ready For Setup|Active Sites|Onboarding Report|ROSE Audit Report/i)).toHaveCount(0);
  await expect(main.getByText(/\b(Acumatica|ERP|inventory|PO|purchase order|manual variance)\b/i)).toHaveCount(0);
  await page.getByRole('main').getByRole('button', { name: 'More' }).first().click();
  await page.getByRole('menuitem', { name: 'All Sites' }).click();
  const allSites = page.getByRole('table', { name: 'Consignment sites' });
  await expect(allSites).toBeVisible();
  await expect(allSites.getByRole('columnheader')).toHaveCount(6);
  for (const header of ['Account / Site', 'Status', 'Team', 'Next ROSE', 'Site issue']) {
    await expect(allSites.getByRole('columnheader', { name: header })).toBeVisible();
  }
  await expect(page.getByRole('main').getByRole('heading', {
    name: /Onboarding Report|ROSE Audit Report/i,
  })).toHaveCount(0);

  await page.goto(`/consignment/${fixtures.consignment.siteId}`);
  const detailMain = page.getByRole('main');
  await expect(page.getByTestId('consignment-site-detail')).toBeVisible();
  await expect(page.getByTestId('consignment-current-site-work')).toBeVisible();
  await expect(page.getByTestId('consignment-site-snapshot')).toBeVisible();
  await expect(detailMain.getByRole('table')).toHaveCount(0);
  await expect(detailMain.getByRole('heading', {
    name: /Documents|Audit History|Reviewed Field Notes/i,
  })).toHaveCount(0);
  await expect(detailMain.getByText('Site details and evidence')).toBeVisible();
  await expect(detailMain.getByText('Next ROSE Audit')).not.toBeVisible();
  await expect(detailMain.getByText('Agreement Forms')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Finish audit' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: 'More' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Finish audit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Finish audit' });
  await expect(dialog.getByRole('button', { name: 'No issue' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Log site issue' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: /Add Agreement|Confirm baseline|Mark Active|Schedule ROSE/ })).toHaveCount(0);
});

test('UX-03 detail hotspots keep secondary actions behind menus', async ({ page }) => {
  const fixtures = await readFixtures();

  await loginWithCredentials(page, fixtures.internalAuth.email, fixtures.internalAuth.password);

  await page.goto(`/leads/${fixtures.cis.leadId}`);
  await expect(page.getByRole('heading', { name: fixtures.cis.companyName })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Secondary Actions' })).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('button', {
    name: /Open (Discovery Workspace|CIS Workspace|Onboarding Readiness|Finance Queue)/,
  })).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('button', {
    name: /Park lead|Close lead|Reopen lead|Resume lead/i,
  })).toHaveCount(0);
  await page.getByRole('main').getByRole('button', { name: 'More' }).first().click();
  await expect(page.getByRole('menuitem', { name: 'Discovery workspace' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'CIS workspace' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Onboarding readiness' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Park lead' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Close lead' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tab', { name: 'Discovery' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'CIS, Finance & Setup' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Onboarding Readiness' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Work' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('lead-work-flow')).toBeVisible();
  await expect(page.getByTestId('lead-next-best-action-card')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'General Information' })).not.toBeVisible();
  await page.getByRole('tab', { name: 'Details' }).click();
  await expect(page.getByRole('heading', { name: 'General Information' })).toBeVisible();

  await page.goto(`/customers/${fixtures.customer.accountId}`);
  await expect(page.getByRole('heading', { name: fixtures.customer.displayName })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Source Lead' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Activity & Docs|Payment Methods|Training|Dealer Portal/ })).toHaveCount(0);
  await page.getByRole('tablist').getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('menuitem', { name: 'Account readiness' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Consignment' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'View Source Lead' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Activity & Docs' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Dealer Portal' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /Mark At Risk|Mark Inactive|Confirm Churn|Reactivate/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Lifecycle actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Mark at risk' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Mark inactive' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Confirm churn' })).toBeVisible();
  await page.keyboard.press('Escape');

  await writeReport('detail-hotspots-report.json', [
    { slug: 'lead-detail', result: 'secondary tab shortcuts moved to More' },
    { slug: 'account-detail', result: 'lifecycle actions moved to More and source lead link deduped' },
  ]);
});

test('UX-06 Slice B Accounts and Calendar stay operator-first', async ({ page }) => {
  const fixtures = await readFixtures();

  await loginWithCredentials(page, fixtures.internalAuth.email, fixtures.internalAuth.password);

  await page.goto('/customers');
  await expect(page.getByRole('heading', { name: 'Account Management' })).toBeVisible();
  await expect(page.getByText('Account follow-up queue')).toBeVisible();
  await expect(page.getByText('All accounts', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Account summary')).toHaveCount(0);
  await page.getByText(/All accounts \(/).click();
  await expect(page.getByText('All accounts', { exact: true })).toBeVisible();

  await page.goto(`/customers/${fixtures.customer.accountId}`);
  await expect(page.getByRole('heading', { name: fixtures.customer.displayName })).toBeVisible();
  await expect(page.getByRole('heading', { name: "Today's Account Focus" })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Activity & Docs|Payment Methods|Training|Dealer Portal/ })).toHaveCount(0);
  await expect(page.getByText('Readiness, handoff, and parked dependencies')).toHaveCount(0);
  await page.getByRole('tablist').getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('menuitem', { name: 'Account readiness' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Activity & Docs' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Dealer Portal' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: 'CRM Calendar' })).toBeVisible();
  await expect(page.getByText('Day health')).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText(/Google Calendar|Outlook/i);
  await expect(page.getByText('Event detail', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open linked record' })).toHaveCount(0);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Month view' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'List view' })).toBeVisible();
});

test('UX-03 product and asset detail surfaces keep review work in context', async ({ page }) => {
  const fixtures = await readFixtures();
  const report = [];

  await loginWithCredentials(page, fixtures.internalAuth.email, fixtures.internalAuth.password);

  await page.goto(`/product-management/products/${fixtures.product.productId}`);
  await expect(page.getByRole('heading', { name: fixtures.product.displayName })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Product publish checklist' })).toBeVisible();
  await expect(page.getByText('Catalog section')).toBeVisible();
  await expect(page.getByText('SKU family')).toBeVisible();
  await page.getByLabel('Product readiness sections').getByText('Files', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Approved files' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Last Publish State' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Selection' })).toHaveCount(0);

  const filesPanel = page
    .getByRole('heading', { name: 'Approved files' })
    .locator('xpath=ancestor::*[contains(@class, "mantine-Paper-root")][1]');
  const fileActionMenu = filesPanel.getByRole('button', { name: 'Row actions' }).first();
  if (await fileActionMenu.count()) {
    await expect(fileActionMenu).toBeVisible();
    await fileActionMenu.click();
    await expect(page.getByRole('menuitem', { name: 'Unlink file' })).toBeVisible();
    await page.keyboard.press('Escape');
  }
  await page.getByLabel('Product readiness sections').getByText('Visibility', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Visibility' })).toBeVisible();
  report.push({ slug: 'product-detail', result: 'file unlink moved to row menu and duplicate publish card removed' });

  await page.goto('/digital-assets?tab=delivery-health');
  await expect(page.getByRole('heading', { name: 'Digital Assets' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review Items' })).toBeVisible();
  const deliveryRowMenu = page.getByRole('button', { name: 'Row actions' }).first();
  if (await deliveryRowMenu.count()) {
    await deliveryRowMenu.click();
    await page.getByRole('menuitem', { name: 'Review asset' }).click();
    await expect(page.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: /Product usage/ })).toHaveAttribute('aria-expanded', 'false');
  }
  report.push({ slug: 'digital-assets', result: 'delivery review navigates to visible asset detail and passive usage starts collapsed' });

  await writeReport('product-asset-detail-report.json', report);
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
    page.waitForURL((url) => !url.pathname.startsWith('/auth')),
    page.getByRole('button', { name: 'Sign in', exact: true }).click(),
  ]);
}

async function withInternalPersona(browser, persona, callback) {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3101', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  try {
    await loginWithCredentials(page, persona.email, persona.password);
    await callback(page);
  } finally {
    await closeContextBestEffort(context);
  }
}

async function closeContextBestEffort(context) {
  await Promise.race([
    context.close().catch(() => undefined),
    new Promise((resolve) => {
      setTimeout(resolve, 5000);
    }),
  ]);
}

async function openHeaderMoreItem(page, menuItemName) {
  await page.getByRole('main').getByRole('button', { name: 'More' }).first().click();
  await page.getByRole('menuitem', { name: menuItemName }).click();
}

async function captureDialogBudget(page, slug, title) {
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: path.join(depthOutputDir, `${slug}.png`) });

  const budget = await dialog.evaluate((root, currentBudget) => {
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
        && rect.height > 0;
    };
    const readableLabel = (element) => [
      element.getAttribute('aria-label'),
      element.textContent,
      element.getAttribute('title'),
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    const buttons = elements.filter((element) => (
      isVisible(element)
        && (element.tagName.toLowerCase() === 'button' || element.getAttribute('role') === 'button')
        && readableLabel(element).length > 0
    ));
    const primaryButtons = buttons.filter((element) => {
      const variant = element.getAttribute('data-variant') ?? '';
      const className = String(element.getAttribute('class') ?? '');
      return ['filled', 'gradient'].includes(variant) || /filled|gradient|primary/i.test(className);
    });
    const emptyMessages = elements.filter((element) => {
      if (!isVisible(element)) {
        return false;
      }
      const text = readableLabel(element).toLowerCase();
      if (!text || text.length > 180) {
        return false;
      }
      return /\b(no|none|empty|unavailable|not configured|not yet|nothing)\b/.test(text);
    });
    const summarize = (items) => items.slice(0, 6).map((element) => ({
      label: readableLabel(element).slice(0, 90),
      role: element.getAttribute('role') ?? element.tagName.toLowerCase(),
    }));
    return {
      buttons: buttons.length,
      primaryButtons: primaryButtons.length,
      emptyMessages: emptyMessages.length,
      samples: {
        buttons: summarize(buttons),
        primaryButtons: summarize(primaryButtons),
        emptyMessages: summarize(emptyMessages),
      },
      budget: currentBudget,
    };
  }, dialogBudget);

  expect.soft(budget.buttons, `${slug} button samples: ${formatSamples(budget.samples.buttons)}`)
    .toBeLessThanOrEqual(dialogBudget.maxDialogButtons);
  expect.soft(budget.primaryButtons, `${slug} primary samples: ${formatSamples(budget.samples.primaryButtons)}`)
    .toBeLessThanOrEqual(dialogBudget.maxPrimaryButtons);
  expect.soft(budget.emptyMessages, `${slug} empty samples: ${formatSamples(budget.samples.emptyMessages)}`)
    .toBeLessThanOrEqual(dialogBudget.maxEmptyMessages);

  return { slug, title, ...budget };
}

async function capturePageBudget(page, slug) {
  await page.screenshot({ path: path.join(depthOutputDir, `${slug}.png`) });
  const budget = await page.locator('main').evaluate(() => {
    const viewportHeight = window.innerHeight;
    const elements = Array.from(document.querySelector('main')?.querySelectorAll('*') ?? []);
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
        && rect.top < viewportHeight;
    };
    const buttons = elements.filter((element) => (
      isVisible(element)
        && element.tagName.toLowerCase() === 'button'
        && !element.closest('[role="tablist"], [role="menu"]')
    ));
    const tabs = elements.filter((element) => isVisible(element) && element.getAttribute('role') === 'tab');
    return {
      visibleButtons: buttons.length,
      visibleTabs: tabs.length,
    };
  });

  expect.soft(budget.visibleTabs, `${slug} should keep setup/calendar behind More`).toBeLessThanOrEqual(4);
  expect.soft(budget.visibleButtons, `${slug} should remain action-light for scoped users`).toBeLessThanOrEqual(4);

  return { slug, ...budget };
}

async function writeReport(filename, report) {
  await fs.writeFile(path.join(depthOutputDir, filename), JSON.stringify(report, null, 2), 'utf8');
}

function formatSamples(samples) {
  if (!samples.length) {
    return 'none';
  }
  return samples.map((sample) => `${sample.role}:${sample.label || '(unlabelled)'}`).join(' | ');
}
