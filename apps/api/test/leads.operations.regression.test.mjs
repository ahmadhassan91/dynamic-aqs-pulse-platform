import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let loadAppConfig;
let ensureReferenceDataSeeded;
let ensureLeadRoutingPolicySeeded;
let ensureLeadOperationalAlertRecipientsSeeded;
let ensureWebsiteLeadConfigSeeded;
let ensureTerritoryPolicySeeded;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let authenticateAccessToken;
let createLead;
let listLeads;
let getLeadDetail;
let updateLead;
let getLeadOperationalAlertDeliveryAdminSettings;
let listLeadOperationalAlertIntegrationStatuses;
let retryLeadOperationalAlertDeliveries;
let deadLetterLeadOperationalAlertDeliveries;
let updateLeadOperationalAlertQuietHours;
let updateLeadOperationalAlertRecipient;
let processLeadOperationalAlertScanJob;
let processLeadOperationalAlertDeliveryJob;
let createRegion;
let createShippingCenter;
let createTerritory;
let replaceTerritoryCoverage;
let updateTerritoryPolicy;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  ({ loadAppConfig } = await import('../dist/config.js'));
  ({
    ensureReferenceDataSeeded,
  } = await import('../dist/modules/reference/service.js'));
  ({
    ensureLeadRoutingPolicySeeded,
    ensureLeadOperationalAlertRecipientsSeeded,
    ensureWebsiteLeadConfigSeeded,
    createLead,
    listLeads,
    getLeadDetail,
    updateLead,
    getLeadOperationalAlertDeliveryAdminSettings,
    listLeadOperationalAlertIntegrationStatuses,
    retryLeadOperationalAlertDeliveries,
    deadLetterLeadOperationalAlertDeliveries,
    updateLeadOperationalAlertQuietHours,
    updateLeadOperationalAlertRecipient,
    processLeadOperationalAlertScanJob,
    processLeadOperationalAlertDeliveryJob,
  } = await import('../dist/modules/leads/service.js'));
  ({
    ensureTerritoryPolicySeeded,
    createRegion,
    createShippingCenter,
    createTerritory,
    replaceTerritoryCoverage,
    updateTerritoryPolicy,
  } = await import('../dist/modules/territories/service.js'));
  ({
    ensureBootstrapAdminSeeded,
    loginWithPassword,
    authenticateAccessToken,
  } = await import('../dist/modules/auth/service.js'));

  config = loadAppConfig(process.env);
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
  await ensureReferenceDataSeeded();
  await ensureLeadRoutingPolicySeeded();
  await ensureLeadOperationalAlertRecipientsSeeded();
  await ensureWebsiteLeadConfigSeeded();
  await ensureTerritoryPolicySeeded();
  await ensureBootstrapAdminSeeded(config);
});

async function createAdminSession() {
  const auth = await loginWithPassword(
    config,
    {
      email: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD,
    },
    {},
  );

  const actor = await authenticateAccessToken(auth.tokens.accessToken);
  assert.ok(actor, 'expected bootstrap admin actor');
  return { actor, auth };
}

async function createUser(roleCode, email, displayName) {
  return prisma.user.create({
    data: {
      email,
      displayName,
      roleCode,
      userType: 'INTERNAL',
      isActive: true,
    },
  });
}

function actorForUser(user) {
  return {
    userId: user.id,
    sessionId: `test-${user.id}`,
    role: user.roleCode,
    actorType: 'internal',
    email: user.email,
    displayName: user.displayName,
  };
}

function createLeadAlertJob(data = {}) {
  return {
    id: 'job-lead-alert-scan',
    type: 'lead.operational-alert-scan',
    attempts: 1,
    createdAt: new Date().toISOString(),
    signal: AbortSignal.abort(),
    payload: {
      jobType: 'lead.operational-alert-scan',
      triggeredBy: 'system',
      triggerSource: 'scheduler',
      correlationId: 'lead-alert-scan-regression',
      data: {
        limit: 50,
        ...data,
      },
    },
  };
}

function createLeadAlertDeliveryJob(alertId, correlationId = 'lead-alert-delivery-regression') {
  return {
    id: `job-lead-alert-delivery-${alertId}`,
    type: 'lead.operational-alert-delivery',
    attempts: 1,
    createdAt: new Date().toISOString(),
    signal: AbortSignal.abort(),
    payload: {
      jobType: 'lead.operational-alert-delivery',
      triggeredBy: 'worker',
      triggerSource: 'worker',
      correlationId,
      data: {
        alertId,
      },
    },
  };
}

function createLoggerStub() {
  const entries = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  return {
    entries,
    logger: {
      debug: (message, meta) => entries.debug.push({ message, meta }),
      info: (message, meta) => entries.info.push({ message, meta }),
      warn: (message, meta) => entries.warn.push({ message, meta }),
      error: (message, meta) => entries.error.push({ message, meta }),
    },
  };
}

function createQueueStub() {
  const enqueued = [];
  return {
    enqueued,
    queue: {
      enqueue: async (definition, payload) => {
        enqueued.push({ definition, payload });
        return {
          id: `queued-${enqueued.length}`,
          type: typeof definition === 'string' ? definition : definition.name,
          tier: typeof definition === 'string' ? 'STANDARD' : definition.tier,
          correlationId: payload.correlationId,
          enqueuedAt: new Date().toISOString(),
        };
      },
    },
  };
}

async function createPendingRoutingBroadcastAlert(actor, {
  suffix = 'delivery',
  recipientEmail,
} = {}) {
  const sgtLead = await createLead(actor, {
    companyName: `SGT Delivery ${suffix} HVAC`,
    contactDisplayName: `Morgan ${suffix}`,
    email: `morgan.${suffix}@example.com`,
    phone: '555-100-2900',
    state: 'CA',
    serviceTechCount: 3,
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  });

  await prisma.lead.update({
    where: { id: sgtLead.id },
    data: {
      createdAt: new Date(Date.now() - (26 * 3600000)),
      initialContactDueAt: new Date(Date.now() - (2 * 3600000)),
    },
  });

  if (recipientEmail !== undefined) {
    await prisma.leadOperationalAlertRecipient.updateMany({
      where: { routingTeam: 'STRATEGIC_GROWTH', isActive: true },
      data: { email: recipientEmail },
    });
  }

  await processLeadOperationalAlertScanJob(createLeadAlertJob());

  return prisma.leadOperationalAlert.findFirstOrThrow({
    where: {
      leadId: sgtLead.id,
      alertType: 'ROUTING_BROADCAST',
      ...(recipientEmail ? { recipientEmail } : {}),
    },
    orderBy: { recipientName: 'asc' },
  });
}

async function startMicrosoftGraphMock({
  tokenStatus = 200,
  sendMailStatus = 202,
} = {}) {
  const requests = [];

  const server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      requests.push({
        method: req.method,
        pathname: url.pathname,
        headers: req.headers,
        body,
        json: parseJsonBody(body),
      });

      if (req.method === 'POST' && url.pathname.endsWith('/oauth2/v2.0/token')) {
        res.writeHead(tokenStatus, { 'content-type': 'application/json' });
        res.end(JSON.stringify(
          tokenStatus >= 200 && tokenStatus < 300
            ? { access_token: 'graph-access-token', token_type: 'Bearer', expires_in: 3600 }
            : { error: 'invalid_client', error_description: 'Token request failed in test' },
        ));
        return;
      }

      if (req.method === 'POST' && decodeURIComponent(url.pathname).endsWith('/sendMail')) {
        res.writeHead(sendMailStatus, { 'content-type': 'application/json', 'request-id': 'graph-sendmail-request' });
        res.end(sendMailStatus >= 200 && sendMailStatus < 300
          ? ''
          : JSON.stringify({ error: { code: 'ErrorSendMailFailed', message: 'Send mail failed in test' } }));
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object');

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function parseJsonBody(body) {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function createMicrosoftGraphDeliveryConfig(graphServer, overrides = {}) {
  return {
    ...config,
    leads: {
      ...config.leads,
      operationalAlertDeliveryMode: 'microsoft_graph',
      operationalAlertMicrosoftGraph: {
        tenantId: 'pulse-test-tenant',
        clientId: 'pulse-test-client',
        clientSecret: 'pulse-test-secret',
        fromUser: 'alerts@pulse.local',
        authBaseUrl: graphServer?.baseUrl ?? 'http://127.0.0.1:1',
        graphBaseUrl: graphServer?.baseUrl ?? 'http://127.0.0.1:1',
        ...overrides,
      },
    },
  };
}

async function seedTerritoryFixture(actor, suffix = 'ops') {
  const director = await createUser('REGIONAL_DIRECTOR', `rd-${suffix}@pulse.local`, `RD ${suffix}`);
  const manager = await createUser('TERRITORY_MANAGER', `tm-${suffix}@pulse.local`, `TM ${suffix}`);

  const shippingCenter = await createShippingCenter(actor, {
    code: `ship_${suffix}`,
    name: `Shipping ${suffix}`,
    city: 'Dallas',
    state: 'TX',
  });

  const region = await createRegion(actor, {
    code: `region_${suffix}`,
    name: `Region ${suffix}`,
    directorUserId: director.id,
  });

  const territory = await createTerritory(actor, {
    code: `territory_${suffix}`,
    name: `Territory ${suffix}`,
    regionId: region.id,
    managerUserId: manager.id,
    shippingCenterId: shippingCenter.id,
  });

  await replaceTerritoryCoverage(actor, territory.id, {
    coverage: [{ stateCode: 'TX' }],
  });

  return { director, manager, territory };
}

test('lead potential value persists through summary and detail responses', SERIAL, async () => {
  const { actor } = await createAdminSession();

  const lead = await createLead(actor, {
    companyName: 'Revenue Signal HVAC',
    contactDisplayName: 'Riley Revenue',
    email: 'riley.revenue@example.com',
    phone: '555-100-2200',
    state: 'TX',
    serviceTechCount: 6,
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
    potentialValueCents: 1250000,
  });

  assert.equal(lead.potentialValueCents, 1250000);

  const detail = await getLeadDetail(actor, lead.id);
  assert.ok(detail);
  assert.equal(detail.potentialValueCents, 1250000);
});

test('FR-L-007: lead intake rejects a malformed email or phone and accepts valid contact details', SERIAL, async () => {
  const { actor } = await createAdminSession();

  const baseInput = {
    companyName: 'Contact Validation HVAC',
    contactDisplayName: 'Val Idation',
    state: 'TX',
    serviceTechCount: 4,
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  };

  // A malformed email would otherwise become the CIS / alert delivery address.
  await assert.rejects(
    () => createLead(actor, { ...baseInput, email: 'not-an-email', phone: '555-100-3300' }),
    /email must be a valid email address/i,
  );

  // A phone without enough digits is rejected too.
  await assert.rejects(
    () => createLead(actor, { ...baseInput, email: 'val@example.com', phone: '12-34' }),
    /phone must be a valid phone number/i,
  );

  // Valid contact details persist (common formatting like parentheses/spaces is accepted).
  const validLead = await createLead(actor, {
    ...baseInput,
    companyName: 'Contact Validation HVAC Valid',
    email: 'val.idation@example.com',
    phone: '(555) 100-4400',
  });
  assert.ok(validLead.id, 'expected the valid lead to be created');

  const validDetail = await getLeadDetail(actor, validLead.id);
  assert.equal(validDetail.email, 'val.idation@example.com');
  assert.equal(validDetail.phone, '(555) 100-4400');
});

test('lead detail updates persist editable hero fields and re-sync territory on state change', SERIAL, async () => {
  const { actor } = await createAdminSession();

  const txFixture = await seedTerritoryFixture(actor, 'edit-tx');

  const caDirector = await createUser('REGIONAL_DIRECTOR', 'rd-edit-ca@pulse.local', 'RD edit ca');
  const caManager = await createUser('TERRITORY_MANAGER', 'tm-edit-ca@pulse.local', 'TM edit ca');
  const caShippingCenter = await createShippingCenter(actor, {
    code: 'ship_edit_ca',
    name: 'Shipping edit ca',
    city: 'Los Angeles',
    state: 'CA',
  });
  const caRegion = await createRegion(actor, {
    code: 'region_edit_ca',
    name: 'Region edit ca',
    directorUserId: caDirector.id,
  });
  const caTerritory = await createTerritory(actor, {
    code: 'territory_edit_ca',
    name: 'Territory edit ca',
    regionId: caRegion.id,
    managerUserId: caManager.id,
    shippingCenterId: caShippingCenter.id,
  });
  await replaceTerritoryCoverage(actor, caTerritory.id, {
    coverage: [{ stateCode: 'CA' }],
  });

  const lead = await createLead(actor, {
    companyName: 'Edit Me HVAC',
    contactDisplayName: 'Taylor Original',
    email: 'taylor.original@example.com',
    phone: '555-100-2250',
    state: 'TX',
    serviceTechCount: 6,
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  });

  assert.equal(lead.territoryId, txFixture.territory.id);

  const commercialSegment = await prisma.businessSegmentRef.findFirst({
    where: {
      code: { not: lead.businessSegmentCode },
      isActive: true,
    },
  });
  const alternateLeadSource = await prisma.leadSourceRef.findFirst({
    where: {
      code: { not: lead.leadSourceCode },
      isActive: true,
    },
  });
  const affinityGroup = await prisma.affinityGroupRef.findFirst({
    where: {
      code: { notIn: ['INDEPENDENT', 'UNKNOWN'] },
      isActive: true,
    },
  });
  const ownershipGroup = await prisma.ownershipGroupRef.findFirst({
    where: { isActive: true },
  });

  assert.ok(commercialSegment);
  assert.ok(alternateLeadSource);
  assert.ok(affinityGroup);
  assert.ok(ownershipGroup);

  const updated = await updateLead(actor, lead.id, {
    companyName: 'Edited HVAC Group',
    contactDisplayName: 'Taylor Updated',
    email: 'taylor.updated@example.com',
    phone: '555-100-2260',
    state: 'CA',
    businessSegmentCode: commercialSegment.code,
    leadSourceCode: alternateLeadSource.code,
    sourceDetail: 'Prototype parity regression',
    sourceSiteId: 'solace-air',
    sourceSiteName: 'SolaceAir.com',
    sourceBrandTag: 'SLA',
    sourceCampaign: 'spring-launch',
    leadRating: 'warm',
    serviceTechCount: 3,
    installTechCount: 2,
    truckCount: 1,
    salesPersonCount: 4,
    potentialValueCents: 1800000,
    affinityGroupSelection: 'group',
    affinityGroupCode: affinityGroup.code,
    ownershipGroupSelection: 'group',
    ownershipGroupCode: ownershipGroup.code,
    privateLabelName: 'Dynamic AQS',
    notes: 'Edited from regression coverage.',
  });

  assert.equal(updated.companyName, 'Edited HVAC Group');
  assert.equal(updated.contactDisplayName, 'Taylor Updated');
  assert.equal(updated.email, 'taylor.updated@example.com');
  assert.equal(updated.phone, '555-100-2260');
  assert.equal(updated.state, 'CA');
  assert.equal(updated.businessSegmentCode, commercialSegment.code);
  assert.equal(updated.leadSourceCode, alternateLeadSource.code);
  assert.equal(updated.sourceDetail, 'Prototype parity regression');
  assert.equal(updated.sourceSiteId, 'solace-air');
  assert.equal(updated.sourceSiteName, 'SolaceAir.com');
  assert.equal(updated.sourceBrandTag, 'SLA');
  assert.equal(updated.sourceCampaign, 'spring-launch');
  assert.equal(updated.leadRating, 'warm');
  assert.equal(updated.serviceTechCount, 3);
  assert.equal(updated.installTechCount, 2);
  assert.equal(updated.truckCount, 1);
  assert.equal(updated.salesPersonCount, 4);
  assert.equal(updated.potentialValueCents, 1800000);
  assert.equal(updated.affinityGroupSelection, 'group');
  assert.equal(updated.affinityGroupCode, affinityGroup.code);
  assert.equal(updated.ownershipGroupSelection, 'group');
  assert.equal(updated.ownershipGroupCode, ownershipGroup.code);
  assert.equal(updated.groupClassification, 'hybrid');
  assert.equal(updated.privateLabelName, 'Dynamic AQS');
  assert.equal(updated.notes, 'Edited from regression coverage.');
  assert.equal(updated.territoryId, caTerritory.id);
  assert.equal(updated.routingTeam, 'strategic_growth');

  const summary = await listLeads(actor, { search: 'Edited HVAC Group' });
  assert.equal(summary.items.length, 1);
  assert.equal(summary.items[0].leadRating, 'warm');
  assert.equal(summary.items[0].potentialValueCents, 1800000);
  assert.equal(summary.items[0].sourceSiteName, 'SolaceAir.com');
  assert.equal(summary.items[0].sourceBrandTag, 'SLA');
  assert.equal(summary.items[0].routingTeam, 'strategic_growth');
  assert.equal(summary.items[0].territoryId, caTerritory.id);

  const audit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'LEAD',
      entityId: lead.id,
      action: 'UPDATE',
    },
    orderBy: { createdAt: 'desc' },
  });

  assert.ok(audit);
  assert.equal(audit.afterData.companyName, 'Edited HVAC Group');
  assert.equal(audit.afterData.state, 'CA');
  assert.equal(audit.afterData.businessSegmentCode, commercialSegment.code);
  assert.equal(audit.afterData.leadSourceCode, alternateLeadSource.code);
  assert.equal(audit.afterData.affinityGroupCode, affinityGroup.code);
  assert.equal(audit.afterData.ownershipGroupCode, ownershipGroup.code);
});

test('territory managers cannot see pre-handoff leads when the policy is disabled', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const { manager } = await seedTerritoryFixture(actor, 'prehandoff');

  const lead = await createLead(actor, {
    companyName: 'Prehandoff Hidden HVAC',
    contactDisplayName: 'Harper Hidden',
    email: 'harper.hidden@example.com',
    phone: '555-100-2300',
    state: 'TX',
    serviceTechCount: 8,
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  });

  const tmActor = actorForUser(manager);
  const hidden = await listLeads(tmActor, {});
  assert.equal(hidden.items.some((item) => item.id === lead.id), false);

  await updateTerritoryPolicy(actor, {
    preHandoffTmVisibility: true,
  });

  const visible = await listLeads(tmActor, {});
  assert.equal(visible.items.some((item) => item.id === lead.id), true);
});

test('lead operational alert scan creates SGT broadcast alerts and SLA escalation alerts', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const { director, manager } = await seedTerritoryFixture(actor, 'alerts');

  const sgtLead = await createLead(actor, {
    companyName: 'SGT Broadcast HVAC',
    contactDisplayName: 'Bailey Broadcast',
    email: 'bailey.broadcast@example.com',
    phone: '555-100-2400',
    state: 'CA',
    serviceTechCount: 3,
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  });

  const tmLead = await createLead(actor, {
    companyName: 'TM Escalation HVAC',
    contactDisplayName: 'Elliot Escalation',
    email: 'elliot.escalation@example.com',
    phone: '555-100-2500',
    state: 'TX',
    serviceTechCount: 8,
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  });

  const staleCreatedAt = new Date(Date.now() - (26 * 3600000));
  const staleDueAt = new Date(Date.now() - (2 * 3600000));
  await prisma.lead.updateMany({
    where: {
      id: {
        in: [sgtLead.id, tmLead.id],
      },
    },
    data: {
      createdAt: staleCreatedAt,
      initialContactDueAt: staleDueAt,
    },
  });

  const result = await processLeadOperationalAlertScanJob({
    ...createLeadAlertJob(),
  });

  assert.ok(result.processedLeadCount >= 2);

  const alerts = await prisma.leadOperationalAlert.findMany({
    where: {
      leadId: {
        in: [sgtLead.id, tmLead.id],
      },
    },
    orderBy: [
      { leadId: 'asc' },
      { alertType: 'asc' },
      { recipientName: 'asc' },
    ],
  });

  const sgtBroadcasts = alerts.filter((entry) => entry.leadId === sgtLead.id && entry.alertType === 'ROUTING_BROADCAST');
  assert.equal(sgtBroadcasts.length, 3);
  assert.deepEqual(
    sgtBroadcasts.map((entry) => entry.recipientName),
    ['Adrienne Cardinale', 'Gabriella', 'Michelle Hogan'],
  );

  const tmManagerAlert = alerts.find((entry) => entry.leadId === tmLead.id && entry.alertType === 'INITIAL_CONTACT_MANAGER_ESCALATION');
  const tmLeadershipAlert = alerts.find((entry) => entry.leadId === tmLead.id && entry.alertType === 'INITIAL_CONTACT_LEADERSHIP_ESCALATION');

  assert.ok(tmManagerAlert);
  assert.equal(tmManagerAlert.recipientUserId, manager.id);
  assert.ok(tmLeadershipAlert);
  assert.equal(tmLeadershipAlert.recipientUserId, director.id);
});

test('lead operational alert scan returns zero work when no leads match', SERIAL, async () => {
  const result = await processLeadOperationalAlertScanJob(createLeadAlertJob());

  assert.equal(result.processedLeadCount, 0);
  assert.equal(result.createdAlertCount, 0);
});

test('lead operational alert scan tolerates an empty SGT recipient roster without creating broadcasts', SERIAL, async () => {
  const { actor } = await createAdminSession();

  await prisma.leadOperationalAlertRecipient.updateMany({
    data: { isActive: false },
  });

  const sgtLead = await createLead(actor, {
    companyName: 'SGT No Recipient HVAC',
    contactDisplayName: 'Taylor Empty',
    email: 'taylor.empty@example.com',
    phone: '555-100-2600',
    state: 'CA',
    serviceTechCount: 3,
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  });

  const result = await processLeadOperationalAlertScanJob(createLeadAlertJob());

  assert.equal(result.processedLeadCount, 1);
  assert.equal(result.createdAlertCount, 0);

  const alerts = await prisma.leadOperationalAlert.findMany({
    where: { leadId: sgtLead.id },
  });
  assert.equal(alerts.length, 0);
});

test('lead operational alert scan falls back to default escalation thresholds when policy is missing', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const { director, manager } = await seedTerritoryFixture(actor, 'fallback');

  const tmLead = await createLead(actor, {
    companyName: 'Fallback Threshold HVAC',
    contactDisplayName: 'Jamie Fallback',
    email: 'jamie.fallback@example.com',
    phone: '555-100-2700',
    state: 'TX',
    serviceTechCount: 8,
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  });

  await prisma.leadRoutingPolicy.delete({
    where: { id: 'default' },
  });

  await prisma.lead.update({
    where: { id: tmLead.id },
    data: {
      createdAt: new Date(Date.now() - (26 * 3600000)),
      initialContactDueAt: new Date(Date.now() - (2 * 3600000)),
    },
  });

  const result = await processLeadOperationalAlertScanJob(createLeadAlertJob());
  assert.equal(result.createdAlertCount, 2);

  const alerts = await prisma.leadOperationalAlert.findMany({
    where: { leadId: tmLead.id },
    orderBy: { alertType: 'asc' },
  });

  assert.deepEqual(
    alerts.map((entry) => entry.alertType),
    ['INITIAL_CONTACT_MANAGER_ESCALATION', 'INITIAL_CONTACT_LEADERSHIP_ESCALATION'],
  );
  assert.equal(alerts.find((entry) => entry.alertType === 'INITIAL_CONTACT_MANAGER_ESCALATION')?.recipientUserId, manager.id);
  assert.equal(alerts.find((entry) => entry.alertType === 'INITIAL_CONTACT_LEADERSHIP_ESCALATION')?.recipientUserId, director.id);
});

test('lead operational alert scan dedupes repeated runs for the same leads', SERIAL, async () => {
  const { actor } = await createAdminSession();
  await seedTerritoryFixture(actor, 'dedupe');

  const sgtLead = await createLead(actor, {
    companyName: 'SGT Dedupe HVAC',
    contactDisplayName: 'Jordan Dedupe',
    email: 'jordan.dedupe@example.com',
    phone: '555-100-2800',
    state: 'CA',
    serviceTechCount: 3,
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  });

  await prisma.lead.update({
    where: { id: sgtLead.id },
    data: {
      createdAt: new Date(Date.now() - (26 * 3600000)),
      initialContactDueAt: new Date(Date.now() - (2 * 3600000)),
    },
  });

  const first = await processLeadOperationalAlertScanJob(createLeadAlertJob());
  const second = await processLeadOperationalAlertScanJob(createLeadAlertJob());

  assert.equal(first.createdAlertCount, 3);
  assert.equal(second.createdAlertCount, 0);

  const alerts = await prisma.leadOperationalAlert.findMany({
    where: { leadId: sgtLead.id },
  });
  assert.equal(alerts.length, 3);
});

test('lead operational alert delivery records preview attempts and stays idempotent on retries', SERIAL, async () => {
  const { actor } = await createAdminSession();

  const sgtLead = await createLead(actor, {
    companyName: 'SGT Delivery Preview HVAC',
    contactDisplayName: 'Morgan Preview',
    email: 'morgan.preview@example.com',
    phone: '555-100-2900',
    state: 'CA',
    serviceTechCount: 3,
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  });

  await prisma.lead.update({
    where: { id: sgtLead.id },
    data: {
      createdAt: new Date(Date.now() - (26 * 3600000)),
      initialContactDueAt: new Date(Date.now() - (2 * 3600000)),
    },
  });

  await processLeadOperationalAlertScanJob(createLeadAlertJob());
  const alert = await prisma.leadOperationalAlert.findFirstOrThrow({
    where: {
      leadId: sgtLead.id,
      alertType: 'ROUTING_BROADCAST',
    },
  });

  const { logger, entries } = createLoggerStub();
  const deliveryResult = await processLeadOperationalAlertDeliveryJob(
    config,
    logger,
    createLeadAlertDeliveryJob(alert.id),
  );
  const retryResult = await processLeadOperationalAlertDeliveryJob(
    config,
    logger,
    createLeadAlertDeliveryJob(alert.id, 'lead-alert-delivery-regression-retry'),
  );

  assert.equal(deliveryResult.status, 'previewed');
  assert.equal(retryResult.status, 'already_processed');

  const attempts = await prisma.leadOperationalAlertDeliveryAttempt.findMany({
    where: { alertId: alert.id },
    orderBy: { attemptNumber: 'asc' },
  });

  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].status, 'PREVIEWED');
  assert.equal(attempts[0].deliveryMode, 'PREVIEW');
  assert.ok(entries.info.some((entry) => entry.message === 'lead.operational_alert.preview'));
});

test('lead operational alert delivery records disabled mode when alert transport is unavailable', SERIAL, async () => {
  const { actor } = await createAdminSession();

  const sgtLead = await createLead(actor, {
    companyName: 'SGT Delivery Disabled HVAC',
    contactDisplayName: 'Casey Disabled',
    email: 'casey.disabled@example.com',
    phone: '555-100-3000',
    state: 'CA',
    serviceTechCount: 3,
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  });

  await prisma.lead.update({
    where: { id: sgtLead.id },
    data: {
      createdAt: new Date(Date.now() - (26 * 3600000)),
      initialContactDueAt: new Date(Date.now() - (2 * 3600000)),
    },
  });

  await processLeadOperationalAlertScanJob(createLeadAlertJob());
  const alert = await prisma.leadOperationalAlert.findFirstOrThrow({
    where: {
      leadId: sgtLead.id,
      alertType: 'ROUTING_BROADCAST',
    },
  });

  const { logger, entries } = createLoggerStub();
  const disabledConfig = {
    ...config,
    leads: {
      ...config.leads,
      operationalAlertDeliveryMode: 'disabled',
    },
  };

  const deliveryResult = await processLeadOperationalAlertDeliveryJob(
    disabledConfig,
    logger,
    createLeadAlertDeliveryJob(alert.id),
  );

  assert.equal(deliveryResult.status, 'skipped');

  const attempts = await prisma.leadOperationalAlertDeliveryAttempt.findMany({
    where: { alertId: alert.id },
  });

  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].status, 'SKIPPED');
  assert.equal(attempts[0].deliveryMode, 'DISABLED');
  assert.ok(entries.warn.some((entry) => entry.message === 'lead.operational_alert.delivery_skipped'));
});

test('lead operational alert delivery sends through Microsoft Graph and records the provider attempt', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const alert = await createPendingRoutingBroadcastAlert(actor, {
    suffix: 'graph-success',
    recipientEmail: 'strategic.growth@example.com',
  });
  const graph = await startMicrosoftGraphMock();

  try {
    const { logger, entries } = createLoggerStub();
    const deliveryResult = await processLeadOperationalAlertDeliveryJob(
      createMicrosoftGraphDeliveryConfig(graph),
      logger,
      createLeadAlertDeliveryJob(alert.id),
    );

    assert.equal(deliveryResult.status, 'sent');

    const attempts = await prisma.leadOperationalAlertDeliveryAttempt.findMany({
      where: { alertId: alert.id },
      orderBy: { attemptNumber: 'asc' },
    });

    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].status, 'SENT');
    assert.equal(attempts[0].deliveryMode, 'MICROSOFT_GRAPH');
    assert.equal(attempts[0].recipientEmail, 'strategic.growth@example.com');
    assert.match(attempts[0].providerKey, /microsoft_graph/i);

    const refreshedAlert = await prisma.leadOperationalAlert.findUniqueOrThrow({
      where: { id: alert.id },
    });
    assert.equal(refreshedAlert.deliveryStatus, 'SENT');
    assert.ok(refreshedAlert.deliveredAt);

    const tokenRequest = graph.requests.find((request) => request.pathname.endsWith('/oauth2/v2.0/token'));
    assert.ok(tokenRequest);
    assert.match(tokenRequest.body, /client_id=pulse-test-client/);
    assert.match(tokenRequest.body, /client_secret=pulse-test-secret/);

    const sendMailRequest = graph.requests.find((request) => decodeURIComponent(request.pathname).endsWith('/sendMail'));
    assert.ok(sendMailRequest);
    assert.match(decodeURIComponent(sendMailRequest.pathname), /\/users\/alerts@pulse\.local\/sendMail$/);
    assert.equal(sendMailRequest.headers.authorization, 'Bearer graph-access-token');
    assert.equal(sendMailRequest.json.message.toRecipients[0].emailAddress.address, 'strategic.growth@example.com');
    assert.match(sendMailRequest.json.message.subject, /Pulse lead routing alert/);
    assert.match(sendMailRequest.json.message.body.content, /SGT Delivery graph-success HVAC/);
    assert.ok(entries.info.some((entry) => entry.message === 'lead.operational_alert.sent'));
  } finally {
    await graph.close();
  }
});

test('lead operational alert delivery records Microsoft Graph provider failures for retry visibility', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const alert = await createPendingRoutingBroadcastAlert(actor, {
    suffix: 'graph-failure',
    recipientEmail: 'strategic.failure@example.com',
  });
  const graph = await startMicrosoftGraphMock({ sendMailStatus: 503 });

  try {
    const { logger, entries } = createLoggerStub();
    const deliveryResult = await processLeadOperationalAlertDeliveryJob(
      createMicrosoftGraphDeliveryConfig(graph),
      logger,
      createLeadAlertDeliveryJob(alert.id),
    );

    assert.equal(deliveryResult.status, 'failed');

    const attempts = await prisma.leadOperationalAlertDeliveryAttempt.findMany({
      where: { alertId: alert.id },
    });

    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].status, 'FAILED');
    assert.equal(attempts[0].deliveryMode, 'MICROSOFT_GRAPH');
    assert.match(attempts[0].providerKey, /microsoft_graph/i);
    assert.match(attempts[0].errorMessage, /Send mail failed|503/i);

    const refreshedAlert = await prisma.leadOperationalAlert.findUniqueOrThrow({
      where: { id: alert.id },
    });
    assert.equal(refreshedAlert.deliveryStatus, 'FAILED');
    assert.equal(refreshedAlert.deliveredAt, null);
    assert.ok(entries.error.some((entry) => entry.message === 'lead.operational_alert.delivery_failed'));
  } finally {
    await graph.close();
  }
});

test('lead operational alert delivery admin settings expose retry visibility and latest failure', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const alert = await createPendingRoutingBroadcastAlert(actor, {
    suffix: 'admin-status-failure',
    recipientEmail: 'strategic.admin-status@example.com',
  });
  const graph = await startMicrosoftGraphMock({ sendMailStatus: 503 });

  try {
    const { logger } = createLoggerStub();
    await processLeadOperationalAlertDeliveryJob(
      createMicrosoftGraphDeliveryConfig(graph),
      logger,
      createLeadAlertDeliveryJob(alert.id),
    );

    const settings = await getLeadOperationalAlertDeliveryAdminSettings(createMicrosoftGraphDeliveryConfig(graph));
    assert.equal(settings.provider, 'lead_operational_alerts');
    assert.equal(settings.mode, 'microsoft_graph');
    assert.equal(settings.isConfigured, true);
    assert.equal(settings.status, 'warning');
    assert.equal(settings.metrics.failedAlertCount, 1);
    assert.equal(settings.metrics.retryableFailedAlertCount, 1);
    assert.equal(settings.metrics.failedAttemptCount, 1);
    assert.equal(settings.metrics.latestFailure?.alertId, alert.id);
    assert.equal(settings.metrics.latestFailure?.recipientEmail, 'strategic.admin-status@example.com');

    const statuses = await listLeadOperationalAlertIntegrationStatuses(createMicrosoftGraphDeliveryConfig(graph));
    assert.equal(statuses[0].key, 'lead-operational-alerts');
    assert.equal(statuses[0].status, 'warning');
    assert.match(statuses[0].detail, /failure/i);
  } finally {
    await graph.close();
  }
});

test('lead operational alert delivery admin settings report Microsoft Graph configuration issues', SERIAL, async () => {
  const settings = await getLeadOperationalAlertDeliveryAdminSettings(createMicrosoftGraphDeliveryConfig(null, {
    tenantId: undefined,
    clientId: undefined,
    clientSecret: undefined,
    fromUser: undefined,
  }));

  assert.equal(settings.mode, 'microsoft_graph');
  assert.equal(settings.isConfigured, false);
  assert.equal(settings.status, 'blocked');
  assert.deepEqual(settings.configurationIssues, [
    'NOTIFICATION_MICROSOFT_GRAPH_TENANT_ID',
    'NOTIFICATION_MICROSOFT_GRAPH_CLIENT_ID',
    'NOTIFICATION_MICROSOFT_GRAPH_CLIENT_SECRET',
    'NOTIFICATION_MICROSOFT_GRAPH_FROM_USER',
  ]);
  assert.equal(settings.metrics.failedAlertCount, 0);
});

test('lead operational alert admin retry requeues failed deliveries with recipients', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const alert = await createPendingRoutingBroadcastAlert(actor, {
    suffix: 'admin-retry',
    recipientEmail: 'strategic.retry@example.com',
  });
  const graph = await startMicrosoftGraphMock({ sendMailStatus: 503 });

  try {
    const { logger } = createLoggerStub();
    await processLeadOperationalAlertDeliveryJob(
      createMicrosoftGraphDeliveryConfig(graph),
      logger,
      createLeadAlertDeliveryJob(alert.id),
    );

    const { queue, enqueued } = createQueueStub();
    const result = await retryLeadOperationalAlertDeliveries(actor, {
      alertIds: [alert.id],
    }, { queue });

    assert.equal(result.matchedAlertCount, 1);
    assert.equal(result.retriedAlertCount, 1);
    assert.equal(result.enqueuedDeliveryCount, 1);
    assert.equal(enqueued.length, 1);
    assert.equal(enqueued[0].payload.data.alertId, alert.id);

    const refreshedAlert = await prisma.leadOperationalAlert.findUniqueOrThrow({
      where: { id: alert.id },
    });
    assert.equal(refreshedAlert.deliveryStatus, 'PENDING');
  } finally {
    await graph.close();
  }
});

test('lead operational alert admin dead-letter marks failed deliveries as skipped with reason', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const alert = await createPendingRoutingBroadcastAlert(actor, {
    suffix: 'admin-dead-letter',
    recipientEmail: 'strategic.deadletter@example.com',
  });
  const graph = await startMicrosoftGraphMock({ sendMailStatus: 503 });

  try {
    const { logger } = createLoggerStub();
    await processLeadOperationalAlertDeliveryJob(
      createMicrosoftGraphDeliveryConfig(graph),
      logger,
      createLeadAlertDeliveryJob(alert.id),
    );

    const result = await deadLetterLeadOperationalAlertDeliveries(
      actor,
      createMicrosoftGraphDeliveryConfig(graph),
      {
        alertIds: [alert.id],
        reason: 'Recipient mailbox is not active yet',
      },
    );

    assert.equal(result.matchedAlertCount, 1);
    assert.equal(result.deadLetteredAlertCount, 1);

    const refreshedAlert = await prisma.leadOperationalAlert.findUniqueOrThrow({
      where: { id: alert.id },
      include: {
        deliveryAttempts: {
          orderBy: { attemptNumber: 'asc' },
        },
      },
    });
    assert.equal(refreshedAlert.deliveryStatus, 'SKIPPED');
    assert.equal(refreshedAlert.deliveryAttempts.length, 2);
    assert.equal(refreshedAlert.deliveryAttempts[1].status, 'SKIPPED');
    assert.equal(refreshedAlert.deliveryAttempts[1].providerKey, 'pulse.lead-operational-alert.admin');
    assert.match(JSON.stringify(refreshedAlert.deliveryAttempts[1].metadata), /Recipient mailbox is not active yet/);
  } finally {
    await graph.close();
  }
});

test('lead operational alert scan respects quiet-hours policy', SERIAL, async () => {
  const { actor } = await createAdminSession();
  await createPendingRoutingBroadcastAlert(actor, {
    suffix: 'quiet-baseline',
    recipientEmail: 'strategic.quiet.baseline@example.com',
  });
  await prisma.leadOperationalAlert.deleteMany();

  await updateLeadOperationalAlertQuietHours(actor, {
    enabled: true,
    startLocal: '00:00',
    endLocal: '00:00',
    timeZone: 'UTC',
  });

  const { logger, entries } = createLoggerStub();
  const result = await processLeadOperationalAlertScanJob(createLeadAlertJob(), { logger });
  assert.equal(result.skippedReason, 'quiet_hours');
  assert.equal(result.createdAlertCount, 0);
  assert.ok(entries.info.some((entry) => entry.message === 'lead.operational_alert.scan_skipped'));

  const alerts = await prisma.leadOperationalAlert.findMany();
  assert.equal(alerts.length, 0);
});

test('lead operational alert recipient governance updates delivery roster and settings', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const recipient = await prisma.leadOperationalAlertRecipient.findFirstOrThrow({
    where: { code: 'sgt_michelle_hogan' },
  });

  const updated = await updateLeadOperationalAlertRecipient(actor, recipient.id, {
    email: 'michelle.alerts@example.com',
    isActive: false,
    sortOrder: 42,
  });

  assert.equal(updated.email, 'michelle.alerts@example.com');
  assert.equal(updated.isActive, false);
  assert.equal(updated.sortOrder, 42);

  const settings = await getLeadOperationalAlertDeliveryAdminSettings(config);
  const settingsRecipient = settings.recipients.find((item) => item.id === recipient.id);
  assert.equal(settingsRecipient?.email, 'michelle.alerts@example.com');
  assert.equal(settingsRecipient?.isActive, false);

  const audit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'LEAD_OPERATIONAL_ALERT_RECIPIENT',
      entityId: recipient.id,
    },
  });
  assert.ok(audit, 'expected recipient governance audit entry');
});

test('lead operational alert delivery records Microsoft Graph missing configuration without calling the provider', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const alert = await createPendingRoutingBroadcastAlert(actor, {
    suffix: 'graph-missing-config',
    recipientEmail: 'strategic.config@example.com',
  });
  const graph = await startMicrosoftGraphMock();

  try {
    const { logger, entries } = createLoggerStub();
    const deliveryResult = await processLeadOperationalAlertDeliveryJob(
      createMicrosoftGraphDeliveryConfig(graph, {
        clientSecret: undefined,
      }),
      logger,
      createLeadAlertDeliveryJob(alert.id),
    );

    assert.equal(deliveryResult.status, 'failed');
    assert.equal(graph.requests.length, 0);

    const attempts = await prisma.leadOperationalAlertDeliveryAttempt.findMany({
      where: { alertId: alert.id },
    });

    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].status, 'FAILED');
    assert.equal(attempts[0].deliveryMode, 'MICROSOFT_GRAPH');
    assert.match(attempts[0].errorMessage, /config|client secret/i);
    assert.ok(entries.error.some((entry) => entry.message === 'lead.operational_alert.delivery_failed'));
  } finally {
    await graph.close();
  }
});

test('lead operational alert delivery records Microsoft Graph missing recipient without calling the provider', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const alert = await createPendingRoutingBroadcastAlert(actor, {
    suffix: 'graph-missing-recipient',
    recipientEmail: null,
  });
  const graph = await startMicrosoftGraphMock();

  try {
    const { logger, entries } = createLoggerStub();
    const deliveryResult = await processLeadOperationalAlertDeliveryJob(
      createMicrosoftGraphDeliveryConfig(graph),
      logger,
      createLeadAlertDeliveryJob(alert.id),
    );

    assert.equal(deliveryResult.status, 'failed');
    assert.equal(graph.requests.length, 0);

    const attempts = await prisma.leadOperationalAlertDeliveryAttempt.findMany({
      where: { alertId: alert.id },
    });

    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].status, 'FAILED');
    assert.equal(attempts[0].deliveryMode, 'MICROSOFT_GRAPH');
    assert.equal(attempts[0].recipientEmail, null);
    assert.match(attempts[0].errorMessage, /recipient/i);
    assert.ok(entries.error.some((entry) => entry.message === 'lead.operational_alert.delivery_failed'));
  } finally {
    await graph.close();
  }
});
