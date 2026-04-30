import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootDir = path.resolve(scriptDir, '../../..');

loadRepoEnv();

const { prisma } = await import('@pulse/db');
const { loadAppConfig } = await import('../dist/config.js');
const { ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js');
const {
  ensureLeadOperationalAlertRecipientsSeeded,
  ensureLeadRoutingPolicySeeded,
  ensureWebsiteLeadConfigSeeded,
} = await import('../dist/modules/leads/service.js');
const { ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js');
const { ensureTrainingSeeded } = await import('../dist/modules/training/service.js');
const {
  ensureBootstrapAdminSeeded,
  loginWithPassword,
  authenticateAccessToken,
} = await import('../dist/modules/auth/service.js');
const {
  createConsignmentAudit,
  createConsignmentSite,
  getConsignmentSiteDetail,
  listConsignmentReadinessItems,
  updateConsignmentAudit,
  updateConsignmentSite,
  upsertConsignmentDocument,
} = await import('../dist/modules/consignment/service.js');
const { getCalendarWorkspace } = await import('../dist/modules/calendar/service.js');

const config = loadAppConfig(process.env);
const runId = buildRunId();

await prisma.$connect();

try {
  await seedBaselineData();
  const auth = await loginWithPassword(
    config,
    {
      email: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD,
    },
    {},
  );
  const actor = await authenticateAccessToken(auth.tokens.accessToken);
  assert.ok(actor, 'Bootstrap admin token must authenticate');

  const fixture = await createFixture(runId);
  const site = await createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: `Seeded ROSE Smoke ${runId}`,
    ownerTmUserId: fixture.tm.id,
    ownerRdUserId: fixture.rd.id,
    primaryContactName: 'Samantha Smoke',
    primaryContactEmail: `samantha.smoke+${runId}@pulse.local`,
    notes: 'Created by consignment seeded smoke. Acumatica execution remains parked.',
  });

  await assert.rejects(
    updateConsignmentSite(actor, site.id, { status: 'active' }),
    /signed agreement|BLUE baseline|warehouse reference|active/i,
  );

  await upsertConsignmentDocument(actor, site.id, {
    formType: 'agreement',
    status: 'signed',
    title: 'Seeded Program Agreement',
    signedAt: new Date().toISOString(),
    notes: 'Seeded smoke agreement.',
  });

  const blueSignedAt = new Date().toISOString();
  await upsertConsignmentDocument(actor, site.id, {
    formType: 'blue',
    status: 'signed',
    title: 'Seeded BLUE Baseline',
    signedAt: blueSignedAt,
    notes: 'Seeded smoke baseline.',
  });

  const readyItems = await listConsignmentReadinessItems(actor, site.id);
  assert.ok(readyItems?.some((item) => item.code === 'agreement_signed' && item.status === 'complete'));
  assert.ok(readyItems?.some((item) => item.code === 'blue_baseline' && item.status === 'complete'));

  const activated = await updateConsignmentSite(actor, site.id, {
    status: 'active',
    warehouseCode: `MANUAL-SMOKE-${runId}`,
    notes: 'Activated with manual warehouse reference while Acumatica warehouse creation is parked.',
  });
  assert.equal(activated.status, 'active');
  assert.equal(activated.warehouseCode, `MANUAL-SMOKE-${runId}`);

  const scheduledFor = addDays(new Date(), 7).toISOString();
  const scheduledAudit = await createConsignmentAudit(actor, site.id, {
    scheduledFor,
    notes: 'Seeded smoke ROSE audit.',
  });

  const completedAt = addDays(new Date(), 8).toISOString();
  const completedAudit = await updateConsignmentAudit(actor, scheduledAudit.id, {
    status: 'completed',
    completedAt,
    notes: 'Seeded smoke completion with manual variance.',
    lines: [
      {
        sku: 'DAQS-SMOKE',
        productName: 'Smoke Test Consignment Media',
        expectedQuantity: 12,
        actualQuantity: 10,
        notes: 'Variance intentionally creates manual PO follow-up.',
      },
    ],
  });

  assert.equal(completedAudit.status, 'completed');
  assert.equal(completedAudit.reconciliationStatus, 'open');

  const detail = await getConsignmentSiteDetail(actor, site.id);
  assert.ok(detail, 'Consignment detail must load after seeded workflow');
  assert.equal(detail.openDiscrepancyCount, 1);
  assert.ok(detail.workItems.some((item) => item.type === 'po_follow_up'));

  const calendar = await getCalendarWorkspace(
    actor,
    {
      startDate: addDays(new Date(), 6).toISOString(),
      endDate: addDays(new Date(), 10).toISOString(),
    },
    config,
  );
  const calendarEvent = calendar.items.find((item) => item.sourceModule === 'consignment' && item.sourceRecordId === scheduledAudit.id);
  assert.ok(calendarEvent, 'Durable consignment audit calendar event must be emitted');
  assert.equal(calendarEvent.eventType, 'consignment_audit');

  console.log(JSON.stringify({
    ok: true,
    runId,
    accountId: fixture.account.id,
    siteId: site.id,
    auditId: scheduledAudit.id,
    activatedStatus: activated.status,
    calendarEventId: calendarEvent.id,
    parked: {
      acumaticaWarehouseCreation: true,
      acumaticaPoCreation: true,
    },
  }, null, 2));
} finally {
  await prisma.$disconnect();
}

async function seedBaselineData() {
  await ensureReferenceDataSeeded();
  await ensureLeadRoutingPolicySeeded();
  await ensureLeadOperationalAlertRecipientsSeeded();
  await ensureWebsiteLeadConfigSeeded();
  await ensureTerritoryPolicySeeded();
  await ensureTrainingSeeded();
  await ensureBootstrapAdminSeeded(config);
}

async function createFixture(id) {
  const tm = await prisma.user.create({
    data: {
      email: `tm.consignment.smoke+${id}@pulse.local`,
      displayName: `TM Consignment Smoke ${id}`,
      roleCode: 'TERRITORY_MANAGER',
      userType: 'INTERNAL',
      isActive: true,
    },
  });
  const rd = await prisma.user.create({
    data: {
      email: `rd.consignment.smoke+${id}@pulse.local`,
      displayName: `RD Consignment Smoke ${id}`,
      roleCode: 'REGIONAL_DIRECTOR',
      userType: 'INTERNAL',
      isActive: true,
    },
  });
  const account = await prisma.account.create({
    data: {
      displayName: `Seeded Consignment Smoke ${id}`,
      legalName: `Seeded Consignment Smoke ${id} LLC`,
      accountType: 'Dealer',
      assignedTmUserId: tm.id,
      assignedRdUserId: rd.id,
      isActive: true,
      locations: {
        create: {
          name: 'Seeded Smoke Warehouse',
          line1: '100 ROSE Audit Way',
          city: 'Dallas',
          state: 'TX',
          postalCode: '75201',
          countryCode: 'US',
          isPrimary: true,
        },
      },
    },
    include: {
      locations: true,
    },
  });

  return { account, location: account.locations[0], tm, rd };
}

function loadRepoEnv() {
  if (typeof process.loadEnvFile !== 'function') {
    return;
  }

  for (const envPath of [path.join(repoRootDir, '.env.local'), path.join(repoRootDir, '.env')]) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // Missing env files are fine; config validation will report required values.
    }
  }
}

function buildRunId() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function addDays(value, days) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}
