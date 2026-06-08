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
let logLeadActivityNote;
const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({
    ensureLeadRoutingPolicySeeded,
    ensureWebsiteLeadConfigSeeded,
    createLead,
    getLeadDetail,
    logLeadActivityNote,
  } = await import('../dist/modules/leads/service.js'));
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));

  config = configModule.loadAppConfig(process.env);
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

function seedLead(actor) {
  return createLead(actor, {
    companyName: 'Activity Note HVAC',
    serviceTechCount: 3,
    state: 'TX',
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  });
}

test('logLeadActivityNote stores an approved note and returns its summary (UX-L-010)', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await seedLead(actor);

  const response = await logLeadActivityNote(actor, lead.id, {
    note: 'Spoke with the owner; sending the CIS package this week.',
    title: 'Discovery call recap',
  });

  assert.ok(response.id, 'expected a note id');
  assert.equal(response.leadId, lead.id);
  assert.equal(response.note, 'Spoke with the owner; sending the CIS package this week.');
  assert.equal(response.title, 'Discovery call recap');
  assert.ok(response.createdAt, 'expected createdAt timestamp');

  // The note is persisted as an APPROVED lead-context voice note and surfaces on the lead detail feed.
  const stored = await prisma.mobileVoiceNote.findUnique({ where: { id: response.id } });
  assert.ok(stored, 'expected the note row to exist');
  assert.equal(stored.leadId, lead.id);
  assert.equal(stored.contextType, 'LEAD');
  assert.equal(stored.reviewStatus, 'APPROVED');

  const detail = await getLeadDetail(actor, lead.id);
  assert.ok(
    detail.fieldActivity.some((entry) => entry.id === response.id),
    'note should surface on the lead detail field-activity feed',
  );
});

test('logLeadActivityNote defaults the title and requires note text', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await seedLead(actor);

  const defaulted = await logLeadActivityNote(actor, lead.id, {
    note: 'Left a voicemail.',
  });
  assert.equal(defaulted.title, 'Activity note');

  await assert.rejects(
    () => logLeadActivityNote(actor, lead.id, { note: '   ' }),
    /note text is required/i,
  );
});

test('logLeadActivityNote rejects an unknown lead', SERIAL, async () => {
  const actor = await createAdminActor();

  await assert.rejects(
    () => logLeadActivityNote(actor, '00000000-0000-0000-0000-000000000000', { note: 'orphan note' }),
    /lead not found/i,
  );
});
