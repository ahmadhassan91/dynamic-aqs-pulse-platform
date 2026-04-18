import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let loadAppConfig;
let ensureReferenceDataSeeded;
let ensureTrainingSeeded;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let authenticateAccessToken;
let uploadTrainingSessionProof;

const SERIAL = { concurrency: false };
let uniqueFixtureCounter = 0;

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureTrainingSeeded, uploadTrainingSessionProof } = await import('../dist/modules/training/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword, authenticateAccessToken } = await import('../dist/modules/auth/service.js'));

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
  await ensureTrainingSeeded();
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
  return { actor };
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

async function createProofFixture() {
  uniqueFixtureCounter += 1;
  const token = `proof-${uniqueFixtureCounter}`;
  const trainer = await createUser('TRAINING_OPS', `trainer-${token}@pulse.local`, `Trainer ${token}`);
  const segment = await prisma.businessSegmentRef.findUniqueOrThrow({ where: { code: 'residential' } });
  const trainingType = await prisma.trainingType.findUniqueOrThrow({
    where: { code: 'iaq_certification_curriculum' },
  });

  const account = await prisma.account.create({
    data: {
      displayName: `Proof Account ${token}`,
      legalName: `Proof Account ${token} LLC`,
      accountType: 'Dealer',
      businessSegmentId: segment.id,
      isActive: true,
    },
  });

  const session = await prisma.trainingSession.create({
    data: {
      accountId: account.id,
      trainingTypeId: trainingType.id,
      trainerUserId: trainer.id,
      title: `Proof Session ${token}`,
      status: 'SCHEDULED',
      activityKind: 'TRAINING',
      certificationOutcome: 'PENDING_DECISION',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      durationMinutes: 90,
      attendeeCount: 2,
    },
  });

  return { trainer, account, session };
}

test('training proof upload stores bytes, persists metadata, and updates proof counters', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await createProofFixture();
  const fileContents = 'certificate-proof-binary';

  const response = await uploadTrainingSessionProof(actor, config, fixture.session.id, {
    documentType: 'certificate',
    fileName: 'iaq-certificate.pdf',
    mimeType: 'application/pdf',
    contentBase64: Buffer.from(fileContents, 'utf8').toString('base64'),
  });

  assert.equal(response.document.fileName, 'iaq-certificate.pdf');
  assert.equal(response.document.mimeType, 'application/pdf');
  assert.ok(response.document.storageKey.includes(fixture.session.id));
  assert.equal(response.session.proofAttachmentCount, 1);
  assert.ok(response.session.proofCapturedAt);
  assert.equal(response.session.proofDocuments.length, 1);

  const stored = await prisma.trainingProofDocument.findMany({
    where: { sessionId: fixture.session.id },
  });

  assert.equal(stored.length, 1);
  assert.ok(stored[0]?.sha256);

  const storedFilePath = path.join(process.env.APP_STORAGE_ROOT_DIR, stored[0].storageKey);
  assert.equal(existsSync(storedFilePath), true);
  assert.equal(readFileSync(storedFilePath, 'utf8'), fileContents);
});
