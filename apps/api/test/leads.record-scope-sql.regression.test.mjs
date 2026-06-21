import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

// FR-RPT-022 guardrail: computeLeadStageAging aggregates with raw SQL and therefore can't reuse the Prisma
// record-scope `where`. It instead mirrors it via resolveLeadRecordScopeSql. This suite proves the SQL mirror
// returns the EXACT same set of leads as the Prisma scope for every role + the pre-handoff toggle, so the
// raw path can never silently widen visibility.

let prisma;
let Prisma;
let config;
let ensureReferenceDataSeeded;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let resolveLeadRecordScope;
let resolveLeadRecordScopeSql;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma, Prisma } = await import('@pulse/db'));
  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));
  ({ resolveLeadRecordScope, resolveLeadRecordScopeSql } = await import('../dist/modules/auth/visibility.js'));
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
  await ensureBootstrapAdminSeeded(config);
});

function actorFor(user) {
  return { userId: user.id, sessionId: `test-${user.id}`, role: user.roleCode, actorType: 'internal', email: user.email, displayName: user.displayName };
}

async function adminActor() {
  const auth = await loginWithPassword(
    config,
    { email: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL, password: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD },
    {},
  );
  return {
    userId: auth.identity.userId,
    sessionId: auth.session.sessionId,
    role: auth.identity.role,
    actorType: auth.identity.actorType,
    email: auth.identity.email,
    displayName: auth.identity.displayName ?? 'Admin',
  };
}

async function leadIdsViaPrisma(actor) {
  const where = await resolveLeadRecordScope(actor);
  const rows = await prisma.lead.findMany({ where: where ?? {}, select: { id: true } });
  return rows.map((row) => row.id).sort();
}

async function leadIdsViaSql(actor) {
  const scope = await resolveLeadRecordScopeSql(actor);
  // Wrap the scope in parens exactly as the production consumer (computeLeadStageAging) embeds it
  // ("... AND (${scope})"), so this guardrail exercises the same operator precedence.
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT l."id" AS id
    FROM "Lead" l
    LEFT JOIN "Territory" t ON t."id" = l."territoryId"
    LEFT JOIN "Region" r ON r."id" = t."regionId"
    WHERE (${scope})
  `);
  return rows.map((row) => row.id).sort();
}

async function seed() {
  const segment = await prisma.businessSegmentRef.findFirst();
  const source = await prisma.leadSourceRef.findFirst();
  const tm1 = await prisma.user.create({ data: { email: 'scope.tm1@pulse.local', displayName: 'TM1', roleCode: 'TERRITORY_MANAGER', userType: 'INTERNAL', isActive: true } });
  const tm2 = await prisma.user.create({ data: { email: 'scope.tm2@pulse.local', displayName: 'TM2', roleCode: 'TERRITORY_MANAGER', userType: 'INTERNAL', isActive: true } });
  const rd1 = await prisma.user.create({ data: { email: 'scope.rd1@pulse.local', displayName: 'RD1', roleCode: 'REGIONAL_DIRECTOR', userType: 'INTERNAL', isActive: true } });
  const dealer = await prisma.user.create({ data: { email: 'scope.dealer@pulse.local', displayName: 'Dealer', roleCode: 'DEALER_PORTAL_USER', userType: 'DEALER', isActive: true } });

  const region1 = await prisma.region.create({ data: { code: 'scope_r1', name: 'R1', directorUserId: rd1.id } });
  const region2 = await prisma.region.create({ data: { code: 'scope_r2', name: 'R2' } }); // no director
  const territory1 = await prisma.territory.create({ data: { code: 'scope_t1', name: 'T1', regionId: region1.id, managerUserId: tm1.id } });
  const territory2 = await prisma.territory.create({ data: { code: 'scope_t2', name: 'T2', regionId: region2.id, managerUserId: tm2.id } });

  const base = { contactDisplayName: 'C', businessSegmentId: segment.id, leadSourceId: source.id, serviceTechCount: 4, routingBasisSnapshot: 'SERVICE_TECH_COUNT', routingThresholdSnapshot: 5, routingTeam: 'STRATEGIC_GROWTH' };
  // Diversity across every scope branch + edge cases (gate pass/fail, ownership direct vs via territory/region,
  // null territory exercising the LEFT JOINs, customer-active gate).
  await prisma.lead.createMany({
    data: [
      { ...base, companyName: 'L1', stage: 'NEW', assignedTmUserId: tm1.id, territoryId: territory1.id, territoryAssignmentMethod: 'DEFAULT_STATE' },
      { ...base, companyName: 'L2', stage: 'NEW', assignedTmUserId: tm1.id, territoryId: territory1.id, territoryAssignmentMethod: 'MANUAL_OVERRIDE' },
      { ...base, companyName: 'L3', stage: 'CUSTOMER_ACTIVE', territoryId: territory1.id, territoryAssignmentMethod: 'DEFAULT_STATE' },
      { ...base, companyName: 'L4', stage: 'NEW', assignedRdUserId: rd1.id, territoryId: territory2.id, territoryAssignmentMethod: 'DEFAULT_STATE' },
      { ...base, companyName: 'L5', stage: 'NEW', assignedTmUserId: tm2.id, territoryId: territory2.id, territoryAssignmentMethod: 'MANUAL_OVERRIDE' },
      { ...base, companyName: 'L6', stage: 'NEW', assignedTmUserId: tm1.id, territoryAssignmentMethod: 'DEFAULT_STATE' }, // null territory
      { ...base, companyName: 'L7', stage: 'NEW', assignedRdUserId: rd1.id }, // null territory
    ],
  });

  return { tm1, tm2, rd1, dealer };
}

test('record-scope SQL mirror matches the Prisma scope for every role (FR-RPT-022 guardrail)', SERIAL, async () => {
  const { tm1, rd1, dealer } = await seed();
  const admin = await adminActor();

  // Default policy (preHandoffTmVisibility = false): both implementations must agree per role.
  for (const actor of [admin, actorFor(tm1), actorFor(rd1)]) {
    const prismaIds = await leadIdsViaPrisma(actor);
    const sqlIds = await leadIdsViaSql(actor);
    assert.deepEqual(sqlIds, prismaIds, `scope mismatch for role ${actor.role}`);
  }

  // Other-scoped roles: the Prisma scope is the "match nothing" sentinel, which can't even be executed
  // against the uuid id column (Prisma rejects the non-uuid value) — it only never runs in practice because
  // such roles are blocked earlier by assertActionAccess. The SQL mirror returns FALSE -> empty for the same
  // case, which is equivalent in intent (sees nothing) and strictly more robust (no throw).
  assert.deepEqual(await resolveLeadRecordScope(actorFor(dealer)), { id: '__no-record-scope__' });

  // Sanity: scoping actually filters (global sees all; a TM sees strictly fewer; no-scope role sees none) —
  // so the parity above is not trivially passing on empty/identical sets.
  const adminIds = await leadIdsViaSql(admin);
  assert.equal(adminIds.length, 7);
  assert.ok((await leadIdsViaSql(actorFor(tm1))).length < adminIds.length);
  assert.equal((await leadIdsViaSql(actorFor(dealer))).length, 0);

  // Toggle pre-handoff TM visibility ON: both implementations still agree, and the TM's visible set changes
  // (proving the gate logic is mirrored, not ignored).
  const tmBefore = await leadIdsViaSql(actorFor(tm1));
  await prisma.territoryPolicy.upsert({
    where: { id: 'default' },
    update: { preHandoffTmVisibility: true },
    create: { id: 'default', preHandoffTmVisibility: true },
  });
  const tmPrismaAfter = await leadIdsViaPrisma(actorFor(tm1));
  const tmSqlAfter = await leadIdsViaSql(actorFor(tm1));
  assert.deepEqual(tmSqlAfter, tmPrismaAfter, 'TM pre-handoff scope mismatch');
  assert.notDeepEqual(tmSqlAfter, tmBefore, 'pre-handoff toggle should change the TM visible set');
});
