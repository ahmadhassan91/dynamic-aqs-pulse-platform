import assert from 'node:assert/strict';
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
let processLeadOperationalAlertScanJob;
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
    processLeadOperationalAlertScanJob,
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
      },
    },
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
