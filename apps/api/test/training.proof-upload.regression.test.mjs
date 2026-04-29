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
let reviewTrainingSessionProof;
let downloadTrainingSessionProof;
let completeTrainingSession;
let listTrainingOperationalQueue;

const SERIAL = { concurrency: false };
let uniqueFixtureCounter = 0;

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({
    ensureTrainingSeeded,
    completeTrainingSession,
    downloadTrainingSessionProof,
    listTrainingOperationalQueue,
    reviewTrainingSessionProof,
    uploadTrainingSessionProof,
  } = await import('../dist/modules/training/service.js'));
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

  const downloaded = await downloadTrainingSessionProof(actor, config, response.document.id);
  assert.equal(downloaded.document.id, response.document.id);
  assert.equal(downloaded.document.fileName, 'iaq-certificate.pdf');
  assert.equal(downloaded.sizeBytes, Buffer.byteLength(fileContents, 'utf8'));
  assert.equal(Buffer.from(downloaded.contentBase64, 'base64').toString('utf8'), fileContents);
  assert.equal(downloaded.sha256, stored[0]?.sha256);

  const downloadAudit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'TRAINING_PROOF_DOCUMENT',
      entityId: response.document.id,
      metadata: {
        path: ['operation'],
        equals: 'download_proof',
      },
    },
  });
  assert.ok(downloadAudit);
});

test('training proof review records approval governance and audit evidence', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await createProofFixture();

  const uploaded = await uploadTrainingSessionProof(actor, config, fixture.session.id, {
    documentType: 'attendance_record',
    fileName: 'attendance.csv',
    mimeType: 'text/csv',
    contentBase64: Buffer.from('name,status\nTaylor,attended', 'utf8').toString('base64'),
  });

  assert.equal(uploaded.document.reviewStatus, 'pending_review');

  const reviewed = await reviewTrainingSessionProof(actor, uploaded.document.id, {
    reviewStatus: 'approved',
    reviewNotes: 'Attendance roster matches trainer checkout notes.',
  });

  assert.equal(reviewed.document.reviewStatus, 'approved');
  assert.equal(reviewed.document.reviewedByUserId, actor.userId);
  assert.equal(reviewed.document.reviewNotes, 'Attendance roster matches trainer checkout notes.');
  assert.ok(reviewed.document.reviewedAt);
  assert.equal(reviewed.session.proofDocuments[0]?.reviewStatus, 'approved');

  const stored = await prisma.trainingProofDocument.findUniqueOrThrow({
    where: { id: uploaded.document.id },
  });
  assert.equal(stored.reviewStatus, 'APPROVED');
  assert.equal(stored.reviewedByUserId, actor.userId);

  const audit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'TRAINING_PROOF_DOCUMENT',
      entityId: uploaded.document.id,
      metadata: {
        path: ['operation'],
        equals: 'review_proof',
      },
    },
  });
  assert.ok(audit);
});

test('rejected training proof appears in the operational exception queue', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await createProofFixture();

  const uploaded = await uploadTrainingSessionProof(actor, config, fixture.session.id, {
    documentType: 'certificate',
    fileName: 'unclear-certificate.pdf',
    mimeType: 'application/pdf',
    contentBase64: Buffer.from('unclear proof', 'utf8').toString('base64'),
  });

  await reviewTrainingSessionProof(actor, uploaded.document.id, {
    reviewStatus: 'rejected',
    reviewNotes: 'Certificate image is unreadable.',
  });

  await completeTrainingSession(actor, fixture.session.id, {
    completedAt: new Date(fixture.session.scheduledAt.getTime() + 90 * 60 * 1000).toISOString(),
    durationMinutes: 90,
    attendeeCount: 2,
    checkoutNotes: 'Completed, but proof needs a clearer upload.',
    certificationOutcome: 'awarded',
    certificationTitle: 'IAQ Certification Curriculum',
  }, config);

  const queue = await listTrainingOperationalQueue(actor, {});
  const rejectedProof = queue.unresolvedExecutionExceptions.find((entry) => (
    entry.sessionId === fixture.session.id && entry.type === 'proof_rejected'
  ));

  assert.ok(rejectedProof);
  assert.equal(rejectedProof.severity, 'medium');
  assert.equal(rejectedProof.detail, 'Training proof was rejected and needs corrected evidence before closure.');
});
