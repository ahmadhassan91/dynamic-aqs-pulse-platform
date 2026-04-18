import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let ensureReferenceDataSeeded;
let createAffinityGroup;
let createOwnershipGroup;
let importAffinityGroups;
let importOwnershipGroups;
let listAffinityGroups;
let listOwnershipGroups;
let updateAffinityGroup;
let updateOwnershipGroup;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({
    ensureReferenceDataSeeded,
    createAffinityGroup,
    createOwnershipGroup,
    importAffinityGroups,
    importOwnershipGroups,
    listAffinityGroups,
    listOwnershipGroups,
    updateAffinityGroup,
    updateOwnershipGroup,
  } = await import('../dist/modules/reference/service.js'));

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
});

async function createActor(role, email) {
  const user = await prisma.user.create({
    data: {
      email,
      displayName: `${role} Test`,
      roleCode: role,
      isActive: true,
    },
  });

  return {
    userId: user.id,
    sessionId: `session-${user.id}`,
    role,
    actorType: 'internal',
    email: user.email,
    displayName: user.displayName,
  };
}

test('reference admins can create and update governed affinity groups', SERIAL, async () => {
  const actor = await createActor('SUPER_ADMIN', 'affinity.admin@test.local');

  const created = await createAffinityGroup(actor, {
    code: 'SERVICE_EXPERTS',
    name: 'Service Experts',
    shortName: 'Service Experts',
    description: 'Buying group / franchise alignment',
    groupType: 'franchise',
    sortOrder: 65,
  });

  assert.equal(created.code, 'SERVICE_EXPERTS');
  assert.equal(created.groupType, 'franchise');
  assert.equal(created.isActive, true);

  const updated = await updateAffinityGroup(actor, created.id, {
    name: 'Service Experts Network',
    shortName: 'Service Experts',
    groupType: 'buying_group',
    isActive: false,
    notes: 'Paused for cleanup',
  });

  assert.ok(updated);
  assert.equal(updated.name, 'Service Experts Network');
  assert.equal(updated.groupType, 'buying_group');
  assert.equal(updated.isActive, false);
  assert.equal(updated.notes, 'Paused for cleanup');
});

test('reference admins can import affinity groups with create and update counts', SERIAL, async () => {
  const actor = await createActor('SUPER_ADMIN', 'affinity.import@test.local');

  const response = await importAffinityGroups(actor, {
    batchName: 'Q2 affinity roster prep',
    sourceLabel: 'dynamic-sheet',
    rows: [
      {
        code: 'NEXSTAR',
        name: 'Nexstar Network Updated',
        shortName: 'Nexstar',
        groupType: 'buying_group',
        sortOrder: 5,
      },
      {
        code: 'LCS',
        name: 'LCS',
        shortName: 'LCS',
        description: 'Community or local buying alignment',
        groupType: 'community',
        sortOrder: 90,
      },
    ],
  });

  assert.equal(response.processedCount, 2);
  assert.equal(response.createdCount, 1);
  assert.equal(response.updatedCount, 1);

  const list = await listAffinityGroups(actor);
  assert.ok(list.items.some((entry) => entry.code === 'LCS' && entry.groupType === 'community'));
  assert.ok(list.items.some((entry) => entry.code === 'NEXSTAR' && entry.name === 'Nexstar Network Updated'));
});

test('reference admins can create, update, and import ownership groups', SERIAL, async () => {
  const actor = await createActor('SUPER_ADMIN', 'ownership.admin@test.local');

  const created = await createOwnershipGroup(actor, {
    code: 'TURNPOINT',
    name: 'Turnpoint Services',
    shortName: 'Turnpoint',
    ownershipType: 'private_equity',
    description: 'PE overlay',
    sortOrder: 50,
  });

  assert.equal(created.code, 'TURNPOINT');
  assert.equal(created.ownershipType, 'private_equity');

  const updated = await updateOwnershipGroup(actor, created.id, {
    name: 'Turnpoint Services Group',
    ownershipType: 'common_owner',
    notes: 'Converted after stewardship review',
  });

  assert.ok(updated);
  assert.equal(updated.name, 'Turnpoint Services Group');
  assert.equal(updated.ownershipType, 'common_owner');
  assert.equal(updated.notes, 'Converted after stewardship review');

  const imported = await importOwnershipGroups(actor, {
    rows: [
      {
        code: 'APOLLO',
        name: 'Apollo Updated',
        shortName: 'Apollo',
        ownershipType: 'private_equity',
        sortOrder: 15,
      },
      {
        code: 'WRENCH_GROUP',
        name: 'Wrench Group',
        shortName: 'Wrench',
        ownershipType: 'common_owner',
        description: 'Common ownership rollup',
        sortOrder: 40,
      },
    ],
  });

  assert.equal(imported.createdCount, 1);
  assert.equal(imported.updatedCount, 1);

  const list = await listOwnershipGroups(actor);
  assert.ok(list.items.some((entry) => entry.code === 'WRENCH_GROUP' && entry.ownershipType === 'common_owner'));
  assert.ok(list.items.some((entry) => entry.code === 'APOLLO' && entry.name === 'Apollo Updated'));
});

test('non-admin roles cannot manage affinity or ownership reference masters', SERIAL, async () => {
  const actor = await createActor('TERRITORY_MANAGER', 'tm.reference@test.local');

  await assert.rejects(
    () => createAffinityGroup(actor, {
      code: 'DENIED_AFFINITY',
      name: 'Denied Affinity',
      groupType: 'other',
    }),
    /cannot perform action reference\.manage/i,
  );

  await assert.rejects(
    () => createOwnershipGroup(actor, {
      code: 'DENIED_OWNER',
      name: 'Denied Ownership',
      ownershipType: 'other',
    }),
    /cannot perform action reference\.manage/i,
  );
});
