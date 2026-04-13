import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let loadAppConfig;
let createPulseServer;
let ensureReferenceDataSeeded;
let ensureLeadRoutingPolicySeeded;
let ensureWebsiteLeadConfigSeeded;
let ensureTerritoryPolicySeeded;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let authenticateAccessToken;
let createLead;
let getLeadDetail;
let createRegion;
let createShippingCenter;
let createTerritory;
let getTerritoryPolicy;
let listShippingCenters;
let listTerritoryAssignmentHistory;
let listTerritoryAssignableUsers;
let reassignLeadTerritory;
let replaceTerritoryCoverage;
let updateTerritoryPolicy;
const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ createPulseServer } = await import('../dist/server.js'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({
    ensureLeadRoutingPolicySeeded,
    ensureWebsiteLeadConfigSeeded,
    createLead,
    getLeadDetail,
  } = await import('../dist/modules/leads/service.js'));
  ({
    createRegion,
    createShippingCenter,
    createTerritory,
    ensureTerritoryPolicySeeded,
    getTerritoryPolicy,
    listShippingCenters,
    listTerritoryAssignmentHistory,
    listTerritoryAssignableUsers,
    reassignLeadTerritory,
    replaceTerritoryCoverage,
    updateTerritoryPolicy,
  } = await import('../dist/modules/territories/service.js'));
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
  await ensureLeadRoutingPolicySeeded();
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
  assert.ok(actor, 'expected a bootstrap admin actor');
  return { actor, auth };
}

function actorWithRole(actor, role) {
  return {
    ...actor,
    role,
  };
}

async function createUser(roleCode, email, displayName) {
  return prisma.user.create({
    data: {
      email,
      displayName,
      roleCode,
    },
  });
}

async function seedTerritoryFixture(actor, options = {}) {
  const suffix = options.suffix ?? 'primary';
  const stateCode = options.stateCode ?? 'TX';
  const director = await createUser(
    'REGIONAL_DIRECTOR',
    `rd-${suffix}@pulse.local`,
    `Regional Director ${suffix}`,
  );
  const manager = await createUser(
    'TERRITORY_MANAGER',
    `tm-${suffix}@pulse.local`,
    `Territory Manager ${suffix}`,
  );

  const shippingCenter = await createShippingCenter(actor, {
    code: options.shippingCenterCode ?? `ship_${suffix}`,
    name: options.shippingCenterName ?? `Shipping ${suffix}`,
    city: options.city ?? 'Houston',
    state: stateCode,
  });

  const region = await createRegion(actor, {
    code: options.regionCode ?? `region_${suffix}`,
    name: options.regionName ?? `Region ${suffix}`,
    directorUserId: director.id,
  });

  const territory = await createTerritory(actor, {
    code: options.territoryCode ?? `territory_${suffix}`,
    name: options.territoryName ?? `Territory ${suffix}`,
    regionId: region.id,
    managerUserId: manager.id,
    shippingCenterId: shippingCenter.id,
  });

  const coverageStates = options.coverageStates ?? [stateCode];
  const updatedTerritory = await replaceTerritoryCoverage(actor, territory.id, {
    coverage: coverageStates.map((entry) => ({ stateCode: entry })),
  });
  assert.ok(updatedTerritory, 'expected territory coverage to be saved');

  return {
    director,
    manager,
    shippingCenter,
    region,
    territory: updatedTerritory,
  };
}

test('territory routes are mounted on the server and default shipping centers are seeded', SERIAL, async () => {
  const { auth } = await createAdminSession();
  const runtime = await createPulseServer(loadAppConfig(process.env));

  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const address = runtime.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const [policyResponse, centersResponse] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/api/v1/territories/policy`, {
        headers: {
          authorization: `Bearer ${auth.tokens.accessToken}`,
        },
      }),
      fetch(`http://127.0.0.1:${port}/api/v1/territories/shipping-centers`, {
        headers: {
          authorization: `Bearer ${auth.tokens.accessToken}`,
        },
      }),
    ]);

    assert.equal(policyResponse.status, 200);
    assert.equal(centersResponse.status, 200);

    const policy = await policyResponse.json();
    const centers = await centersResponse.json();

    assert.equal(policy.preHandoffTmVisibility, false);
    assert.ok(Array.isArray(centers.items));
    assert.ok(centers.items.some((item) => item.code === 'nj_princeton'));
    assert.ok(centers.items.some((item) => item.code === 'fl_southeast'));
    assert.ok(centers.items.some((item) => item.code === 'nv_nevada'));
  } finally {
    await runtime.close();
  }
});

test('coverage replacement normalizes approved regions and rejects invalid state input', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await seedTerritoryFixture(actor, {
    suffix: 'normalize',
    stateCode: 'TX',
  });

  await replaceTerritoryCoverage(actor, fixture.territory.id, {
    coverage: [
      { stateCode: 'tx' },
      { stateCode: 'Ontario' },
    ],
  });

  const coverage = await prisma.territoryStateCoverage.findMany({
    where: {
      territoryId: fixture.territory.id,
    },
    orderBy: {
      stateCode: 'asc',
    },
  });

  assert.deepEqual(
    coverage.map((entry) => `${entry.countryCode}:${entry.stateCode}`),
    ['CA:ON', 'US:TX'],
  );

  await assert.rejects(
    () =>
      replaceTerritoryCoverage(actor, fixture.territory.id, {
        coverage: [{ stateCode: 'Atlantis' }],
      }),
    /State\/Province must be a valid US state or Canadian province/i,
  );
});

test('coverage conflicts block duplicate state ownership across territories', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const first = await seedTerritoryFixture(actor, {
    suffix: 'conflict_a',
    stateCode: 'FL',
  });
  const second = await seedTerritoryFixture(actor, {
    suffix: 'conflict_b',
    stateCode: 'TX',
  });

  await assert.rejects(
    () =>
      replaceTerritoryCoverage(actor, second.territory.id, {
        coverage: [{ stateCode: 'FL' }],
      }),
    /Coverage already exists for US:FL/i,
  );

  const firstCoverage = await prisma.territoryStateCoverage.findMany({
    where: { territoryId: first.territory.id },
  });
  assert.equal(firstCoverage.length, 1);
});

test('default state assignment is recorded for covered leads and territory metadata flows into the lead contract', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await seedTerritoryFixture(actor, {
    suffix: 'default_assignment',
    stateCode: 'Texas',
  });

  const lead = await createLead(actor, {
    companyName: 'Territory Default Assignment HVAC',
    serviceTechCount: 8,
    state: 'Texas',
  });

  assert.equal(lead.territoryAssignmentMethod, 'default_state');
  assert.equal(lead.territoryId, fixture.territory.id);
  assert.equal(lead.regionId, fixture.region.id);
  assert.equal(lead.shippingCenterId, fixture.shippingCenter.id);
  assert.equal(lead.assignedTmUserId, fixture.manager.id);
  assert.equal(lead.assignedRdUserId, fixture.director.id);

  const detail = await getLeadDetail(actor, lead.id);
  assert.ok(detail);
  assert.equal(detail.territoryCode, fixture.territory.code);
  assert.equal(detail.regionCode, fixture.region.code);
  assert.equal(detail.shippingCenterCode, fixture.shippingCenter.code);
});

test('territory policy matrix controls whether strategic growth and national TM leads inherit owner assignments', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await seedTerritoryFixture(actor, {
    suffix: 'policy_matrix',
    stateCode: 'CA',
  });

  const cases = [
    {
      name: 'strategic growth retains ownership',
      update: { strategicGrowthRetainsOwnership: true, assignNationalTmLeadsByDefault: true },
      input: { serviceTechCount: 2, state: 'CA' },
      expectTmAssigned: false,
    },
    {
      name: 'strategic growth can inherit assignment when policy disables retention',
      update: { strategicGrowthRetainsOwnership: false, assignNationalTmLeadsByDefault: true },
      input: { serviceTechCount: 2, state: 'CA' },
      expectTmAssigned: true,
    },
    {
      name: 'national TM leads assign by default',
      update: { strategicGrowthRetainsOwnership: true, assignNationalTmLeadsByDefault: true },
      input: { serviceTechCount: 9, state: 'CA' },
      expectTmAssigned: true,
    },
    {
      name: 'national TM leads can stay unassigned when default assignment is disabled',
      update: { strategicGrowthRetainsOwnership: true, assignNationalTmLeadsByDefault: false },
      input: { serviceTechCount: 9, state: 'CA' },
      expectTmAssigned: false,
    },
  ];

  for (const [index, scenario] of cases.entries()) {
    await updateTerritoryPolicy(actor, scenario.update);
    const lead = await createLead(actor, {
      companyName: `Policy Matrix ${index}`,
      ...scenario.input,
    });

    assert.equal(lead.territoryId, fixture.territory.id, scenario.name);
    if (scenario.expectTmAssigned) {
      assert.equal(lead.assignedTmUserId, fixture.manager.id, scenario.name);
      assert.equal(lead.assignedRdUserId, fixture.director.id, scenario.name);
    } else {
      assert.equal(lead.assignedTmUserId, undefined, scenario.name);
      assert.equal(lead.assignedRdUserId, undefined, scenario.name);
    }
  }
});

test('manual override works without lead state, writes history, and does not churn duplicate history on repeat assignment', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const first = await seedTerritoryFixture(actor, {
    suffix: 'override_a',
    stateCode: 'TX',
  });
  const second = await seedTerritoryFixture(actor, {
    suffix: 'override_b',
    stateCode: 'FL',
  });

  const lead = await createLead(actor, {
    companyName: 'Manual Override Without State IAQ',
    serviceTechCount: 4,
  });

  const firstAssignment = await reassignLeadTerritory(actor, lead.id, {
    territoryId: first.territory.id,
    reasonCode: 'manual_alignment',
    reasonNote: 'Manual assignment for uncovered lead.',
  });
  assert.ok(firstAssignment);
  assert.equal(firstAssignment.territoryId, first.territory.id);
  assert.equal(firstAssignment.shippingCenterId, first.shippingCenter.id);
  assert.equal(firstAssignment.assignedTmUserId, first.manager.id);
  assert.equal(firstAssignment.assignmentMethod, 'manual_override');

  const secondAssignment = await reassignLeadTerritory(actor, lead.id, {
    territoryId: second.territory.id,
    reasonCode: 'shipping_realignment',
    reasonNote: 'Shifted to alternate shipping hub.',
  });
  assert.ok(secondAssignment);
  assert.equal(secondAssignment.territoryId, second.territory.id);
  assert.equal(secondAssignment.shippingCenterId, second.shippingCenter.id);

  let history = await listTerritoryAssignmentHistory(actor, 'lead', lead.id);
  assert.equal(history.items.length, 2);
  assert.equal(history.items[0].previousTerritoryCode, first.territory.code);
  assert.equal(history.items[0].nextTerritoryCode, second.territory.code);
  assert.equal(history.items[0].previousShippingCenterId, first.shippingCenter.id);
  assert.equal(history.items[0].nextShippingCenterId, second.shippingCenter.id);
  assert.equal(history.items[0].changedByUserId, actor.userId);
  assert.equal(history.items[0].reasonCode, 'shipping_realignment');

  await reassignLeadTerritory(actor, lead.id, {
    territoryId: second.territory.id,
    reasonCode: 'shipping_realignment',
  });

  history = await listTerritoryAssignmentHistory(actor, 'lead', lead.id);
  assert.equal(history.items.length, 2, 'same-territory manual override should not create duplicate history');
});

test('assignable territory users only include active internal TMs and RDs', SERIAL, async () => {
  const { actor } = await createAdminSession();

  const tm = await createUser('TERRITORY_MANAGER', 'tm-assignable@pulse.local', 'Assignable TM');
  const rd = await createUser('REGIONAL_DIRECTOR', 'rd-assignable@pulse.local', 'Assignable RD');
  await createUser('SALES_BD_REP', 'sales-ignore@pulse.local', 'Ignore Sales');

  await prisma.user.create({
    data: {
      email: 'dealer-ignore@pulse.local',
      displayName: 'Ignore Dealer',
      roleCode: 'TERRITORY_MANAGER',
      userType: 'DEALER',
    },
  });

  await prisma.user.update({
    where: { id: tm.id },
    data: { isActive: false },
  });

  const response = await listTerritoryAssignableUsers(actor);

  assert.deepEqual(
    response.territoryManagers.map((user) => user.email),
    [],
  );
  assert.deepEqual(
    response.regionalDirectors.map((user) => user.email),
    ['rd-assignable@pulse.local'],
  );
});

test('manual lead override can pin explicit TM and RD owners, then fall back to territory defaults when cleared', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await seedTerritoryFixture(actor, {
    suffix: 'named_override',
    stateCode: 'WA',
  });
  const alternateTm = await createUser('TERRITORY_MANAGER', 'tm-alt@pulse.local', 'Alternate TM');
  const alternateRd = await createUser('REGIONAL_DIRECTOR', 'rd-alt@pulse.local', 'Alternate RD');

  const lead = await createLead(actor, {
    companyName: 'Named Owner Override HVAC',
    serviceTechCount: 8,
    state: 'WA',
  });

  const overridden = await reassignLeadTerritory(actor, lead.id, {
    territoryId: fixture.territory.id,
    assignedTmUserId: alternateTm.id,
    assignedRdUserId: alternateRd.id,
    reasonCode: 'manual_override',
    reasonNote: 'Leadership requested a named owner override.',
  });
  assert.equal(overridden?.assignedTmUserId, alternateTm.id);
  assert.equal(overridden?.assignedRdUserId, alternateRd.id);

  const detailAfterOverride = await getLeadDetail(actor, lead.id);
  assert.equal(detailAfterOverride?.assignedTmUserId, alternateTm.id);
  assert.equal(detailAfterOverride?.assignedRdUserId, alternateRd.id);

  const fallback = await reassignLeadTerritory(actor, lead.id, {
    territoryId: fixture.territory.id,
    assignedTmUserId: null,
    assignedRdUserId: null,
    reasonCode: 'manual_override',
    reasonNote: 'Return to the territory default ownership.',
  });
  assert.equal(fallback?.assignedTmUserId, fixture.manager.id);
  assert.equal(fallback?.assignedRdUserId, fixture.director.id);

  const history = await listTerritoryAssignmentHistory(actor, 'lead', lead.id);
  assert.equal(history.items.length, 3);
  assert.equal(history.items[0].nextAssignedTmUserId, fixture.manager.id);
  assert.equal(history.items[1].nextAssignedTmUserId, alternateTm.id);
});

test('named owner overrides reject inactive users and wrong roles', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await seedTerritoryFixture(actor, {
    suffix: 'named_override_validation',
    stateCode: 'OR',
  });
  const inactiveTm = await createUser('TERRITORY_MANAGER', 'tm-inactive@pulse.local', 'Inactive TM');
  const wrongRole = await createUser('FINANCE', 'finance@pulse.local', 'Finance User');

  await prisma.user.update({
    where: { id: inactiveTm.id },
    data: { isActive: false },
  });

  const lead = await createLead(actor, {
    companyName: 'Owner Validation HVAC',
    serviceTechCount: 7,
    state: 'OR',
  });

  await assert.rejects(
    () =>
      reassignLeadTerritory(actor, lead.id, {
        territoryId: fixture.territory.id,
        assignedTmUserId: inactiveTm.id,
        reasonCode: 'manual_override',
      }),
    /Unknown or inactive assignable user/i,
  );

  await assert.rejects(
    () =>
      reassignLeadTerritory(actor, lead.id, {
        territoryId: fixture.territory.id,
        assignedRdUserId: wrongRole.id,
        reasonCode: 'manual_override',
      }),
    /Selected user must have role REGIONAL_DIRECTOR/i,
  );
});

test('territory permissions allow RD admin actions, TM reassign actions, and deny unrelated roles', SERIAL, async () => {
  const { actor: adminActor } = await createAdminSession();
  const fixture = await seedTerritoryFixture(adminActor, {
    suffix: 'permissions',
    stateCode: 'NV',
  });

  const regionalDirectorActor = actorWithRole(adminActor, 'REGIONAL_DIRECTOR');
  const territoryManagerActor = actorWithRole(adminActor, 'TERRITORY_MANAGER');
  const salesActor = actorWithRole(adminActor, 'SALES_BD_REP');
  const financeActor = actorWithRole(adminActor, 'FINANCE');
  const dealerActor = actorWithRole(adminActor, 'DEALER_PORTAL_USER');

  const createdRegion = await createRegion(regionalDirectorActor, {
    code: 'region_permissions_rd',
    name: 'Region Permissions RD',
  });
  assert.equal(createdRegion.code, 'region_permissions_rd');

  await assert.rejects(
    () =>
      createRegion(territoryManagerActor, {
        code: 'region_permissions_tm',
        name: 'Region Permissions TM',
      }),
    (error) => error?.name === 'AuthorizationError',
  );

  await assert.rejects(
    () => updateTerritoryPolicy(territoryManagerActor, { preHandoffTmVisibility: true }),
    (error) => error?.name === 'AuthorizationError',
  );

  const lead = await createLead(adminActor, {
    companyName: 'Permissions Territory Lead',
    serviceTechCount: 3,
    state: 'NV',
  });

  const tmAssignment = await reassignLeadTerritory(territoryManagerActor, lead.id, {
    territoryId: fixture.territory.id,
    reasonCode: 'tm_override',
  });
  assert.ok(tmAssignment);

  for (const deniedActor of [salesActor, financeActor, dealerActor]) {
    await assert.rejects(
      () =>
        reassignLeadTerritory(deniedActor, lead.id, {
          territoryId: fixture.territory.id,
          reasonCode: 'denied_override',
        }),
      (error) => error?.name === 'AuthorizationError',
    );
  }
});
