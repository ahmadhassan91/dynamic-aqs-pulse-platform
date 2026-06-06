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
