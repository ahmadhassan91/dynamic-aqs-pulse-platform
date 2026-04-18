import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let ensureReferenceDataSeeded;
let ensureLeadRoutingPolicySeeded;
let ensureWebsiteLeadConfigSeeded;
let ensureTerritoryPolicySeeded;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let createLead;
let getLeadDetail;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureLeadRoutingPolicySeeded, ensureWebsiteLeadConfigSeeded, createLead, getLeadDetail } = await import('../dist/modules/leads/service.js'));
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));

  config = configModule.loadAppConfig(process.env);
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
  await ensureWebsiteLeadConfigSeeded();
  await ensureTerritoryPolicySeeded();
  await ensureBootstrapAdminSeeded(config);
});

async function createAdminActor() {
  const auth = await loginWithPassword(
    config,
    {
      email: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD,
    },
    {},
  );

  return {
    userId: auth.identity.userId,
    sessionId: auth.session.sessionId,
    role: auth.identity.role,
    actorType: auth.identity.actorType,
    email: auth.identity.email,
    displayName: auth.identity.displayName ?? process.env.AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME ?? 'Pulse Bootstrap Admin',
  };
}

test('manual lead intake requires explicit affinity and ownership selection', SERIAL, async () => {
  const actor = await createAdminActor();

  await assert.rejects(
    () =>
      createLead(actor, {
        companyName: 'Missing Classification HVAC',
        contactDisplayName: 'Morgan Missing',
        email: 'morgan.missing@example.com',
        phone: '555-100-2000',
        state: 'TX',
        serviceTechCount: 5,
      }),
    /affinityGroupSelection is required/i,
  );
});

test('manual lead intake rejects unknown affinity selection as a final state', SERIAL, async () => {
  const actor = await createAdminActor();

  await assert.rejects(
    () =>
      createLead(actor, {
        companyName: 'Unknown Affinity HVAC',
        contactDisplayName: 'Uma Unknown',
        email: 'uma.unknown@example.com',
        phone: '555-100-2100',
        state: 'TX',
        serviceTechCount: 5,
        affinityGroupSelection: 'unknown',
        ownershipGroupSelection: 'none',
      }),
    /affinityGroupSelection cannot be "unknown"/i,
  );
});

test('lead classification kernel stores explicit axis state and derives hybrid correctly', SERIAL, async () => {
  const actor = await createAdminActor();

  const lead = await createLead(actor, {
    companyName: 'Hybrid Dealer HVAC',
    contactDisplayName: 'Hayden Hybrid',
    email: 'hayden.hybrid@example.com',
    phone: '555-100-3000',
    state: 'TX',
    serviceTechCount: 7,
    affinityGroupSelection: 'group',
    affinityGroupCode: 'NEXSTAR',
    ownershipGroupSelection: 'group',
    ownershipGroupCode: 'REDWOOD_SERVICES',
  });

  assert.equal(lead.groupClassification, 'hybrid');
  assert.equal(lead.affinityGroupSelection, 'group');
  assert.equal(lead.affinityGroupCode, 'NEXSTAR');
  assert.equal(lead.ownershipGroupSelection, 'group');
  assert.equal(lead.ownershipGroupCode, 'REDWOOD_SERVICES');

  const detail = await getLeadDetail(actor, lead.id);
  assert.ok(detail);
  assert.equal(detail.groupClassification, 'hybrid');
  assert.equal(detail.affinityGroupSelection, 'group');
  assert.equal(detail.affinityGroupName, 'Nexstar Network');
  assert.equal(detail.ownershipGroupSelection, 'group');
  assert.equal(detail.ownershipGroupName, 'Redwood Services');
});
