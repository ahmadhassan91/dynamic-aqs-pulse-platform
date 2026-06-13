import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

// RBAC enforcement regression: record-scoping on account mutations + role-tier guard on admin user
// management. Both close privilege findings surfaced by the RBAC audit fleet (2026-06-12).
let prisma;
let config;
let ensureReferenceDataSeeded;
let ensureTerritoryPolicySeeded;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let updateAccount;
let updateAccountLifecycle;
let createAccountContact;
let listAccountContacts;
let createAccountLocation;
let createAdminUser;
let updateAdminUser;
let createLead;
let getLeadReadiness;
let listLeadContacts;
let convertLeadOnFirstOrder;
let previewWidenManifestImport;
let revokeDigitalAssetShareLink;
let ensureLeadRoutingPolicySeeded;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({
    updateAccount,
    updateAccountLifecycle,
    createAccountContact,
    listAccountContacts,
    createAccountLocation,
  } = await import('../dist/modules/accounts/service.js'));
  ({ createAdminUser, updateAdminUser } = await import('../dist/modules/admin/service.js'));
  ({ createLead, ensureLeadRoutingPolicySeeded } = await import('../dist/modules/leads/service.js'));
  ({ getLeadReadiness, listLeadContacts, convertLeadOnFirstOrder } = await import('../dist/modules/leads/readiness.js'));
  ({ previewWidenManifestImport, revokeDigitalAssetShareLink } = await import('../dist/modules/digital-assets/service.js'));
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
  await ensureTerritoryPolicySeeded();
  await ensureBootstrapAdminSeeded(config);
});

// createLead requires explicit group classification; default both to 'none' for these fixtures.
function leadInput(overrides) {
  return {
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
    ...overrides,
  };
}

async function superAdminActor() {
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
    displayName: auth.identity.displayName ?? 'Pulse Bootstrap Admin',
  };
}

async function scopedActor(role, email, displayName) {
  const user = await prisma.user.create({
    data: { email, displayName, roleCode: role, userType: 'INTERNAL', isActive: true },
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

// Build a territory managed by `tm` plus one account assigned to that TM. Returns the account id.
async function seedTerritoryAccount({ tm, regionCode, territoryCode, accountName }) {
  const shippingCenter = await prisma.shippingCenter.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
  const region = await prisma.region.create({
    data: { code: regionCode, name: `${regionCode} Region`, directorUserId: tm.userId, isActive: true },
  });
  const territory = await prisma.territory.create({
    data: {
      code: territoryCode,
      name: `${territoryCode} Territory`,
      regionId: region.id,
      managerUserId: tm.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });
  const account = await prisma.account.create({
    data: {
      displayName: accountName,
      accountType: 'Dealer',
      territoryId: territory.id,
      shippingCenterId: shippingCenter.id,
      assignedTmUserId: tm.userId,
      assignedRdUserId: tm.userId,
      isActive: true,
      locations: {
        create: { name: 'Primary', line1: '1 Main St', city: 'Dallas', state: 'TX', postalCode: '75001', isPrimary: true },
      },
    },
  });
  return account.id;
}

test('TM can mutate an account in their own territory', SERIAL, async () => {
  const tmA = await scopedActor('TERRITORY_MANAGER', 'tm.a@rbac.test', 'TM Alpha');
  const accountId = await seedTerritoryAccount({ tm: tmA, regionCode: 'rbac_a', territoryCode: 'tx_a', accountName: 'Alpha Pools' });

  const updated = await updateAccount(tmA, accountId, { displayName: 'Alpha Pools Renamed' });
  assert.equal(updated.displayName, 'Alpha Pools Renamed');

  const contacts = await listAccountContacts(tmA, accountId);
  assert.ok(Array.isArray(contacts), 'own-territory contact list should return an array');
});

test('TM cannot mutate or read PII on an account outside their territory', SERIAL, async () => {
  const tmA = await scopedActor('TERRITORY_MANAGER', 'tm.a@rbac.test', 'TM Alpha');
  const tmB = await scopedActor('TERRITORY_MANAGER', 'tm.b@rbac.test', 'TM Beta');
  const foreignAccountId = await seedTerritoryAccount({ tm: tmA, regionCode: 'rbac_a', territoryCode: 'tx_a', accountName: 'Alpha Pools' });

  // Mutations on a foreign account read as not-found, not as a silent success.
  await assert.rejects(() => updateAccount(tmB, foreignAccountId, { displayName: 'Hijacked' }), /not found/i);
  await assert.rejects(() => updateAccountLifecycle(tmB, foreignAccountId, { lifecycleStatus: 'churned' }), /not found/i);
  await assert.rejects(
    () => createAccountContact(tmB, foreignAccountId, { firstName: 'Mal', lastName: 'Lory', isPrimary: false }),
    /not found/i,
  );
  await assert.rejects(
    () => createAccountLocation(tmB, foreignAccountId, { name: 'Ghost', line1: '9 Nowhere', city: 'X', state: 'TX', postalCode: '00000' }),
    /not found/i,
  );

  // PII list reads are scoped too: a foreign account reads as null (handler returns 404).
  const contacts = await listAccountContacts(tmB, foreignAccountId);
  assert.equal(contacts, null, 'foreign-territory contact list must not leak PII');
});

test('non-super-admin cannot create a SUPER_ADMIN or EXECUTIVE user', SERIAL, async () => {
  const ops = await scopedActor('ADMIN_CSR_OPS', 'ops@rbac.test', 'Ops Manager');

  await assert.rejects(
    () => createAdminUser(ops, { email: 'evil.super@rbac.test', firstName: 'Evil', lastName: 'Super', role: 'SUPER_ADMIN' }),
    /super admin/i,
  );
  await assert.rejects(
    () => createAdminUser(ops, { email: 'evil.exec@rbac.test', firstName: 'Evil', lastName: 'Exec', role: 'EXECUTIVE' }),
    /super admin/i,
  );

  // A non-privileged role is still creatable by an admin.user_manage holder.
  const ok = await createAdminUser(ops, { email: 'csr@rbac.test', firstName: 'Casey', lastName: 'Rep', role: 'SALES_BD_REP' });
  assert.equal(ok.user.role, 'SALES_BD_REP');
});

test('non-super-admin cannot escalate an existing user into a privileged role', SERIAL, async () => {
  const superAdmin = await superAdminActor();
  const ops = await scopedActor('ADMIN_CSR_OPS', 'ops@rbac.test', 'Ops Manager');

  const target = await createAdminUser(superAdmin, {
    email: 'target@rbac.test',
    firstName: 'Tara',
    lastName: 'Get',
    role: 'SALES_BD_REP',
  });

  // Ops cannot lift the target (or themselves) into SUPER_ADMIN.
  await assert.rejects(
    () => updateAdminUser(ops, target.user.id, { role: 'SUPER_ADMIN' }),
    /super admin/i,
  );

  // SUPER_ADMIN can perform the same escalation.
  const escalated = await updateAdminUser(superAdmin, target.user.id, { role: 'EXECUTIVE' });
  assert.equal(escalated.user.role, 'EXECUTIVE');
});

test('non-super-admin cannot modify an existing privileged user', SERIAL, async () => {
  const superAdmin = await superAdminActor();
  const ops = await scopedActor('ADMIN_CSR_OPS', 'ops@rbac.test', 'Ops Manager');

  const exec = await createAdminUser(superAdmin, {
    email: 'exec@rbac.test',
    firstName: 'Eve',
    lastName: 'Exec',
    role: 'EXECUTIVE',
  });

  await assert.rejects(
    () => updateAdminUser(ops, exec.user.id, { firstName: 'Tampered' }),
    /super admin/i,
  );
});

test('TM cannot read readiness, contacts, or convert a lead outside their territory', SERIAL, async () => {
  const admin = await superAdminActor();
  const tm = await scopedActor('TERRITORY_MANAGER', 'tm.foreign@rbac.test', 'TM Foreign');

  // Admin-created lead routes to a seeded territory; the fresh TM owns no territory or leads.
  const lead = await createLead(admin, leadInput({
    companyName: 'Foreign Territory Pools',
    contactDisplayName: 'Pat Foreign',
    email: 'pat@foreign.test',
    phone: '555-700-0001',
    state: 'TX',
    serviceTechCount: 4,
  }));

  assert.equal(await getLeadReadiness(tm, lead.id), null, 'readiness must 404 for an out-of-scope lead');
  assert.equal(await listLeadContacts(tm, lead.id), null, 'contact PII must not leak cross-territory');
  await assert.rejects(() => convertLeadOnFirstOrder(tm, lead.id, {}), /not found/i);
});

test('TM can read readiness for a lead assigned to them', SERIAL, async () => {
  const admin = await superAdminActor();
  const tm = await scopedActor('TERRITORY_MANAGER', 'tm.owner@rbac.test', 'TM Owner');

  const lead = await createLead(admin, leadInput({
    companyName: 'Owned Pools',
    contactDisplayName: 'Owen Owner',
    email: 'owen@owned.test',
    phone: '555-700-0002',
    state: 'TX',
    serviceTechCount: 6,
  }));

  // Assign the lead to the TM and satisfy the TM visibility gate (CUSTOMER_ACTIVE stage).
  await prisma.lead.update({
    where: { id: lead.id },
    data: { assignedTmUserId: tm.userId, stage: 'CUSTOMER_ACTIVE' },
  });

  const readiness = await getLeadReadiness(tm, lead.id);
  assert.ok(readiness, 'TM should see readiness for their own assigned lead');
});

test('Widen manifest import rejects path traversal outside the manifest root', SERIAL, async () => {
  const admin = await superAdminActor();

  // Absolute path and ../ traversal must both be contained, not read off-root.
  await assert.rejects(
    () => previewWidenManifestImport(admin, { manifestPath: '../../../../etc/passwd' }),
    /outside the configured manifest directory/i,
  );
  await assert.rejects(
    () => previewWidenManifestImport(admin, { manifestPath: '/etc/passwd' }),
    /outside the configured manifest directory|ENOENT/i,
  );
});

// Seed a share-link row directly: revokeDigitalAssetShareLink only reads the row + ownership, so we
// skip the heavier create-share path (which needs an approved, dealer-visible asset version + URL).
async function seedShareLink({ createdByUserId, token }) {
  const asset = await prisma.digitalAsset.create({
    data: { stableSlug: `rbac-${token}`, title: `Asset ${token}`, kind: 'DOCUMENT', visibility: 'DEALER_PORTAL', reviewStatus: 'APPROVED' },
  });
  return prisma.digitalAssetShareLink.create({
    data: {
      assetId: asset.id,
      tokenHash: `hash-${token}`,
      shareUrl: `https://share.test/${token}`,
      recipientType: 'prospect',
      recipientName: 'Prospect Pat',
      recipientEmail: 'pat@prospect.test',
      createdByUserId,
    },
  });
}

test('a share-only role cannot revoke another user\'s share link but can revoke its own', SERIAL, async () => {
  const repA = await scopedActor('SALES_BD_REP', 'rep.a@rbac.test', 'Rep Alpha');
  const repB = await scopedActor('SALES_BD_REP', 'rep.b@rbac.test', 'Rep Beta');

  const linkB = await seedShareLink({ createdByUserId: repB.userId, token: 'beta' });
  // repA holds digital_asset.share but not digital_asset.edit — revoking repB's link is not-found.
  await assert.rejects(() => revokeDigitalAssetShareLink(repA, linkB.id), /not found/i);

  const linkA = await seedShareLink({ createdByUserId: repA.userId, token: 'alpha' });
  const revoked = await revokeDigitalAssetShareLink(repA, linkA.id);
  assert.equal(revoked.revoked, true, 'a share holder may revoke its own link');
});

test('an edit-capable role can revoke any share link', SERIAL, async () => {
  const repB = await scopedActor('SALES_BD_REP', 'rep.b@rbac.test', 'Rep Beta');
  const ops = await scopedActor('ADMIN_CSR_OPS', 'ops@rbac.test', 'Ops Manager'); // holds digital_asset.edit

  const linkB = await seedShareLink({ createdByUserId: repB.userId, token: 'beta' });
  const revoked = await revokeDigitalAssetShareLink(ops, linkB.id);
  assert.equal(revoked.revoked, true, 'an edit-capable role may revoke another user\'s link');
});
