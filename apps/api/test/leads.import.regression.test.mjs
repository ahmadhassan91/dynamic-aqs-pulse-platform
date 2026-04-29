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
let authenticateAccessToken;
let createLead;
let reviewLeadImport;
let importLeadFile;
let getLeadImportRun;
let commitLeadImportRun;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({
    ensureLeadRoutingPolicySeeded,
    ensureWebsiteLeadConfigSeeded,
    createLead,
    reviewLeadImport,
    importLeadFile,
    getLeadImportRun,
    commitLeadImportRun,
  } = await import('../dist/modules/leads/service.js'));

  createLead = ((rawCreateLead) => (actor, input, ...rest) => {
    const hasExplicitClassification = input.affinityGroupSelection !== undefined
      || input.affinityGroupId !== undefined
      || input.affinityGroupCode !== undefined
      || input.affinityGroupName !== undefined
      || input.ownershipGroupSelection !== undefined
      || input.ownershipGroupId !== undefined
      || input.ownershipGroupCode !== undefined
      || input.ownershipGroupName !== undefined;

    return rawCreateLead(actor, hasExplicitClassification
      ? input
      : {
          affinityGroupSelection: 'none',
          ownershipGroupSelection: 'none',
          ...input,
        }, ...rest);
  })(createLead);
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword, authenticateAccessToken } = await import('../dist/modules/auth/service.js'));

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

  const actor = await authenticateAccessToken(auth.tokens.accessToken);
  assert.ok(actor, 'expected a bootstrap admin actor');
  return actor;
}

function toBase64(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function buildMappings() {
  return [
    { sourceHeader: 'Company', targetField: 'companyName' },
    { sourceHeader: 'Email', targetField: 'email' },
    { sourceHeader: 'Phone', targetField: 'phone' },
    { sourceHeader: 'State', targetField: 'state' },
    { sourceHeader: 'Service Tech Count', targetField: 'serviceTechCount' },
  ];
}

test('lead import review flags duplicate rows against leads and accounts', SERIAL, async () => {
  const actor = await createAdminActor();

  const existingLead = await createLead(actor, {
    companyName: 'North Air Partners',
    contactDisplayName: 'Jamie North',
    email: 'jamie.north@example.com',
    phone: '555-111-2222',
    state: 'TX',
    serviceTechCount: 3,
  });

  const existingAccount = await prisma.account.create({
    data: {
      displayName: 'Legacy Comfort Group',
      legalName: 'Legacy Comfort Group LLC',
    },
  });
  await prisma.contact.create({
    data: {
      accountId: existingAccount.id,
      firstName: 'Taylor',
      lastName: 'Legacy',
      email: 'legacy@example.com',
      phone: '555-999-0000',
      isPrimary: true,
    },
  });

  const csv = [
    'Company,Email,Phone,State,Service Tech Count',
    'North Air Partners,jamie.north@example.com,555-111-2222,TX,4',
    'Legacy Comfort Group,legacy@example.com,555-999-0000,FL,2',
    'Fresh Comfort,new@example.com,555-777-8888,TX,1',
  ].join('\n');

  const review = await reviewLeadImport(actor, {
    fileName: 'lead-import.csv',
    fileContentBase64: toBase64(csv),
    mappings: buildMappings(),
  });

  assert.ok(review.runId);
  assert.equal(review.totalRows, 3);
  assert.equal(review.readyRowCount, 1);
  assert.equal(review.attentionRowCount, 2);

  const persisted = await getLeadImportRun(actor, review.runId);
  assert.equal(persisted.runId, review.runId);
  assert.equal(persisted.rows.length, review.rows.length);

  const leadDuplicate = review.rows.find((row) => row.rowNumber === 2);
  const accountDuplicate = review.rows.find((row) => row.rowNumber === 3);

  assert.ok(leadDuplicate);
  assert.equal(leadDuplicate.status, 'potential_duplicate');
  assert.ok(leadDuplicate.candidates.some((candidate) => candidate.entityType === 'lead' && candidate.entityId === existingLead.id));

  assert.ok(accountDuplicate);
  assert.equal(accountDuplicate.status, 'potential_duplicate');
  assert.ok(accountDuplicate.candidates.some((candidate) => candidate.entityType === 'account' && candidate.entityId === existingAccount.id));
});

test('lead import requires duplicate decisions before committing duplicate rows', SERIAL, async () => {
  const actor = await createAdminActor();

  await createLead(actor, {
    companyName: 'North Air Partners',
    contactDisplayName: 'Jamie North',
    email: 'jamie.north@example.com',
    phone: '555-111-2222',
    state: 'TX',
    serviceTechCount: 3,
  });

  const csv = [
    'Company,Email,Phone,State,Service Tech Count',
    'North Air Partners,jamie.north@example.com,555-111-2222,TX,4',
    'Fresh Comfort,new@example.com,555-777-8888,TX,1',
  ].join('\n');

  const imported = await importLeadFile(actor, {
    fileName: 'lead-import.csv',
    fileContentBase64: toBase64(csv),
    mappings: buildMappings(),
  });

  assert.equal(imported.createdCount, 1);
  assert.equal(imported.errorCount, 1);
  assert.ok(imported.errors.some((error) => error.rowNumber === 2 && /Potential duplicate found/i.test(error.detail)));
});

test('lead import honors use-existing and create-new duplicate decisions', SERIAL, async () => {
  const actor = await createAdminActor();

  const duplicateLead = await createLead(actor, {
    companyName: 'North Air Partners',
    contactDisplayName: 'Jamie North',
    email: 'jamie.north@example.com',
    phone: '555-111-2222',
    state: 'TX',
    serviceTechCount: 3,
  });

  const duplicateAccount = await prisma.account.create({
    data: {
      displayName: 'Legacy Comfort Group',
      legalName: 'Legacy Comfort Group LLC',
    },
  });
  await prisma.contact.create({
    data: {
      accountId: duplicateAccount.id,
      firstName: 'Taylor',
      lastName: 'Legacy',
      email: 'legacy@example.com',
      phone: '555-999-0000',
      isPrimary: true,
    },
  });

  const csv = [
    'Company,Email,Phone,State,Service Tech Count',
    'North Air Partners,jamie.north@example.com,555-111-2222,TX,4',
    'Legacy Comfort Group,legacy@example.com,555-999-0000,FL,2',
  ].join('\n');

  const imported = await importLeadFile(actor, {
    fileName: 'lead-import.csv',
    fileContentBase64: toBase64(csv),
    mappings: buildMappings(),
    rowDecisions: [
      {
        rowNumber: 2,
        duplicateDecision: 'use_existing',
        targetEntityId: duplicateLead.id,
      },
      {
        rowNumber: 3,
        duplicateDecision: 'create_new',
      },
    ],
  });

  assert.equal(imported.errorCount, 0);
  assert.equal(imported.createdCount, 1);
  assert.equal(imported.skippedCount, 1);
  assert.equal(imported.items[0]?.companyName, 'Legacy Comfort Group');
  assert.ok(imported.skippedRows.some((row) => row.rowNumber === 2));
});

test('lead import use-existing account decisions skip creation and audit the account resolution', SERIAL, async () => {
  const actor = await createAdminActor();

  const duplicateAccount = await prisma.account.create({
    data: {
      displayName: 'Account Closure Comfort',
      legalName: 'Account Closure Comfort LLC',
    },
  });
  await prisma.contact.create({
    data: {
      accountId: duplicateAccount.id,
      firstName: 'Alex',
      lastName: 'Account',
      email: 'account-closure@example.com',
      phone: '555-414-7777',
      isPrimary: true,
    },
  });

  const csv = [
    'Company,Email,Phone,State,Service Tech Count',
    'Account Closure Comfort,account-closure@example.com,555-414-7777,FL,2',
  ].join('\n');

  const importActor = { ...actor };
  delete importActor.userId;

  const imported = await importLeadFile(importActor, {
    fileName: 'lead-import-account-duplicate.csv',
    fileContentBase64: toBase64(csv),
    mappings: buildMappings(),
    rowDecisions: [
      {
        rowNumber: 2,
        duplicateDecision: 'use_existing',
        targetEntityId: duplicateAccount.id,
      },
    ],
  });

  assert.equal(imported.errorCount, 0);
  assert.equal(imported.createdCount, 0);
  assert.equal(imported.skippedCount, 1);
  assert.equal(await prisma.lead.count({ where: { email: 'account-closure@example.com' } }), 0);
  assert.match(imported.skippedRows[0]?.detail ?? '', /existing customer account Account Closure Comfort/i);

  const audit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'ACCOUNT',
      entityId: duplicateAccount.id,
      action: 'UPDATE',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  assert.ok(audit, 'expected account duplicate-resolution audit entry');
  assert.equal(audit.metadata.workflowAction, 'duplicate_use_existing');
  assert.equal(audit.metadata.duplicateResolution.targetEntityId, duplicateAccount.id);
  assert.equal(audit.metadata.duplicateResolution.selectedCandidate.entityType, 'account');
  assert.equal(audit.afterData.duplicateImportResolution.rowNumber, 2);
});

test('lead import can enrich an existing lead from a duplicate row without creating a second lead', SERIAL, async () => {
  const actor = await createAdminActor();

  const duplicateLead = await createLead(actor, {
    companyName: 'Import Enrich Partners',
    contactDisplayName: 'Riley Import',
    email: 'riley.import@example.com',
    state: 'TX',
    serviceTechCount: 3,
  });

  const csv = [
    'Company,Email,Phone,State,Service Tech Count',
    'Import Enrich Partners,riley.import@example.com,555-222-3333,TX,8',
  ].join('\n');

  const imported = await importLeadFile(actor, {
    fileName: 'lead-import-enrich.csv',
    fileContentBase64: toBase64(csv),
    mappings: buildMappings(),
    rowDecisions: [
      {
        rowNumber: 2,
        duplicateDecision: 'enrich_existing',
        targetEntityId: duplicateLead.id,
      },
    ],
  });

  assert.equal(imported.errorCount, 0);
  assert.equal(imported.createdCount, 0);
  assert.equal(imported.skippedCount, 1);
  assert.equal(imported.skippedRows[0]?.decision, 'enrich_existing');
  assert.match(imported.skippedRows[0]?.detail ?? '', /enriched existing lead/i);

  const enrichedLead = await prisma.lead.findUniqueOrThrow({ where: { id: duplicateLead.id } });
  assert.equal(enrichedLead.phone, '555-222-3333');
  assert.equal(enrichedLead.serviceTechCount, 3);
});

test('lead import review flags within-file duplicates and allows skip decisions through persisted runs', SERIAL, async () => {
  const actor = await createAdminActor();

  const csv = [
    'Company,Email,Phone,State,Service Tech Count',
    'Fresh Comfort,new@example.com,555-777-8888,TX,1',
    'Fresh Comfort,new@example.com,555-777-8888,TX,1',
  ].join('\n');

  const review = await reviewLeadImport(actor, {
    fileName: 'lead-import.csv',
    fileContentBase64: toBase64(csv),
    mappings: buildMappings(),
  });

  assert.equal(review.readyRowCount, 1);
  assert.equal(review.attentionRowCount, 1);
  assert.ok(review.rows[0]?.candidates.some((candidate) => candidate.entityType === 'import_row'));

  const committed = await commitLeadImportRun(actor, review.runId, {
    rowDecisions: [
      {
        rowNumber: 3,
        duplicateDecision: 'skip',
      },
    ],
  });

  assert.equal(committed.createdCount, 1);
  assert.equal(committed.skippedCount, 1);
  assert.equal(committed.errorCount, 0);
  assert.ok(committed.skippedRows.some((row) => row.rowNumber === 3 && row.decision === 'skip'));

  const committedAgain = await commitLeadImportRun(actor, review.runId, {});
  assert.equal(committedAgain.createdCount, 1);
  assert.equal(committedAgain.skippedCount, 1);
  assert.equal(committedAgain.errorCount, 0);
});
