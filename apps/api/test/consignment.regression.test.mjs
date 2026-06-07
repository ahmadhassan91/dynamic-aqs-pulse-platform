import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let service;
let handleConsignmentRoutes;
let ensureReferenceDataSeeded;
let ensureLeadRoutingPolicySeeded;
let ensureWebsiteLeadConfigSeeded;
let ensureTerritoryPolicySeeded;
let ensureBootstrapAdminSeeded;
let loginWithPassword;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  const configModule = await import('../dist/config.js');
  ({ handleConsignmentRoutes } = await import('../dist/modules/consignment/http.js'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureLeadRoutingPolicySeeded, ensureWebsiteLeadConfigSeeded } = await import('../dist/modules/leads/service.js'));
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));
  service = await import('../dist/modules/consignment/service.js');
  config = configModule.loadAppConfig(process.env);
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) await prisma.$disconnect();
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
  await ensureReferenceDataSeeded();
  await ensureLeadRoutingPolicySeeded();
  await ensureWebsiteLeadConfigSeeded();
  await ensureTerritoryPolicySeeded();
  await ensureBootstrapAdminSeeded(config);
});

async function createAdminAuth() {
  return loginWithPassword(
    config,
    {
      email: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD,
    },
    {},
  );
}

async function createAdminActor() {
  const auth = await createAdminAuth();
  return {
    userId: auth.identity.userId,
    sessionId: auth.session.sessionId,
    role: auth.identity.role,
    actorType: auth.identity.actorType,
    email: auth.identity.email,
    displayName: auth.identity.displayName,
  };
}

async function createScopedActor(role, suffix) {
  const user = await prisma.user.create({
    data: {
      email: `${role.toLowerCase().replaceAll('_', '-')}-${suffix}@pulse.local`,
      displayName: `${role} ${suffix}`,
      roleCode: role,
      userType: 'INTERNAL',
      isActive: true,
    },
  });
  return {
    userId: user.id,
    sessionId: `test-${user.id}`,
    role,
    actorType: 'internal',
    email: user.email,
    displayName: user.displayName,
  };
}

async function createConsignmentAccountFixture(suffix = 'foundation') {
  const tm = await prisma.user.create({
    data: {
      email: `tm-consignment-${suffix}@pulse.local`,
      displayName: `TM Consignment ${suffix}`,
      roleCode: 'TERRITORY_MANAGER',
      userType: 'INTERNAL',
      isActive: true,
    },
  });
  const rd = await prisma.user.create({
    data: {
      email: `rd-consignment-${suffix}@pulse.local`,
      displayName: `RD Consignment ${suffix}`,
      roleCode: 'REGIONAL_DIRECTOR',
      userType: 'INTERNAL',
      isActive: true,
    },
  });
  const account = await prisma.account.create({
    data: {
      displayName: `Consignment Regression ${suffix}`,
      legalName: `Consignment Regression ${suffix} LLC`,
      accountType: 'Dealer',
      assignedTmUserId: tm.id,
      assignedRdUserId: rd.id,
      isActive: true,
      locations: {
        create: {
          name: 'Primary warehouse',
          line1: '900 Blue Line Road',
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

async function withConsignmentRuntime(callback) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const handled = await handleConsignmentRoutes(req, res, url, config);
    if (handled === false) {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('site master creates account-linked consignment site without Acumatica warehouse truth', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('site-master');

  const site = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Dallas primary consignment site',
    ownerTmUserId: fixture.tm.id,
    ownerRdUserId: fixture.rd.id,
  });

  assert.equal(site.accountId, fixture.account.id);
  assert.equal(site.locationId, fixture.location.id);
  assert.equal(site.status, 'onboarding_in_progress');
  assert.equal(site.acumaticaStatus, 'parked');
  assert.equal(site.acumaticaWarehouseId, undefined);

  const detail = await service.getConsignmentSiteDetail(actor, site.id);
  assert.equal(detail.accountName, fixture.account.displayName);
  assert.equal(detail.locationName, 'Primary warehouse');

  const listed = await service.listConsignmentSites(actor, { search: 'Dallas primary' });
  assert.deepEqual(listed.items.map((item) => item.id), [site.id]);

  const readModel = await service.getAccountConsignmentReadModel(actor, fixture.account.id);
  assert.equal(readModel.participatesInConsignment, true);
  assert.deepEqual(readModel.sites.map((item) => item.id), [site.id]);

  const audit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'CONSIGNMENT_SITE',
      entityId: site.id,
      action: 'CREATE',
    },
  });
  assert.ok(audit);
});

test('form register tracks agreement and BLUE evidence with readiness impact', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('forms');
  const site = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Forms regression site',
  });

  const agreement = await service.upsertConsignmentDocument(actor, site.id, {
    formType: 'agreement',
    status: 'signed',
    title: 'Program Agreement',
    documentUrl: 'manual/agreement-v1.pdf',
  });
  const blue = await service.upsertConsignmentDocument(actor, site.id, {
    formType: 'blue',
    status: 'signed',
    title: 'BLUE Verification',
    signedAt: '2026-04-30T14:00:00.000Z',
  });

  assert.equal(agreement.status, 'signed');
  assert.equal(blue.status, 'signed');

  const forms = await service.listConsignmentDocuments(actor, site.id);
  assert.deepEqual(forms.map((form) => form.formType).sort(), ['agreement', 'blue']);

  const readinessItems = await service.listConsignmentReadinessItems(actor, site.id);
  assert.ok(readinessItems.find((item) => item.code === 'agreement_signed').status === 'complete');
  assert.ok(readinessItems.find((item) => item.code === 'blue_baseline').status === 'complete');
});

test('document updates preserve one current version per site/form type and persist contract date fields', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('document-current');
  const site = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Document current regression site',
  });

  const agreementV1 = await service.upsertConsignmentDocument(actor, site.id, {
    formType: 'agreement',
    status: 'signed',
    title: 'Program Agreement v1',
    version: 1,
  });
  const agreementV2 = await service.upsertConsignmentDocument(actor, site.id, {
    formType: 'agreement',
    status: 'signed',
    title: 'Program Agreement v2',
    version: 2,
  });

  let forms = await service.listConsignmentDocuments(actor, site.id);
  assert.equal(forms.find((form) => form.id === agreementV1.id).isCurrent, false);
  assert.equal(forms.find((form) => form.id === agreementV2.id).isCurrent, true);

  const restored = await service.updateConsignmentDocument(actor, agreementV1.id, {
    isCurrent: true,
    receivedAt: '2026-04-29T10:00:00.000Z',
    signedAt: '2026-04-30T10:00:00.000Z',
  });
  assert.equal(restored.isCurrent, true);
  assert.equal(restored.receivedAt, '2026-04-29T10:00:00.000Z');
  assert.equal(restored.signedAt, '2026-04-30T10:00:00.000Z');

  forms = await service.listConsignmentDocuments(actor, site.id);
  assert.equal(forms.find((form) => form.id === agreementV1.id).isCurrent, true);
  assert.equal(forms.find((form) => form.id === agreementV2.id).isCurrent, false);
});

test('BLUE document update establishes baseline and active gate accepts same-request warehouse reference', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('activation-gates');
  const site = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Activation gate regression site',
  });

  await service.upsertConsignmentDocument(actor, site.id, {
    formType: 'agreement',
    status: 'signed',
    title: 'Program Agreement',
  });
  const blue = await service.upsertConsignmentDocument(actor, site.id, {
    formType: 'blue',
    status: 'draft',
    title: 'BLUE Verification',
  });

  await assert.rejects(
    service.updateConsignmentSite(actor, site.id, { status: 'active', warehouseCode: 'MANUAL-PENDING-CERTIFICATION' }),
    /BLUE baseline evidence/i,
  );

  const signedBlue = await service.updateConsignmentDocument(actor, blue.id, {
    status: 'signed',
    signedAt: '2026-04-30T14:00:00.000Z',
  });
  assert.equal(signedBlue.status, 'signed');
  assert.equal(signedBlue.signedAt, '2026-04-30T14:00:00.000Z');

  const activated = await service.updateConsignmentSite(actor, site.id, {
    status: 'active',
    warehouseCode: 'MANUAL-PENDING-CERTIFICATION',
  });
  assert.equal(activated.status, 'active');
  assert.equal(activated.warehouseCode, 'MANUAL-PENDING-CERTIFICATION');
  assert.equal(activated.baselineEstablishedAt, '2026-04-30T14:00:00.000Z');
});

test('onboarding transitions keep warehouse and baseline boundaries visible before active', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('onboarding');
  const site = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Onboarding regression site',
  });

  const warehouseReady = await service.updateConsignmentSite(actor, site.id, {
    status: 'ready_for_warehouse',
    notes: 'Agreement and readiness review complete.',
  });
  assert.equal(warehouseReady.status, 'ready_for_warehouse');

  await assert.rejects(
    service.updateConsignmentSite(actor, site.id, { status: 'active' }),
    /warehouse|baseline|active/i,
  );

  const readinessItems = await service.listConsignmentReadinessItems(actor, site.id);
  assert.ok(readinessItems.some((item) => item.code === 'warehouse_boundary' && item.status === 'blocked'));
});

test('RBAC denies consignment management to roles without consignment.manage', SERIAL, async () => {
  const actor = await createScopedActor('SALES_BD_REP', 'denied');
  const fixture = await createConsignmentAccountFixture('rbac');

  await assert.rejects(
    service.createConsignmentSite(actor, {
      accountId: fixture.account.id,
      locationId: fixture.location.id,
      name: 'Denied consignment site',
    }),
    /consignment\.manage|cannot perform|cannot access|not authorized/i,
  );
});

test('TM and RD scoped reads and audit mutations deny unassigned consignment sites', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('scope-denial');
  const outsiderTm = await createScopedActor('TERRITORY_MANAGER', 'scope-denial');
  const outsiderRd = await createScopedActor('REGIONAL_DIRECTOR', 'scope-denial');
  const site = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Scoped denial regression site',
    ownerTmUserId: fixture.tm.id,
    ownerRdUserId: fixture.rd.id,
  });
  const scheduled = await service.createConsignmentAudit(actor, site.id, {
    scheduledFor: '2026-06-30T00:00:00.000Z',
  });

  assert.equal(await service.getConsignmentSiteDetail(outsiderTm, site.id), null);
  assert.equal(await service.getAccountConsignmentReadModel(outsiderTm, fixture.account.id), null);
  assert.equal((await service.listConsignmentSites(outsiderRd, { includeClosed: true })).total, 0);

  await assert.rejects(
    service.updateConsignmentAudit(outsiderTm, scheduled.id, { status: 'cancelled' }),
    /not found/i,
  );
});

test('account consignment read model counts statuses without page-limit truncation', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('account-counts');

  const activeSite = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Active count site',
    warehouseCode: 'MANUAL-PENDING-CERTIFICATION',
  });
  await service.upsertConsignmentDocument(actor, activeSite.id, { formType: 'agreement', status: 'signed' });
  await service.upsertConsignmentDocument(actor, activeSite.id, {
    formType: 'blue',
    status: 'signed',
    signedAt: '2026-04-30T14:00:00.000Z',
  });
  await service.updateConsignmentSite(actor, activeSite.id, { status: 'active' });

  await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Onboarding count site',
  });
  const exitedSite = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Exited count site',
  });
  await service.updateConsignmentSite(actor, exitedSite.id, { status: 'exited' });

  const readModel = await service.getAccountConsignmentReadModel(actor, fixture.account.id);
  assert.equal(readModel.activeSiteCount, 1);
  assert.equal(readModel.onboardingSiteCount, 1);
  assert.equal(readModel.exitedSiteCount, 1);
  assert.equal(readModel.participatesInConsignment, true);
});

test('ROSE audit scheduler resets due date and gates PO follow-up behind true-up review', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('audit-scheduler');
  const site = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Audit scheduler regression site',
    warehouseCode: 'MANUAL-PENDING-CERTIFICATION',
  });

  const scheduled = await service.createConsignmentAudit(actor, site.id, {
    scheduledFor: '2026-06-30T00:00:00.000Z',
    notes: 'Initial ROSE cadence from BLUE baseline.',
  });
  assert.equal(scheduled.status, 'scheduled');

  const completed = await service.updateConsignmentAudit(actor, scheduled.id, {
    status: 'completed',
    completedAt: '2026-07-02T16:30:00.000Z',
    lines: [
      {
        sku: 'DAQS-1',
        productName: 'Dynamic Filter',
        expectedQuantity: 10,
        actualQuantity: 8,
      },
    ],
  });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.reconciliationStatus, 'open');

  const detail = await service.getConsignmentSiteDetail(actor, site.id);
  assert.equal(detail.nextAuditDueAt, '2026-09-30T16:30:00.000Z');
  assert.equal(detail.openDiscrepancyCount, 1);
  assert.ok(detail.workItems.some((item) => item.type === 'variance_review'));
  assert.equal(detail.workItems.some((item) => item.type === 'po_follow_up'), false);

  await service.updateConsignmentAudit(actor, scheduled.id, {
    status: 'completed',
    completedAt: '2026-07-02T16:30:00.000Z',
    lines: [
      {
        sku: 'DAQS-1',
        productName: 'Dynamic Filter',
        expectedQuantity: 10,
        actualQuantity: 8,
      },
    ],
  });
  const retriedDetail = await service.getConsignmentSiteDetail(actor, site.id);
  assert.equal(retriedDetail.openDiscrepancyCount, 1);
  assert.equal(retriedDetail.workItems.filter((item) => item.type === 'variance_review').length, 1);
  assert.equal(retriedDetail.workItems.filter((item) => item.type === 'po_follow_up').length, 0);

  const trueUp = await service.confirmConsignmentTrueUp(actor, scheduled.id, {
    outcome: 'po_required',
    confirmedAt: '2026-07-03T14:00:00.000Z',
    reasonCode: 'confirmed_consumed',
    notes: 'Open POs and in-transit transfers reviewed.',
  });
  assert.equal(trueUp.audit.reconciliationStatus, 'true_up_confirmed');

  const trueUpDetail = await service.getConsignmentSiteDetail(actor, site.id);
  assert.equal(trueUpDetail.openDiscrepancyCount, 1);
  assert.equal(trueUpDetail.workItems.filter((item) => item.type === 'variance_review' && item.status === 'completed').length, 1);
  const poItems = trueUpDetail.workItems.filter((item) => item.type === 'po_follow_up');
  assert.equal(poItems.length, 1);
  assert.equal(poItems[0].dueAt, '2026-07-10T14:00:00.000Z');

  await service.confirmConsignmentTrueUp(actor, scheduled.id, {
    outcome: 'po_required',
    confirmedAt: '2026-07-03T14:00:00.000Z',
    reasonCode: 'confirmed_consumed',
  });
  const retriedTrueUpDetail = await service.getConsignmentSiteDetail(actor, site.id);
  assert.equal(retriedTrueUpDetail.workItems.filter((item) => item.type === 'po_follow_up').length, 1);
});

test('ROSE audit evidence upload stores CRM-owned photo evidence outside Acumatica', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('audit-evidence');
  const site = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Evidence consignment site',
    ownerTmUserId: fixture.tm.id,
    ownerRdUserId: fixture.rd.id,
  });
  const scheduled = await service.createConsignmentAudit(actor, site.id, {
    scheduledFor: '2026-05-20T10:00:00.000Z',
  });

  const response = await service.uploadConsignmentAuditEvidence(actor, config, scheduled.id, {
    purpose: 'discrepancy',
    fileName: 'rose-count-shelf.jpg',
    mimeType: 'image/jpeg',
    contentBase64: Buffer.from('fake photo bytes for regression').toString('base64'),
  });

  assert.equal(response.evidence.purpose, 'discrepancy');
  assert.equal(response.audit.evidenceCount, 1);
  assert.equal(response.audit.discrepancyEvidenceCount, 1);
  assert.match(response.evidence.storageKey, /^consignment\/audits\/.+\/evidence\/.+rose-count-shelf\.jpg$/);
  assert.equal(existsSync(path.join(config.storage.rootDir, response.evidence.storageKey)), true);

  const auditEntry = await prisma.auditEntry.findFirst({
    where: { entityType: 'CONSIGNMENT_AUDIT_EVIDENCE', entityId: response.evidence.id },
  });
  assert.equal(auditEntry.metadata.acumaticaBoundary, 'not_an_acumatica_attachment');
});

test('operational queue honors auditStatus filter from the HTTP contract', SERIAL, async () => {
  const actor = await createAdminActor();
  const scheduledFixture = await createConsignmentAccountFixture('queue-scheduled');
  const completedFixture = await createConsignmentAccountFixture('queue-completed');
  const scheduledSite = await service.createConsignmentSite(actor, {
    accountId: scheduledFixture.account.id,
    locationId: scheduledFixture.location.id,
    name: 'Scheduled audit queue site',
  });
  const completedSite = await service.createConsignmentSite(actor, {
    accountId: completedFixture.account.id,
    locationId: completedFixture.location.id,
    name: 'Completed audit queue site',
  });
  await service.createConsignmentAudit(actor, scheduledSite.id, {
    scheduledFor: '2026-06-30T00:00:00.000Z',
  });
  const completedAudit = await service.createConsignmentAudit(actor, completedSite.id, {
    scheduledFor: '2026-06-30T00:00:00.000Z',
  });
  await service.updateConsignmentAudit(actor, completedAudit.id, {
    status: 'completed',
    completedAt: '2026-07-02T16:30:00.000Z',
  });

  const queue = await service.listConsignmentOperationalQueue(actor, { auditStatus: 'completed' });
  assert.deepEqual(queue.items.map((item) => item.id), [completedSite.id]);
  assert.equal(queue.total, 1);
});

test('consignment API routes create, read, filter, and gate workflow resources', SERIAL, async () => {
  const auth = await createAdminAuth();
  const fixture = await createConsignmentAccountFixture('api-routes');

  await withConsignmentRuntime(async (baseUrl) => {
    const unauthorized = await fetch(`${baseUrl}/api/v1/consignment/sites`);
    assert.equal(unauthorized.status, 401);

    const createResponse = await fetch(`${baseUrl}/api/v1/consignment/sites`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        accountId: fixture.account.id,
        locationId: fixture.location.id,
        name: 'Route API regression site',
      }),
    });
    const created = await createResponse.json();
    assert.equal(createResponse.status, 201, JSON.stringify(created));
    assert.equal(created.accountId, fixture.account.id);
    assert.equal(created.status, 'onboarding_in_progress');

    const listResponse = await fetch(`${baseUrl}/api/v1/consignment/sites?search=Route%20API&limit=5`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });
    assert.equal(listResponse.status, 200);
    const listed = await listResponse.json();
    assert.equal(listed.total, 1);
    assert.deepEqual(listed.items.map((item) => item.id), [created.id]);

    const readinessResponse = await fetch(`${baseUrl}/api/v1/consignment/sites/${created.id}/readiness`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });
    assert.equal(readinessResponse.status, 200);
    const readiness = await readinessResponse.json();
    assert.ok(readiness.items.some((item) => item.code === 'warehouse_boundary' && item.status === 'blocked'));

    const documentResponse = await fetch(`${baseUrl}/api/v1/consignment/sites/${created.id}/documents`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        formType: 'agreement',
        status: 'signed',
        title: 'Route agreement',
      }),
    });
    assert.equal(documentResponse.status, 201);
    const document = await documentResponse.json();
    assert.equal(document.formType, 'agreement');

    const activationResponse = await fetch(`${baseUrl}/api/v1/consignment/sites/${created.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status: 'active',
      }),
    });
    assert.equal(activationResponse.status, 400);
    const activationPayload = await activationResponse.json();
    assert.match(String(activationPayload.detail), /warehouse|baseline|active/i);

    const auditResponse = await fetch(`${baseUrl}/api/v1/consignment/sites/${created.id}/audits`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        scheduledFor: '2026-05-20T10:00:00.000Z',
      }),
    });
    assert.equal(auditResponse.status, 201);
    const audit = await auditResponse.json();

    const completedAuditResponse = await fetch(`${baseUrl}/api/v1/consignment/audits/${audit.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status: 'completed',
        completedAt: '2026-05-20T18:00:00.000Z',
        lines: [{
          sku: 'DAQS-ROUTE-1',
          productName: 'Route regression item',
          expectedQuantity: 4,
          actualQuantity: 3,
        }],
      }),
    });
    assert.equal(completedAuditResponse.status, 200);
    const completedAudit = await completedAuditResponse.json();
    assert.equal(completedAudit.reconciliationStatus, 'open');

    const trueUpResponse = await fetch(`${baseUrl}/api/v1/consignment/audits/${audit.id}/true-up`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        outcome: 'resolved_no_po',
        confirmedAt: '2026-05-21T12:00:00.000Z',
        reasonCode: 'in_transit_explained',
        notes: 'Open transfer explained the count difference.',
      }),
    });
    assert.equal(trueUpResponse.status, 200);
    const trueUpPayload = await trueUpResponse.json();
    assert.equal(trueUpPayload.audit.reconciliationStatus, 'resolved');
    assert.equal(trueUpPayload.site.openDiscrepancyCount, 0);

    const evidenceResponse = await fetch(`${baseUrl}/api/v1/consignment/audits/${audit.id}/evidence`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        purpose: 'general',
        fileName: 'mobile-rose-audit.jpg',
        mimeType: 'image/jpeg',
        contentBase64: Buffer.from('mobile evidence bytes').toString('base64'),
      }),
    });
    assert.equal(evidenceResponse.status, 201);
    const evidencePayload = await evidenceResponse.json();
    assert.equal(evidencePayload.audit.evidenceCount, 1);
    assert.equal(evidencePayload.evidence.mimeType, 'image/jpeg');

    const invalidEvidenceResponse = await fetch(`${baseUrl}/api/v1/consignment/audits/${audit.id}/evidence`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        purpose: 'general',
        fileName: 'mobile-rose-audit.pdf',
        mimeType: 'application/pdf',
        contentBase64: Buffer.from('not a supported mobile photo').toString('base64'),
      }),
    });
    assert.equal(invalidEvidenceResponse.status, 400);
    const invalidEvidencePayload = await invalidEvidenceResponse.json();
    assert.match(String(invalidEvidencePayload.detail), /photos only/i);

    const accountResponse = await fetch(`${baseUrl}/api/v1/consignment/accounts/${fixture.account.id}`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });
    assert.equal(accountResponse.status, 200);
    const readModel = await accountResponse.json();
    assert.equal(readModel.participatesInConsignment, true);
    assert.equal(readModel.onboardingSiteCount, 1);
  });
});

test('PURPLE adjustment review preserves baseline until explicit approval', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('purple-adjustment');
  const site = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'PURPLE adjustment regression site',
  });

  const requested = await service.createConsignmentAdjustment(actor, site.id, {
    currentTotal: 10,
    addQuantity: 3,
    removeQuantity: 1,
    reasonCode: 'baseline_correction',
    notes: 'Shelf count corrected by ops.',
  });
  assert.equal(requested.manualBaselineQuantity, undefined);
  assert.equal(requested.formCounts.purple, 1);
  assert.equal(requested.adjustments.length, 1);
  assert.equal(requested.adjustments[0].status, 'requested');
  assert.equal(requested.adjustments[0].proposedTotal, 12);
  assert.ok(requested.workItems.some((item) => item.type === 'adjustment_review' && item.status === 'open'));

  const applied = await service.applyConsignmentAdjustment(actor, requested.adjustments[0].id, {
    appliedAt: '2026-08-01T12:00:00.000Z',
    notes: 'Approved by operations.',
  });
  assert.equal(applied.manualBaselineQuantity, 12);
  assert.equal(applied.baselineEstablishedAt, '2026-08-01T12:00:00.000Z');
  assert.equal(applied.adjustments[0].status, 'applied');
  assert.ok(applied.workItems.some((item) => item.type === 'adjustment_review' && item.status === 'completed'));

  await assert.rejects(
    service.createConsignmentAdjustment(actor, site.id, {
      currentTotal: 12,
      addQuantity: 0,
      removeQuantity: 0,
    }),
    /must change/i,
  );
});

test('SAND exit records notice before closure and excludes exited sites unless requested', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('sand-exit');
  const site = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'SAND exit regression site',
  });

  const notice = await service.startConsignmentExit(actor, site.id, {
    noticeGivenAt: '2026-08-05T14:00:00.000Z',
    plannedExitAt: '2026-08-12T14:00:00.000Z',
    notes: 'Customer gave program exit notice.',
  });
  assert.equal(notice.status, 'exiting');
  assert.equal(notice.exitedAt, undefined);
  assert.equal(notice.formCounts.sand, 1);
  assert.equal(notice.exits.length, 1);
  assert.equal(notice.exits[0].status, 'notice_given');
  assert.ok(notice.workItems.some((item) => item.type === 'exit_review' && item.status === 'open'));

  await assert.rejects(
    service.closeConsignmentExit(actor, notice.exits[0].id, {
      finalReconciliationAt: '2026-08-12T18:00:00.000Z',
      returnQuantity: 0,
      retainedQuantity: 0,
    }),
    /return quantity|retained quantity|settlement/i,
  );

  const closed = await service.closeConsignmentExit(actor, notice.exits[0].id, {
    finalReconciliationAt: '2026-08-12T18:00:00.000Z',
    returnQuantity: 4,
    retainedQuantity: 1,
    settlementReference: 'SETTLE-42',
    notes: 'Final manual reconciliation complete.',
  });
  assert.equal(closed.status, 'exited');
  assert.equal(closed.exitedAt, '2026-08-12T18:00:00.000Z');
  assert.equal(closed.exits[0].status, 'closed');
  assert.ok(closed.workItems.some((item) => item.type === 'exit_review' && item.status === 'completed'));

  const hidden = await service.listConsignmentSites(actor, {});
  assert.equal(hidden.items.some((item) => item.id === site.id), false);
  const included = await service.listConsignmentSites(actor, { includeExited: true });
  assert.equal(included.items.some((item) => item.id === site.id), true);
});

test('PO received and write-off true-up close consignment discrepancy workflows', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('po-received');
  const site = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'PO received regression site',
  });
  const scheduled = await service.createConsignmentAudit(actor, site.id, {
    scheduledFor: '2026-08-20T10:00:00.000Z',
  });
  await service.updateConsignmentAudit(actor, scheduled.id, {
    status: 'completed',
    completedAt: '2026-08-20T18:00:00.000Z',
    lines: [{ sku: 'PO-1', productName: 'PO regression item', expectedQuantity: 6, actualQuantity: 4 }],
  });

  const poTrueUp = await service.confirmConsignmentTrueUp(actor, scheduled.id, {
    outcome: 'po_required',
    confirmedAt: '2026-08-21T12:00:00.000Z',
    reasonCode: 'confirmed_consumed',
    externalPoRef: 'PO-123',
  });
  const poCase = poTrueUp.site.discrepancyCases[0];
  assert.equal(poCase.status, 'po_required');

  const received = await service.markConsignmentPoReceived(actor, poCase.id, {
    receivedAt: '2026-08-22T12:00:00.000Z',
    externalPoRef: 'PO-123',
  });
  assert.equal(received.discrepancyCases[0].status, 'po_received');
  assert.equal(received.discrepancyCases[0].poFollowUpStatus, 'received');
  assert.ok(received.workItems.some((item) => item.type === 'po_follow_up' && item.status === 'completed'));

  const writeOffSite = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Write off regression site',
  });
  const writeOffAudit = await service.createConsignmentAudit(actor, writeOffSite.id, {
    scheduledFor: '2026-08-25T10:00:00.000Z',
  });
  await service.updateConsignmentAudit(actor, writeOffAudit.id, {
    status: 'completed',
    completedAt: '2026-08-25T18:00:00.000Z',
    lines: [{ sku: 'WO-1', productName: 'Write off item', expectedQuantity: 2, actualQuantity: 0 }],
  });
  const writeOff = await service.confirmConsignmentTrueUp(actor, writeOffAudit.id, {
    outcome: 'write_off',
    confirmedAt: '2026-08-26T12:00:00.000Z',
    reasonCode: 'missing_write_off',
    notes: 'Waived after manager review.',
  });
  assert.equal(writeOff.audit.reconciliationStatus, 'resolved');
  assert.equal(writeOff.site.openDiscrepancyCount, 0);
  assert.equal(writeOff.site.discrepancyCases[0].status, 'written_off');
  assert.equal(writeOff.site.discrepancyCases[0].poFollowUpStatus, 'waived');
});

// FR-CSG-031 / FR-CSG-033: when the LAST PO-required discrepancy of an audit is
// marked received, the site baseline must move to that received date and the
// next ROSE must be scheduled +90 days from it. The audit's reconciliation
// status must move to RESOLVED. Multi-discrepancy audits must NOT recalc the
// baseline until every PO-required item is closed.
test('PO received recalculates baseline and schedules next ROSE when audit fully resolved', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('baseline-recalc');

  // Single-discrepancy audit: marking PO received must move the baseline.
  const singleSite = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Single discrepancy site',
  });
  const singleAudit = await service.createConsignmentAudit(actor, singleSite.id, {
    scheduledFor: '2026-09-01T10:00:00.000Z',
  });
  await service.updateConsignmentAudit(actor, singleAudit.id, {
    status: 'completed',
    completedAt: '2026-09-01T18:00:00.000Z',
    lines: [{ sku: 'BL-1', productName: 'Baseline item', expectedQuantity: 5, actualQuantity: 3 }],
  });
  const singleTrueUp = await service.confirmConsignmentTrueUp(actor, singleAudit.id, {
    outcome: 'po_required',
    confirmedAt: '2026-09-02T12:00:00.000Z',
    reasonCode: 'confirmed_consumed',
    externalPoRef: 'PO-BL-1',
  });
  const singlePoCase = singleTrueUp.site.discrepancyCases[0];

  const baselineBefore = singleTrueUp.site.baselineEstablishedAt;
  const nextDueBefore = singleTrueUp.site.nextAuditDueAt;

  const received = await service.markConsignmentPoReceived(actor, singlePoCase.id, {
    receivedAt: '2026-09-05T12:00:00.000Z',
    externalPoRef: 'PO-BL-1',
  });

  assert.equal(received.audits[0].reconciliationStatus, 'resolved');
  assert.notEqual(received.baselineEstablishedAt, baselineBefore);
  assert.equal(received.baselineEstablishedAt, '2026-09-05T12:00:00.000Z');
  const expectedNextDue = new Date('2026-09-05T12:00:00.000Z');
  expectedNextDue.setUTCDate(expectedNextDue.getUTCDate() + 90);
  assert.equal(received.nextAuditDueAt, expectedNextDue.toISOString());
  assert.notEqual(received.nextAuditDueAt, nextDueBefore);

  // Multi-discrepancy audit: closing one of two PO-required items must NOT
  // recalc the baseline yet. Only the second close should.
  const multiSite = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Multi discrepancy site',
  });
  const multiAudit = await service.createConsignmentAudit(actor, multiSite.id, {
    scheduledFor: '2026-09-10T10:00:00.000Z',
  });
  await service.updateConsignmentAudit(actor, multiAudit.id, {
    status: 'completed',
    completedAt: '2026-09-10T18:00:00.000Z',
    lines: [
      { sku: 'MD-1', productName: 'Multi item 1', expectedQuantity: 4, actualQuantity: 2 },
      { sku: 'MD-2', productName: 'Multi item 2', expectedQuantity: 6, actualQuantity: 1 },
    ],
  });
  // Use the multi-line discrepancy form to create two PO_REQUIRED cases.
  const multiTrueUp = await service.confirmConsignmentTrueUp(actor, multiAudit.id, {
    outcome: 'po_required',
    confirmedAt: '2026-09-11T12:00:00.000Z',
    reasonCode: 'confirmed_consumed',
    externalPoRef: 'PO-MD-ALL',
  });
  // The true-up produces a single aggregated discrepancy by current contract.
  // For the multi-discrepancy assertion, manually add a second PO_REQUIRED case
  // on the same audit and confirm the baseline does NOT move when only one is closed.
  const { prisma: prismaModule } = await import('@pulse/db');
  await prismaModule.consignmentDiscrepancyCase.create({
    data: {
      siteId: multiSite.id,
      auditId: multiAudit.id,
      status: 'PO_REQUIRED',
      poFollowUpStatus: 'REQUIRED',
      sku: 'MD-2',
      productName: 'Multi item 2',
      quantity: 5,
      notes: 'Second PO-required case for multi-discrepancy test.',
    },
  });

  const baselineBeforeMulti = multiTrueUp.site.baselineEstablishedAt;
  const nextDueBeforeMulti = multiTrueUp.site.nextAuditDueAt;
  const firstCase = multiTrueUp.site.discrepancyCases[0];

  const partial = await service.markConsignmentPoReceived(actor, firstCase.id, {
    receivedAt: '2026-09-13T12:00:00.000Z',
    externalPoRef: 'PO-MD-1',
  });
  // Closing only one of two leaves baseline and next-due unchanged.
  assert.equal(partial.baselineEstablishedAt, baselineBeforeMulti);
  assert.equal(partial.nextAuditDueAt, nextDueBeforeMulti);
  // The audit should NOT be marked resolved while a PO_REQUIRED case remains.
  assert.notEqual(partial.audits[0].reconciliationStatus, 'resolved');
});

// PRD §4A.5: the dashboard was assembled client-side from a 200-row sample.
// This regression locks in the server-owned shape and confirms the 5 new
// non-Acumatica KPIs (compliance, on-time BLUE, overdue PO, mean PO cycle,
// exit completion) compute correctly while the parked KPI stays parked.
test('server-owned dashboard computes 14 KPIs including 5 new non-Acumatica metrics', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('dashboard-kpis');

  // Build a site with an on-time baseline (within 30 days of creation) and an
  // overdue ROSE audit.
  const site = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Dashboard KPI site',
  });
  const { prisma: prismaModule } = await import('@pulse/db');
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const baselineAt = new Date('2026-01-10T00:00:00.000Z'); // 9 days after creation → on-time
  const overdueDueAt = new Date('2026-04-01T00:00:00.000Z'); // long past now (test runs in future)
  await prismaModule.consignmentSite.update({
    where: { id: site.id },
    data: {
      createdAt,
      status: 'ACTIVE',
      activeSince: baselineAt,
      baselineEstablishedAt: baselineAt,
      nextAuditDueAt: overdueDueAt,
    },
  });

  // Create an overdue PO-required discrepancy linked to a completed audit so
  // overduePoCount and meanPoCycleDays both populate.
  const auditScheduledFor = new Date('2026-03-15T10:00:00.000Z');
  const auditCompletedAt = new Date('2026-03-15T18:00:00.000Z'); // on-time (= scheduled)
  const audit = await prismaModule.consignmentAudit.create({
    data: {
      siteId: site.id,
      scheduledFor: auditScheduledFor,
      completedAt: auditCompletedAt,
      status: 'COMPLETED',
      reconciliationStatus: 'OPEN',
    },
  });
  const trueUpAt = new Date('2026-03-16T12:00:00.000Z');
  const overduePoDueAt = new Date('2026-03-23T12:00:00.000Z');
  await prismaModule.consignmentDiscrepancyCase.create({
    data: {
      siteId: site.id,
      auditId: audit.id,
      status: 'PO_REQUIRED',
      poFollowUpStatus: 'REQUIRED',
      trueUpConfirmedAt: trueUpAt,
      poDueAt: overduePoDueAt,
      sku: 'KPI-1',
      productName: 'KPI item',
      quantity: 3,
    },
  });

  // A separately-RECEIVED case populates meanPoCycleDays: 2 days from true-up to received.
  const cycleReceivedAt = new Date('2026-03-18T12:00:00.000Z');
  await prismaModule.consignmentDiscrepancyCase.create({
    data: {
      siteId: site.id,
      status: 'PO_RECEIVED',
      poFollowUpStatus: 'RECEIVED',
      trueUpConfirmedAt: new Date('2026-03-16T12:00:00.000Z'),
      updatedAt: cycleReceivedAt,
      sku: 'KPI-2',
      productName: 'KPI cycle item',
      quantity: 1,
    },
  });

  // A started exit with no closedAt drives exitCompletionRatePct = 0 (not null).
  await prismaModule.consignmentExit.create({
    data: {
      siteId: site.id,
      status: 'NOTICE_GIVEN',
      noticeGivenAt: new Date(),
    },
  });

  const dashboard = await service.getConsignmentDashboard(actor);

  // Shape assertions.
  assert.ok(dashboard.metrics, 'metrics block returned');
  assert.equal(typeof dashboard.generatedAt, 'string');
  assert.ok(Array.isArray(dashboard.onboardingPipeline));
  assert.ok(Array.isArray(dashboard.auditDueBuckets));
  assert.ok(Array.isArray(dashboard.workQueue));

  // Existing 9 KPIs still present.
  assert.equal(typeof dashboard.metrics.totalSites, 'number');
  assert.equal(typeof dashboard.metrics.activeSites, 'number');
  assert.ok(dashboard.metrics.overdueAudits >= 1, 'overdue audits should include the seeded site');

  // 5 new server-computed KPIs.
  assert.equal(typeof dashboard.metrics.auditComplianceRatePct, 'number');
  assert.equal(dashboard.metrics.auditComplianceRatePct, 100, 'one on-time audit → 100%');
  assert.equal(typeof dashboard.metrics.onTimeFirstBaselinePct, 'number');
  assert.equal(dashboard.metrics.onTimeFirstBaselinePct, 100, 'baseline within 30d of creation → 100%');
  assert.equal(typeof dashboard.metrics.overduePoCount, 'number');
  assert.ok(dashboard.metrics.overduePoCount >= 1, 'overdue PO seeded');
  assert.ok(dashboard.metrics.meanPoCycleDays !== null, 'received case in window → cycle days populated');
  assert.equal(dashboard.metrics.exitCompletionRatePct, 0, 'started-but-not-closed exit → 0%');

  // Parked KPI signal.
  assert.equal(dashboard.metrics.inventoryValueBySiteParked, true, 'parked KPI flag preserved');
});

test('HTTP includeExited query returns exited consignment sites', SERIAL, async () => {
  const auth = await createAdminAuth();
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('include-exited');
  const site = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Include exited regression site',
  });
  await service.updateConsignmentSite(actor, site.id, { status: 'exited' });

  await withConsignmentRuntime(async (baseUrl) => {
    const hiddenResponse = await fetch(`${baseUrl}/api/v1/consignment/sites?search=Include%20exited`, {
      headers: { authorization: `Bearer ${auth.tokens.accessToken}` },
    });
    assert.equal(hiddenResponse.status, 200);
    const hidden = await hiddenResponse.json();
    assert.equal(hidden.total, 0);

    const includedResponse = await fetch(`${baseUrl}/api/v1/consignment/sites?search=Include%20exited&includeExited=true`, {
      headers: { authorization: `Bearer ${auth.tokens.accessToken}` },
    });
    assert.equal(includedResponse.status, 200);
    const included = await includedResponse.json();
    assert.equal(included.total, 1);
    assert.deepEqual(included.items.map((item) => item.id), [site.id]);
  });
});

test('Acumatica boundary remains parked and does not fabricate ERP references', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createConsignmentAccountFixture('acumatica-boundary');
  const site = await service.createConsignmentSite(actor, {
    accountId: fixture.account.id,
    locationId: fixture.location.id,
    name: 'Acumatica boundary regression site',
  });

  const queue = await service.listConsignmentOperationalQueue(actor, {});
  const queued = queue.items.find((item) => item.id === site.id);
  assert.ok(queued);
  assert.equal(queued.acumaticaStatus, 'parked');
  assert.equal(queued.acumaticaWarehouseId, undefined);

  const externalReferences = await prisma.externalReference.count({ where: { entityId: site.id } });
  assert.equal(externalReferences, 0);
});
