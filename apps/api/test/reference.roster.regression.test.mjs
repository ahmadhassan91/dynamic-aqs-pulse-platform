import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let ensureReferenceDataSeeded;
let reviewGroupRosterImport;
let getGroupRosterImportRun;
let commitGroupRosterImportRun;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({
    reviewGroupRosterImport,
    getGroupRosterImportRun,
    commitGroupRosterImportRun,
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

function toBase64(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function buildRosterMappings() {
  return [
    { sourceHeader: 'Company', targetField: 'companyName' },
    { sourceHeader: 'Email', targetField: 'email' },
    { sourceHeader: 'Phone', targetField: 'phone' },
    { sourceHeader: 'State', targetField: 'state' },
  ];
}

test('group roster review identifies ready, conflict, and unmatched rows', SERIAL, async () => {
  const actor = await createActor('SUPER_ADMIN', 'roster.admin@test.local');
  const nexstar = await prisma.affinityGroupRef.findUniqueOrThrow({ where: { code: 'NEXSTAR' } });
  const certainPath = await prisma.affinityGroupRef.findUniqueOrThrow({ where: { code: 'CERTAINPATH' } });

  await prisma.lead.create({
    data: {
      companyName: 'North Air Partners',
      contactDisplayName: 'Jamie North',
      email: 'jamie.north@example.com',
      phone: '555-111-2222',
      state: 'TX',
      serviceTechCount: 3,
      routingBasisSnapshot: 'SERVICE_TECH_COUNT',
      routingThresholdSnapshot: 5,
      routingTeam: 'STRATEGIC_GROWTH',
      businessSegmentId: (await prisma.businessSegmentRef.findUniqueOrThrow({ where: { code: 'residential' } })).id,
      leadSourceId: (await prisma.leadSourceRef.findUniqueOrThrow({ where: { code: 'manual_entry' } })).id,
      affinityGroupSelection: 'NONE',
      ownershipGroupSelection: 'NONE',
      groupClassification: 'INDEPENDENT',
    },
  });

  const sourceLead = await prisma.lead.create({
    data: {
      companyName: 'Legacy Comfort Group',
      contactDisplayName: 'Taylor Legacy',
      email: 'legacy@example.com',
      phone: '555-999-0000',
      state: 'FL',
      serviceTechCount: 4,
      routingBasisSnapshot: 'SERVICE_TECH_COUNT',
      routingThresholdSnapshot: 5,
      routingTeam: 'STRATEGIC_GROWTH',
      businessSegmentId: (await prisma.businessSegmentRef.findUniqueOrThrow({ where: { code: 'residential' } })).id,
      leadSourceId: (await prisma.leadSourceRef.findUniqueOrThrow({ where: { code: 'manual_entry' } })).id,
      affinityGroupSelection: 'GROUP',
      affinityGroupId: certainPath.id,
      ownershipGroupSelection: 'NONE',
      groupClassification: 'AFFINITY_ONLY',
    },
  });

  await prisma.account.create({
    data: {
      sourceLeadId: sourceLead.id,
      displayName: 'Legacy Comfort Group',
      legalName: 'Legacy Comfort Group LLC',
      affinityGroupSelection: 'GROUP',
      affinityGroupId: certainPath.id,
      ownershipGroupSelection: 'NONE',
      groupClassification: 'AFFINITY_ONLY',
    },
  });

  const csv = [
    'Company,Email,Phone,State',
    'North Air Partners,jamie.north@example.com,555-111-2222,TX',
    'Legacy Comfort Group,legacy@example.com,555-999-0000,FL',
    'Fresh Comfort,new@example.com,555-777-8888,TX',
  ].join('\n');

  const review = await reviewGroupRosterImport(actor, {
    groupKind: 'affinity',
    groupId: nexstar.id,
    fileName: 'nexstar-roster.csv',
    fileContentBase64: toBase64(csv),
    mappings: buildRosterMappings(),
  });

  assert.ok(review.runId);
  assert.equal(review.totalRows, 3);
  assert.equal(review.readyRowCount, 1);
  assert.equal(review.attentionRowCount, 2);

  const readyRow = review.rows.find((row) => row.rowNumber === 2);
  const conflictRow = review.rows.find((row) => row.rowNumber === 3);
  const unmatchedRow = review.rows.find((row) => row.rowNumber === 4);

  assert.ok(readyRow);
  assert.equal(readyRow.status, 'ready');
  assert.equal(readyRow.candidates.length, 1);
  assert.equal(readyRow.candidates[0]?.entityType, 'lead');

  assert.ok(conflictRow);
  assert.equal(conflictRow.status, 'requires_review');
  assert.ok(conflictRow.detail.includes('already belongs to affinity group'));
  assert.ok(conflictRow.candidates.some((candidate) => candidate.entityType === 'account'));

  assert.ok(unmatchedRow);
  assert.equal(unmatchedRow.status, 'requires_review');
  assert.equal(unmatchedRow.candidates.length, 0);

  const persisted = await getGroupRosterImportRun(actor, review.runId);
  assert.equal(persisted.runId, review.runId);
  assert.equal(persisted.rows.length, review.rows.length);
});

test('group roster commit applies reviewed matches to linked lead-account families', SERIAL, async () => {
  const actor = await createActor('SUPER_ADMIN', 'roster.commit@test.local');
  const nexstar = await prisma.affinityGroupRef.findUniqueOrThrow({ where: { code: 'NEXSTAR' } });
  const certainPath = await prisma.affinityGroupRef.findUniqueOrThrow({ where: { code: 'CERTAINPATH' } });

  const readyLead = await prisma.lead.create({
    data: {
      companyName: 'North Air Partners',
      contactDisplayName: 'Jamie North',
      email: 'jamie.north@example.com',
      phone: '555-111-2222',
      state: 'TX',
      serviceTechCount: 3,
      routingBasisSnapshot: 'SERVICE_TECH_COUNT',
      routingThresholdSnapshot: 5,
      routingTeam: 'STRATEGIC_GROWTH',
      businessSegmentId: (await prisma.businessSegmentRef.findUniqueOrThrow({ where: { code: 'residential' } })).id,
      leadSourceId: (await prisma.leadSourceRef.findUniqueOrThrow({ where: { code: 'manual_entry' } })).id,
      affinityGroupSelection: 'NONE',
      ownershipGroupSelection: 'NONE',
      groupClassification: 'INDEPENDENT',
    },
  });

  const sourceLead = await prisma.lead.create({
    data: {
      companyName: 'Legacy Comfort Group',
      contactDisplayName: 'Taylor Legacy',
      email: 'legacy@example.com',
      phone: '555-999-0000',
      state: 'FL',
      serviceTechCount: 4,
      routingBasisSnapshot: 'SERVICE_TECH_COUNT',
      routingThresholdSnapshot: 5,
      routingTeam: 'STRATEGIC_GROWTH',
      businessSegmentId: (await prisma.businessSegmentRef.findUniqueOrThrow({ where: { code: 'residential' } })).id,
      leadSourceId: (await prisma.leadSourceRef.findUniqueOrThrow({ where: { code: 'manual_entry' } })).id,
      affinityGroupSelection: 'GROUP',
      affinityGroupId: certainPath.id,
      ownershipGroupSelection: 'NONE',
      groupClassification: 'AFFINITY_ONLY',
    },
  });

  const account = await prisma.account.create({
    data: {
      sourceLeadId: sourceLead.id,
      displayName: 'Legacy Comfort Group',
      legalName: 'Legacy Comfort Group LLC',
      affinityGroupSelection: 'GROUP',
      affinityGroupId: certainPath.id,
      ownershipGroupSelection: 'NONE',
      groupClassification: 'AFFINITY_ONLY',
    },
  });

  const csv = [
    'Company,Email,Phone,State',
    'North Air Partners,jamie.north@example.com,555-111-2222,TX',
    'Legacy Comfort Group,legacy@example.com,555-999-0000,FL',
    'Fresh Comfort,new@example.com,555-777-8888,TX',
  ].join('\n');

  const review = await reviewGroupRosterImport(actor, {
    groupKind: 'affinity',
    groupId: nexstar.id,
    fileName: 'nexstar-roster.csv',
    fileContentBase64: toBase64(csv),
    mappings: buildRosterMappings(),
  });

  const committed = await commitGroupRosterImportRun(actor, review.runId, {
    rowDecisions: [
      {
        rowNumber: 3,
        action: 'apply',
        targetEntityId: account.id,
      },
      {
        rowNumber: 4,
        action: 'skip',
      },
    ],
  });

  assert.equal(committed.appliedCount, 2);
  assert.equal(committed.skippedCount, 1);
  assert.equal(committed.errorCount, 0);

  const refreshedLead = await prisma.lead.findUniqueOrThrow({ where: { id: readyLead.id } });
  assert.equal(refreshedLead.affinityGroupSelection, 'GROUP');
  assert.equal(refreshedLead.affinityGroupId, nexstar.id);
  assert.equal(refreshedLead.groupClassification, 'AFFINITY_ONLY');

  const refreshedAccount = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
  assert.equal(refreshedAccount.affinityGroupId, nexstar.id);
  assert.equal(refreshedAccount.groupClassification, 'AFFINITY_ONLY');

  const refreshedSourceLead = await prisma.lead.findUniqueOrThrow({ where: { id: sourceLead.id } });
  assert.equal(refreshedSourceLead.affinityGroupId, nexstar.id);
  assert.equal(refreshedSourceLead.groupClassification, 'AFFINITY_ONLY');
});

test('group roster import denies non-admin stewardship actions', SERIAL, async () => {
  const actor = await createActor('TERRITORY_MANAGER', 'roster.denied@test.local');
  const nexstar = await prisma.affinityGroupRef.findUniqueOrThrow({ where: { code: 'NEXSTAR' } });
  const csv = [
    'Company,Email,Phone,State',
    'North Air Partners,jamie.north@example.com,555-111-2222,TX',
  ].join('\n');

  await assert.rejects(
    () => reviewGroupRosterImport(actor, {
      groupKind: 'affinity',
      groupId: nexstar.id,
      fileName: 'nexstar-roster.csv',
      fileContentBase64: toBase64(csv),
      mappings: buildRosterMappings(),
    }),
    /cannot perform action reference\.manage/i,
  );
});

test('ownership roster application promotes existing affinity members into hybrid classification', SERIAL, async () => {
  const actor = await createActor('SUPER_ADMIN', 'ownership.roster@test.local');
  const nexstar = await prisma.affinityGroupRef.findUniqueOrThrow({ where: { code: 'NEXSTAR' } });
  const redwood = await prisma.ownershipGroupRef.findUniqueOrThrow({ where: { code: 'REDWOOD_SERVICES' } });

  const sourceLead = await prisma.lead.create({
    data: {
      companyName: 'Hybrid Comfort Group',
      contactDisplayName: 'Harper Hybrid',
      email: 'hybrid@example.com',
      phone: '555-444-2222',
      state: 'CA',
      serviceTechCount: 6,
      routingBasisSnapshot: 'SERVICE_TECH_COUNT',
      routingThresholdSnapshot: 5,
      routingTeam: 'NATIONAL_TM',
      businessSegmentId: (await prisma.businessSegmentRef.findUniqueOrThrow({ where: { code: 'residential' } })).id,
      leadSourceId: (await prisma.leadSourceRef.findUniqueOrThrow({ where: { code: 'manual_entry' } })).id,
      affinityGroupSelection: 'GROUP',
      affinityGroupId: nexstar.id,
      ownershipGroupSelection: 'NONE',
      groupClassification: 'AFFINITY_ONLY',
    },
  });

  const account = await prisma.account.create({
    data: {
      sourceLeadId: sourceLead.id,
      displayName: 'Hybrid Comfort Group',
      legalName: 'Hybrid Comfort Group LLC',
      affinityGroupSelection: 'GROUP',
      affinityGroupId: nexstar.id,
      ownershipGroupSelection: 'NONE',
      groupClassification: 'AFFINITY_ONLY',
    },
  });

  const csv = [
    'Company,Email,Phone,State',
    'Hybrid Comfort Group,hybrid@example.com,555-444-2222,CA',
  ].join('\n');

  const review = await reviewGroupRosterImport(actor, {
    groupKind: 'ownership',
    groupId: redwood.id,
    fileName: 'ownership-roster.csv',
    fileContentBase64: toBase64(csv),
    mappings: buildRosterMappings(),
  });

  const committed = await commitGroupRosterImportRun(actor, review.runId, {
    rowDecisions: [
      {
        rowNumber: 2,
        action: 'apply',
        targetEntityId: account.id,
      },
    ],
  });
  assert.equal(committed.appliedCount, 1);

  const refreshedAccount = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
  assert.equal(refreshedAccount.ownershipGroupSelection, 'GROUP');
  assert.equal(refreshedAccount.ownershipGroupId, redwood.id);
  assert.equal(refreshedAccount.groupClassification, 'HYBRID');

  const refreshedLead = await prisma.lead.findUniqueOrThrow({ where: { id: sourceLead.id } });
  assert.equal(refreshedLead.ownershipGroupSelection, 'GROUP');
  assert.equal(refreshedLead.ownershipGroupId, redwood.id);
  assert.equal(refreshedLead.groupClassification, 'HYBRID');
});
