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
let ensureTrainingSeeded;
let ensureLeadRoutingPolicySeeded;
let ensureWebsiteLeadConfigSeeded;
let ensureTerritoryPolicySeeded;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let authenticateAccessToken;
let createLead;
let getLeadDetail;
let createAccount;
let createAccountLocation;
let updateAccountLocation;
let getAccountDetail;
let createRegion;
let createShippingCenter;
let createTerritory;
let getTerritoryDashboard;
let getTerritoryPolicy;
let listRegions;
let listShippingCenters;
let listTerritories;
let listTerritoryAssignmentHistory;
let listTerritoryAssignableUsers;
let bulkReassignAccountTerritories;
let bulkReassignLeadTerritories;
let reassignAccountTerritory;
let reassignLeadTerritory;
let replaceTerritoryCoverage;
let getTerritoryMapWorkspace;
let updateTerritory;
let updateTerritoryPolicy;
let createTrainingSession;
let checkInTrainingSession;
let completeTrainingSession;
const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ createPulseServer } = await import('../dist/server.js'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureTrainingSeeded, createTrainingSession, checkInTrainingSession, completeTrainingSession } = await import('../dist/modules/training/service.js'));
  ({
    ensureLeadRoutingPolicySeeded,
    ensureWebsiteLeadConfigSeeded,
    createLead,
    getLeadDetail,
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
  ({
    createAccount,
    createAccountLocation,
    updateAccountLocation,
    getAccountDetail,
  } = await import('../dist/modules/accounts/service.js'));
  ({
    createRegion,
    createShippingCenter,
    createTerritory,
    getTerritoryDashboard,
    ensureTerritoryPolicySeeded,
    getTerritoryPolicy,
    listRegions,
    listShippingCenters,
    listTerritories,
    listTerritoryAssignmentHistory,
    listTerritoryAssignableUsers,
    bulkReassignAccountTerritories,
    bulkReassignLeadTerritories,
    reassignAccountTerritory,
    reassignLeadTerritory,
    replaceTerritoryCoverage,
    getTerritoryMapWorkspace,
    updateTerritory,
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
  await ensureTrainingSeeded();
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

function actorForUser(user) {
  return {
    userId: user.id,
    sessionId: `test-session-${user.id}`,
    role: user.roleCode,
    actorType: 'internal',
    email: user.email,
    displayName: user.displayName,
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

    const [policyResponse, centersResponse, mapResponse, dashboardResponse] = await Promise.all([
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
      fetch(`http://127.0.0.1:${port}/api/v1/territories/map`, {
        headers: {
          authorization: `Bearer ${auth.tokens.accessToken}`,
        },
      }),
      fetch(`http://127.0.0.1:${port}/api/v1/territories/dashboard`, {
        headers: {
          authorization: `Bearer ${auth.tokens.accessToken}`,
        },
      }),
    ]);

    assert.equal(policyResponse.status, 200);
    assert.equal(centersResponse.status, 200);
    assert.equal(mapResponse.status, 200);
    assert.equal(dashboardResponse.status, 200);

    const policy = await policyResponse.json();
    const centers = await centersResponse.json();
    const map = await mapResponse.json();
    const dashboard = await dashboardResponse.json();

    assert.equal(policy.preHandoffTmVisibility, false);
    assert.ok(Array.isArray(centers.items));
    assert.ok(centers.items.some((item) => item.code === 'nj_princeton'));
    assert.ok(centers.items.some((item) => item.code === 'fl_southeast'));
    assert.ok(centers.items.some((item) => item.code === 'nv_nevada'));
    assert.ok(Array.isArray(map.shippingCenters));
    assert.ok(Array.isArray(dashboard.workloads));
    assert.ok(Array.isArray(dashboard.regionRollups));
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

test('territory map workspace returns live coverage entries, account pins, lead pins, and unassigned fallback markers', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await seedTerritoryFixture(actor, {
    suffix: 'map_workspace',
    stateCode: 'TX',
  });

  const coveredLead = await createLead(actor, {
    companyName: 'Territory Map Covered Lead',
    serviceTechCount: 8,
    state: 'TX',
  });
  const uncoveredLead = await createLead(actor, {
    companyName: 'Territory Map Unassigned Lead',
    serviceTechCount: 4,
  });

  const account = await prisma.account.create({
    data: {
      displayName: 'Territory Map Customer',
      territoryId: fixture.territory.id,
      territoryAssignmentMethod: 'MANUAL_OVERRIDE',
      territoryAssignedAt: new Date(),
      shippingCenterId: fixture.shippingCenter.id,
      assignedTmUserId: fixture.manager.id,
      assignedRdUserId: fixture.director.id,
      locations: {
        create: {
          name: 'Primary',
          city: 'Houston',
          state: 'TX',
          countryCode: 'US',
          isPrimary: true,
        },
      },
    },
  });

  const workspace = await getTerritoryMapWorkspace(actor);

  assert.ok(workspace.coverageEntries.some((entry) => entry.territoryId === fixture.territory.id && entry.stateCode === 'TX'));
  assert.ok(workspace.leadPins.some((pin) => pin.recordId === coveredLead.id && pin.territoryId === fixture.territory.id));
  assert.ok(workspace.leadPins.some((pin) => pin.recordId === uncoveredLead.id && !pin.territoryId));

  const accountPin = workspace.accountPins.find((pin) => pin.recordId === account.id);
  assert.ok(accountPin);
  assert.equal(accountPin.city, 'Houston');
  assert.equal(accountPin.state, 'TX');
  assert.equal(accountPin.geoPrecision, 'city_state');

  const shippingCenter = workspace.shippingCenters.find((center) => center.id === fixture.shippingCenter.id);
  assert.ok(shippingCenter);
  assert.equal(shippingCenter.servicedTerritoryCount, 1);
  assert.ok(shippingCenter.activeLeadCount >= 1);
  assert.ok(shippingCenter.activeAccountCount >= 1);

  const routePlan = workspace.routePlans.find((plan) => plan.territoryId === fixture.territory.id);
  assert.ok(routePlan);
  assert.equal(routePlan.providerDependency, 'none');
  assert.equal(routePlan.isProviderOptimized, false);
  assert.equal(routePlan.shippingCenterId, fixture.shippingCenter.id);
  assert.equal(routePlan.accountStopCount, 1);
  assert.equal(routePlan.leadStopCount, 1);
  assert.equal(routePlan.stopCount, 2);
  assert.deepEqual(
    routePlan.stops.map((stop) => stop.sequence),
    [1, 2],
  );
  assert.ok(routePlan.estimatedStraightLineMiles >= 0);
});

test('territory read visibility scopes region, territory, shipping center, and map workspace payloads for a TM', SERIAL, async () => {
  const { actor } = await createAdminSession();
  await prisma.territoryPolicy.update({
    where: { id: 'default' },
    data: { preHandoffTmVisibility: true },
  });
  const visible = await seedTerritoryFixture(actor, {
    suffix: 'tm_scope_visible',
    stateCode: 'TX',
  });
  const peerTm = await createUser('TERRITORY_MANAGER', 'tm-scope-peer@pulse.local', 'TM Scope Peer');
  const peerShippingCenter = await createShippingCenter(actor, {
    code: 'ship_tm_scope_peer',
    name: 'TM Scope Peer Shipping',
    city: 'Tulsa',
    state: 'OK',
  });
  const peerTerritory = await createTerritory(actor, {
    code: 'territory_tm_scope_peer',
    name: 'TM Scope Peer Territory',
    regionId: visible.region.id,
    managerUserId: peerTm.id,
    shippingCenterId: peerShippingCenter.id,
  });
  await replaceTerritoryCoverage(actor, peerTerritory.id, {
    coverage: [{ stateCode: 'OK' }],
  });

  const hidden = await seedTerritoryFixture(actor, {
    suffix: 'tm_scope_hidden',
    stateCode: 'FL',
  });

  const visibleLead = await createLead(actor, {
    companyName: 'TM Scope Visible Lead',
    serviceTechCount: 5,
    state: 'TX',
  });
  const peerLead = await createLead(actor, {
    companyName: 'TM Scope Peer Lead',
    serviceTechCount: 5,
    state: 'OK',
  });
  const hiddenLead = await createLead(actor, {
    companyName: 'TM Scope Hidden Lead',
    serviceTechCount: 5,
    state: 'FL',
  });

  const visibleAccount = await prisma.account.create({
    data: {
      displayName: 'TM Scope Visible Customer',
      territoryId: visible.territory.id,
      territoryAssignmentMethod: 'MANUAL_OVERRIDE',
      territoryAssignedAt: new Date(),
      shippingCenterId: visible.shippingCenter.id,
      assignedTmUserId: visible.manager.id,
      assignedRdUserId: visible.director.id,
      locations: {
        create: {
          name: 'Primary',
          city: 'Houston',
          state: 'TX',
          countryCode: 'US',
          isPrimary: true,
        },
      },
    },
  });
  const peerAccount = await prisma.account.create({
    data: {
      displayName: 'TM Scope Peer Customer',
      territoryId: peerTerritory.id,
      territoryAssignmentMethod: 'MANUAL_OVERRIDE',
      territoryAssignedAt: new Date(),
      shippingCenterId: peerShippingCenter.id,
      assignedTmUserId: peerTm.id,
      assignedRdUserId: visible.director.id,
      locations: {
        create: {
          name: 'Primary',
          city: 'Tulsa',
          state: 'OK',
          countryCode: 'US',
          isPrimary: true,
        },
      },
    },
  });
  const hiddenAccount = await prisma.account.create({
    data: {
      displayName: 'TM Scope Hidden Customer',
      territoryId: hidden.territory.id,
      territoryAssignmentMethod: 'MANUAL_OVERRIDE',
      territoryAssignedAt: new Date(),
      shippingCenterId: hidden.shippingCenter.id,
      assignedTmUserId: hidden.manager.id,
      assignedRdUserId: hidden.director.id,
      locations: {
        create: {
          name: 'Primary',
          city: 'Fort Lauderdale',
          state: 'FL',
          countryCode: 'US',
          isPrimary: true,
        },
      },
    },
  });

  const tmActor = actorForUser(visible.manager);

  const [regions, territories, shippingCenters, workspace] = await Promise.all([
    listRegions(tmActor),
    listTerritories(tmActor),
    listShippingCenters(tmActor),
    getTerritoryMapWorkspace(tmActor),
  ]);

  assert.deepEqual(regions.items.map((item) => item.id), [visible.region.id]);
  assert.equal(regions.items[0]?.territoryCount, 1);

  assert.deepEqual(territories.items.map((item) => item.id), [visible.territory.id]);
  assert.deepEqual(shippingCenters.items.map((item) => item.id), [visible.shippingCenter.id]);

  assert.deepEqual(workspace.regions.map((item) => item.id), [visible.region.id]);
  assert.deepEqual(workspace.territories.map((item) => item.id), [visible.territory.id]);
  assert.ok(workspace.coverageEntries.every((entry) => entry.territoryId === visible.territory.id));
  assert.ok(workspace.leadPins.some((pin) => pin.recordId === visibleLead.id));
  assert.ok(!workspace.leadPins.some((pin) => pin.recordId === peerLead.id));
  assert.ok(!workspace.leadPins.some((pin) => pin.recordId === hiddenLead.id));
  assert.ok(workspace.accountPins.some((pin) => pin.recordId === visibleAccount.id));
  assert.ok(!workspace.accountPins.some((pin) => pin.recordId === peerAccount.id));
  assert.ok(!workspace.accountPins.some((pin) => pin.recordId === hiddenAccount.id));
  assert.deepEqual(workspace.shippingCenters.map((item) => item.id), [visible.shippingCenter.id]);
  assert.ok(workspace.routePlans.length >= 1);
  assert.ok(workspace.routePlans.every((plan) => plan.territoryId === visible.territory.id));
  assert.ok(workspace.routePlans.every((plan) => plan.providerDependency === 'none'));
  assert.ok(workspace.routePlans.every((plan) => plan.stops.every((stop) => stop.territoryId === visible.territory.id)));
});

test('lead-derived territory visibility for TMs obeys the pre-handoff policy gate', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const leadTm = await createUser('TERRITORY_MANAGER', 'tm-prehandoff-derived@pulse.local', 'TM Prehandoff Derived');
  const territoryManager = await createUser('TERRITORY_MANAGER', 'tm-prehandoff-territory@pulse.local', 'TM Prehandoff Territory');
  const director = await createUser('REGIONAL_DIRECTOR', 'rd-prehandoff-derived@pulse.local', 'RD Prehandoff Derived');
  const shippingCenter = await createShippingCenter(actor, {
    code: 'ship_prehandoff_derived',
    name: 'Prehandoff Derived Shipping',
    city: 'Phoenix',
    state: 'AZ',
  });
  const region = await createRegion(actor, {
    code: 'region_prehandoff_derived',
    name: 'Prehandoff Derived Region',
    directorUserId: director.id,
  });
  const territory = await createTerritory(actor, {
    code: 'territory_prehandoff_derived',
    name: 'Prehandoff Derived Territory',
    regionId: region.id,
    managerUserId: territoryManager.id,
    shippingCenterId: shippingCenter.id,
  });
  await replaceTerritoryCoverage(actor, territory.id, {
    coverage: [{ stateCode: 'AZ' }],
  });

  const lead = await createLead(actor, {
    companyName: 'Prehandoff Derived Territory Lead',
    serviceTechCount: 8,
    state: 'AZ',
  });
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      assignedTmUserId: leadTm.id,
      assignedTmName: leadTm.displayName,
    },
  });

  const tmActor = actorForUser(leadTm);
  const [hiddenRegions, hiddenTerritories, hiddenShippingCenters, hiddenWorkspace] = await Promise.all([
    listRegions(tmActor),
    listTerritories(tmActor),
    listShippingCenters(tmActor),
    getTerritoryMapWorkspace(tmActor),
  ]);

  assert.deepEqual(hiddenRegions.items.map((item) => item.id), []);
  assert.deepEqual(hiddenTerritories.items.map((item) => item.id), []);
  assert.deepEqual(hiddenShippingCenters.items.map((item) => item.id), []);
  assert.deepEqual(hiddenWorkspace.regions.map((item) => item.id), []);
  assert.deepEqual(hiddenWorkspace.territories.map((item) => item.id), []);
  assert.deepEqual(hiddenWorkspace.shippingCenters.map((item) => item.id), []);
  assert.ok(!hiddenWorkspace.leadPins.some((pin) => pin.recordId === lead.id));

  await prisma.territoryPolicy.update({
    where: { id: 'default' },
    data: { preHandoffTmVisibility: true },
  });

  const [visibleRegions, visibleTerritories, visibleShippingCenters, visibleWorkspace] = await Promise.all([
    listRegions(tmActor),
    listTerritories(tmActor),
    listShippingCenters(tmActor),
    getTerritoryMapWorkspace(tmActor),
  ]);

  assert.deepEqual(visibleRegions.items.map((item) => item.id), [region.id]);
  assert.deepEqual(visibleTerritories.items.map((item) => item.id), [territory.id]);
  assert.deepEqual(visibleShippingCenters.items.map((item) => item.id), [shippingCenter.id]);
  assert.deepEqual(visibleWorkspace.regions.map((item) => item.id), [region.id]);
  assert.deepEqual(visibleWorkspace.territories.map((item) => item.id), [territory.id]);
  assert.deepEqual(visibleWorkspace.shippingCenters.map((item) => item.id), [shippingCenter.id]);
  assert.ok(visibleWorkspace.leadPins.some((pin) => pin.recordId === lead.id));
});

test('territory read visibility scopes region, territory, shipping center, and map workspace payloads for an RD', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const visible = await seedTerritoryFixture(actor, {
    suffix: 'rd_scope_visible',
    stateCode: 'TX',
  });
  const peerTm = await createUser('TERRITORY_MANAGER', 'rd-scope-peer-tm@pulse.local', 'RD Scope Peer TM');
  const peerShippingCenter = await createShippingCenter(actor, {
    code: 'ship_rd_scope_peer',
    name: 'RD Scope Peer Shipping',
    city: 'Tulsa',
    state: 'OK',
  });
  const peerTerritory = await createTerritory(actor, {
    code: 'territory_rd_scope_peer',
    name: 'RD Scope Peer Territory',
    regionId: visible.region.id,
    managerUserId: peerTm.id,
    shippingCenterId: peerShippingCenter.id,
  });
  await replaceTerritoryCoverage(actor, peerTerritory.id, {
    coverage: [{ stateCode: 'OK' }],
  });

  const hidden = await seedTerritoryFixture(actor, {
    suffix: 'rd_scope_hidden',
    stateCode: 'FL',
  });

  const visibleLead = await createLead(actor, {
    companyName: 'RD Scope Visible Lead',
    serviceTechCount: 5,
    state: 'TX',
  });
  const peerLead = await createLead(actor, {
    companyName: 'RD Scope Peer Lead',
    serviceTechCount: 5,
    state: 'OK',
  });
  const hiddenLead = await createLead(actor, {
    companyName: 'RD Scope Hidden Lead',
    serviceTechCount: 5,
    state: 'FL',
  });

  const visibleAccount = await prisma.account.create({
    data: {
      displayName: 'RD Scope Visible Customer',
      territoryId: visible.territory.id,
      territoryAssignmentMethod: 'MANUAL_OVERRIDE',
      territoryAssignedAt: new Date(),
      shippingCenterId: visible.shippingCenter.id,
      assignedTmUserId: visible.manager.id,
      assignedRdUserId: visible.director.id,
      locations: {
        create: {
          name: 'Primary',
          city: 'Houston',
          state: 'TX',
          countryCode: 'US',
          isPrimary: true,
        },
      },
    },
  });
  const peerAccount = await prisma.account.create({
    data: {
      displayName: 'RD Scope Peer Customer',
      territoryId: peerTerritory.id,
      territoryAssignmentMethod: 'MANUAL_OVERRIDE',
      territoryAssignedAt: new Date(),
      shippingCenterId: peerShippingCenter.id,
      assignedTmUserId: peerTm.id,
      assignedRdUserId: visible.director.id,
      locations: {
        create: {
          name: 'Primary',
          city: 'Tulsa',
          state: 'OK',
          countryCode: 'US',
          isPrimary: true,
        },
      },
    },
  });
  const hiddenAccount = await prisma.account.create({
    data: {
      displayName: 'RD Scope Hidden Customer',
      territoryId: hidden.territory.id,
      territoryAssignmentMethod: 'MANUAL_OVERRIDE',
      territoryAssignedAt: new Date(),
      shippingCenterId: hidden.shippingCenter.id,
      assignedTmUserId: hidden.manager.id,
      assignedRdUserId: hidden.director.id,
      locations: {
        create: {
          name: 'Primary',
          city: 'Fort Lauderdale',
          state: 'FL',
          countryCode: 'US',
          isPrimary: true,
        },
      },
    },
  });

  const rdActor = actorForUser(visible.director);

  const [regions, territories, shippingCenters, workspace] = await Promise.all([
    listRegions(rdActor),
    listTerritories(rdActor),
    listShippingCenters(rdActor),
    getTerritoryMapWorkspace(rdActor),
  ]);

  assert.deepEqual(regions.items.map((item) => item.id), [visible.region.id]);
  assert.equal(regions.items[0]?.territoryCount, 2);

  assert.deepEqual(
    territories.items.map((item) => item.id).sort(),
    [peerTerritory.id, visible.territory.id].sort(),
  );
  assert.deepEqual(
    shippingCenters.items.map((item) => item.id).sort(),
    [peerShippingCenter.id, visible.shippingCenter.id].sort(),
  );

  assert.deepEqual(workspace.regions.map((item) => item.id), [visible.region.id]);
  assert.deepEqual(
    workspace.territories.map((item) => item.id).sort(),
    [peerTerritory.id, visible.territory.id].sort(),
  );
  assert.ok(workspace.coverageEntries.every((entry) => entry.regionId === visible.region.id));
  assert.ok(workspace.leadPins.some((pin) => pin.recordId === visibleLead.id));
  assert.ok(workspace.leadPins.some((pin) => pin.recordId === peerLead.id));
  assert.ok(!workspace.leadPins.some((pin) => pin.recordId === hiddenLead.id));
  assert.ok(workspace.accountPins.some((pin) => pin.recordId === visibleAccount.id));
  assert.ok(workspace.accountPins.some((pin) => pin.recordId === peerAccount.id));
  assert.ok(!workspace.accountPins.some((pin) => pin.recordId === hiddenAccount.id));
  assert.deepEqual(
    workspace.shippingCenters.map((item) => item.id).sort(),
    [peerShippingCenter.id, visible.shippingCenter.id].sort(),
  );
  assert.ok(workspace.routePlans.length >= 2);
  assert.deepEqual(
    workspace.routePlans.map((plan) => plan.territoryId).sort(),
    [peerTerritory.id, visible.territory.id].sort(),
  );
  assert.ok(workspace.routePlans.every((plan) => plan.providerDependency === 'none'));
  assert.ok(!workspace.routePlans.some((plan) => plan.territoryId === hidden.territory.id));
});

test('territory dashboard returns operational workload, queue, region, and owner rollups for broad roles', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const texas = await seedTerritoryFixture(actor, {
    suffix: 'dashboard_tx',
    stateCode: 'TX',
  });
  const florida = await seedTerritoryFixture(actor, {
    suffix: 'dashboard_fl',
    stateCode: 'FL',
  });

  const texasLeadA = await createLead(actor, {
    companyName: 'Dashboard Texas Lead A',
    serviceTechCount: 6,
    state: 'TX',
  });
  const texasLeadB = await createLead(actor, {
    companyName: 'Dashboard Texas Lead B',
    serviceTechCount: 5,
    state: 'TX',
  });
  await prisma.lead.update({
    where: { id: texasLeadB.id },
    data: { routingTeam: 'STRATEGIC_GROWTH' },
  });
  const floridaLead = await createLead(actor, {
    companyName: 'Dashboard Florida Lead',
    serviceTechCount: 4,
    state: 'FL',
  });
  const unassignedLead = await createLead(actor, {
    companyName: 'Dashboard Unassigned Lead',
    serviceTechCount: 3,
  });
  await prisma.lead.updateMany({
    where: {
      id: {
        in: [texasLeadA.id, floridaLead.id, unassignedLead.id],
      },
    },
    data: { routingTeam: 'NATIONAL_TM' },
  });

  const texasAccount = await createAccount(actor, {
    displayName: 'Dashboard Texas Account',
    legalName: 'Dashboard Texas Account LLC',
    accountType: 'Dealer',
  });
  await createAccountLocation(actor, texasAccount.id, {
    name: 'Primary',
    city: 'Dallas',
    state: 'TX',
    countryCode: 'US',
    isPrimary: true,
  });
  const trainingType = await prisma.trainingType.findUniqueOrThrow({
    where: { code: 'how_and_when' },
  });
  await prisma.trainingSession.create({
    data: {
      accountId: texasAccount.id,
      trainingTypeId: trainingType.id,
      trainerUserId: texas.manager.id,
      title: 'Territory Dashboard Training',
      status: 'COMPLETED',
      activityKind: 'TRAINING',
      certificationOutcome: 'NOT_APPLICABLE',
      scheduledAt: new Date('2026-03-01T09:00:00.000Z'),
      checkedInAt: new Date('2026-03-01T09:00:00.000Z'),
      checkedOutAt: new Date('2026-03-01T10:00:00.000Z'),
      completedAt: new Date('2026-03-01T10:00:00.000Z'),
      durationMinutes: 60,
      attendeeCount: 4,
      checkoutNotes: 'Completed successfully.',
      proofCapturedAt: new Date('2026-03-01T10:00:00.000Z'),
    },
  });

  const floridaAccount = await createAccount(actor, {
    displayName: 'Dashboard Florida Account',
    legalName: 'Dashboard Florida Account LLC',
    accountType: 'Dealer',
  });
  await createAccountLocation(actor, floridaAccount.id, {
    name: 'Primary',
    city: 'Miami',
    state: 'FL',
    countryCode: 'US',
    isPrimary: true,
  });

  await createAccount(actor, {
    displayName: 'Dashboard Unassigned Account',
    legalName: 'Dashboard Unassigned Account LLC',
    accountType: 'Dealer',
  });

  const dashboard = await getTerritoryDashboard(actor);

  assert.equal(dashboard.stats.regions, 2);
  assert.equal(dashboard.stats.territories, 2);
  assert.equal(dashboard.stats.activeLeads, 4);
  assert.equal(dashboard.stats.assignedLeads, 3);
  assert.equal(dashboard.stats.unassignedLeads, 1);
  assert.equal(dashboard.stats.activeAccounts, 3);
  assert.equal(dashboard.stats.assignedAccounts, 2);
  assert.equal(dashboard.stats.unassignedAccounts, 1);
  assert.equal(dashboard.stats.strategicGrowthLeads, 1);

  assert.ok(dashboard.alerts.some((item) => item.label === 'Unassigned active leads'));
  assert.ok(dashboard.alerts.some((item) => item.label === 'Unassigned active accounts'));

  assert.equal(dashboard.queue.unassignedLeads, 1);
  assert.equal(dashboard.queue.unassignedAccounts, 1);

  const texasWorkload = dashboard.workloads.find((item) => item.territoryId === texas.territory.id);
  assert.ok(texasWorkload);
  assert.equal(texasWorkload.activeLeadCount, 2);
  assert.equal(texasWorkload.activeAccountCount, 1);
  assert.equal(texasWorkload.totalWorkloadCount, 3);

  const texasRegionRollup = dashboard.regionRollups.find((item) => item.regionId === texas.region.id);
  assert.ok(texasRegionRollup);
  assert.equal(texasRegionRollup.activeLeadCount, 2);
  assert.equal(texasRegionRollup.activeAccountCount, 1);
  assert.equal(texasRegionRollup.territoryCount, 1);
  assert.equal(texasRegionRollup.trainedAccounts, 1);
  assert.equal(texasRegionRollup.trainingPenetrationPercent, 100);

  const texasTmMetric = dashboard.ownerMetrics.find(
    (item) => item.ownerRole === 'territory_manager' && item.ownerUserId === texas.manager.id,
  );
  assert.ok(texasTmMetric);
  assert.equal(texasTmMetric.activeLeadCount, 2);
  assert.equal(texasTmMetric.activeAccountCount, 1);

  const texasRdMetric = dashboard.ownerMetrics.find(
    (item) => item.ownerRole === 'regional_director' && item.ownerUserId === texas.director.id,
  );
  assert.ok(texasRdMetric);
  assert.equal(texasRdMetric.activeLeadCount, 2);
  assert.equal(texasRdMetric.activeAccountCount, 1);
});

test('territory dashboard scopes workload and owner rollups for a TM', SERIAL, async () => {
  const { actor } = await createAdminSession();
  await updateTerritoryPolicy(actor, {
    preHandoffTmVisibility: true,
  });
  const visible = await seedTerritoryFixture(actor, {
    suffix: 'dashboard_tm_visible',
    stateCode: 'TX',
  });
  const peerTm = await createUser('TERRITORY_MANAGER', 'dashboard-tm-peer@pulse.local', 'Dashboard TM Peer');
  const peerShippingCenter = await createShippingCenter(actor, {
    code: 'ship_dashboard_tm_peer',
    name: 'Dashboard TM Peer Shipping',
    city: 'Tulsa',
    state: 'OK',
  });
  const peerTerritory = await createTerritory(actor, {
    code: 'territory_dashboard_tm_peer',
    name: 'Dashboard TM Peer Territory',
    regionId: visible.region.id,
    managerUserId: peerTm.id,
    shippingCenterId: peerShippingCenter.id,
  });
  await replaceTerritoryCoverage(actor, peerTerritory.id, {
    coverage: [{ stateCode: 'OK' }],
  });

  const hidden = await seedTerritoryFixture(actor, {
    suffix: 'dashboard_tm_hidden',
    stateCode: 'FL',
  });

  await createLead(actor, {
    companyName: 'Dashboard TM Visible Lead',
    serviceTechCount: 5,
    state: 'TX',
  });
  await createLead(actor, {
    companyName: 'Dashboard TM Peer Lead',
    serviceTechCount: 5,
    state: 'OK',
  });
  await createLead(actor, {
    companyName: 'Dashboard TM Hidden Lead',
    serviceTechCount: 5,
    state: 'FL',
  });

  const visibleAccount = await createAccount(actor, {
    displayName: 'Dashboard TM Visible Account',
    legalName: 'Dashboard TM Visible Account LLC',
    accountType: 'Dealer',
  });
  await createAccountLocation(actor, visibleAccount.id, {
    name: 'Primary',
    city: 'Houston',
    state: 'TX',
    countryCode: 'US',
    isPrimary: true,
  });

  const peerAccount = await createAccount(actor, {
    displayName: 'Dashboard TM Peer Account',
    legalName: 'Dashboard TM Peer Account LLC',
    accountType: 'Dealer',
  });
  await createAccountLocation(actor, peerAccount.id, {
    name: 'Primary',
    city: 'Tulsa',
    state: 'OK',
    countryCode: 'US',
    isPrimary: true,
  });

  const hiddenAccount = await createAccount(actor, {
    displayName: 'Dashboard TM Hidden Account',
    legalName: 'Dashboard TM Hidden Account LLC',
    accountType: 'Dealer',
  });
  await createAccountLocation(actor, hiddenAccount.id, {
    name: 'Primary',
    city: 'Miami',
    state: 'FL',
    countryCode: 'US',
    isPrimary: true,
  });

  const dashboard = await getTerritoryDashboard(actorForUser(visible.manager));

  assert.equal(dashboard.stats.regions, 1);
  assert.equal(dashboard.stats.territories, 1);
  assert.equal(dashboard.stats.activeLeads, 1);
  assert.equal(dashboard.stats.activeAccounts, 1);
  assert.equal(dashboard.stats.unassignedLeads, 0);
  assert.equal(dashboard.stats.unassignedAccounts, 0);
  assert.deepEqual(dashboard.regionRollups.map((item) => item.regionId), [visible.region.id]);
  assert.deepEqual(dashboard.workloads.map((item) => item.territoryId), [visible.territory.id]);

  const tmOwnerNames = dashboard.ownerMetrics
    .filter((item) => item.ownerRole === 'territory_manager')
    .map((item) => item.ownerUserId);
  assert.deepEqual(tmOwnerNames, [visible.manager.id]);
  assert.ok(!dashboard.workloads.some((item) => item.territoryId === peerTerritory.id));
  assert.ok(!dashboard.workloads.some((item) => item.territoryId === hidden.territory.id));
});

test('territory dashboard scopes regional rollups and peer territory workload for an RD', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const visible = await seedTerritoryFixture(actor, {
    suffix: 'dashboard_rd_visible',
    stateCode: 'TX',
  });
  const peerTm = await createUser('TERRITORY_MANAGER', 'dashboard-rd-peer-tm@pulse.local', 'Dashboard RD Peer TM');
  const peerShippingCenter = await createShippingCenter(actor, {
    code: 'ship_dashboard_rd_peer',
    name: 'Dashboard RD Peer Shipping',
    city: 'Tulsa',
    state: 'OK',
  });
  const peerTerritory = await createTerritory(actor, {
    code: 'territory_dashboard_rd_peer',
    name: 'Dashboard RD Peer Territory',
    regionId: visible.region.id,
    managerUserId: peerTm.id,
    shippingCenterId: peerShippingCenter.id,
  });
  await replaceTerritoryCoverage(actor, peerTerritory.id, {
    coverage: [{ stateCode: 'OK' }],
  });

  const hidden = await seedTerritoryFixture(actor, {
    suffix: 'dashboard_rd_hidden',
    stateCode: 'FL',
  });

  await createLead(actor, {
    companyName: 'Dashboard RD Visible Lead',
    serviceTechCount: 5,
    state: 'TX',
  });
  await createLead(actor, {
    companyName: 'Dashboard RD Peer Lead',
    serviceTechCount: 5,
    state: 'OK',
  });
  await createLead(actor, {
    companyName: 'Dashboard RD Hidden Lead',
    serviceTechCount: 5,
    state: 'FL',
  });

  const visibleAccount = await createAccount(actor, {
    displayName: 'Dashboard RD Visible Account',
    legalName: 'Dashboard RD Visible Account LLC',
    accountType: 'Dealer',
  });
  await createAccountLocation(actor, visibleAccount.id, {
    name: 'Primary',
    city: 'Houston',
    state: 'TX',
    countryCode: 'US',
    isPrimary: true,
  });

  const peerAccount = await createAccount(actor, {
    displayName: 'Dashboard RD Peer Account',
    legalName: 'Dashboard RD Peer Account LLC',
    accountType: 'Dealer',
  });
  await createAccountLocation(actor, peerAccount.id, {
    name: 'Primary',
    city: 'Tulsa',
    state: 'OK',
    countryCode: 'US',
    isPrimary: true,
  });

  const hiddenAccount = await createAccount(actor, {
    displayName: 'Dashboard RD Hidden Account',
    legalName: 'Dashboard RD Hidden Account LLC',
    accountType: 'Dealer',
  });
  await createAccountLocation(actor, hiddenAccount.id, {
    name: 'Primary',
    city: 'Miami',
    state: 'FL',
    countryCode: 'US',
    isPrimary: true,
  });

  const dashboard = await getTerritoryDashboard(actorForUser(visible.director));

  assert.equal(dashboard.stats.regions, 1);
  assert.equal(dashboard.stats.territories, 2);
  assert.equal(dashboard.stats.activeLeads, 2);
  assert.equal(dashboard.stats.activeAccounts, 2);
  assert.deepEqual(
    dashboard.workloads.map((item) => item.territoryId).sort(),
    [peerTerritory.id, visible.territory.id].sort(),
  );

  const regionRollup = dashboard.regionRollups.find((item) => item.regionId === visible.region.id);
  assert.ok(regionRollup);
  assert.equal(regionRollup.territoryCount, 2);
  assert.equal(regionRollup.activeLeadCount, 2);
  assert.equal(regionRollup.activeAccountCount, 2);

  const managerMetricIds = dashboard.ownerMetrics
    .filter((item) => item.ownerRole === 'territory_manager')
    .map((item) => item.ownerUserId)
    .sort();
  assert.deepEqual(managerMetricIds, [peerTm.id, visible.manager.id].sort());

  const directorMetric = dashboard.ownerMetrics.find(
    (item) => item.ownerRole === 'regional_director' && item.ownerUserId === visible.director.id,
  );
  assert.ok(directorMetric);
  assert.equal(directorMetric.territoryCount, 2);
  assert.equal(directorMetric.activeLeadCount, 2);
  assert.equal(directorMetric.activeAccountCount, 2);
  assert.ok(!dashboard.workloads.some((item) => item.territoryId === hidden.territory.id));
});

test('territory dashboard reports coverage score, lifecycle posture, and pipeline phases from CRM-owned data', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const texas = await seedTerritoryFixture(actor, {
    suffix: 'dashboard_reporting_tx',
    stateCode: 'TX',
  });
  const florida = await seedTerritoryFixture(actor, {
    suffix: 'dashboard_reporting_fl',
    stateCode: 'FL',
  });

  const newLead = await createLead(actor, {
    companyName: 'Dashboard Reporting New Lead',
    serviceTechCount: 8,
    state: 'TX',
  });
  const cisLead = await createLead(actor, {
    companyName: 'Dashboard Reporting CIS Lead',
    serviceTechCount: 8,
    state: 'TX',
  });
  const onboardingLead = await createLead(actor, {
    companyName: 'Dashboard Reporting Onboarding Lead',
    serviceTechCount: 4,
    state: 'FL',
  });
  const discoveryLead = await createLead(actor, {
    companyName: 'Dashboard Reporting Discovery Lead',
    serviceTechCount: 4,
  });

  await prisma.lead.update({
    where: { id: cisLead.id },
    data: { stage: 'CIS_SENT' },
  });
  await prisma.lead.update({
    where: { id: onboardingLead.id },
    data: { stage: 'ONBOARDING_COMPLETED' },
  });
  await prisma.lead.update({
    where: { id: discoveryLead.id },
    data: { stage: 'DISCOVERY_SCHEDULED' },
  });

  const engagedAccount = await createAccount(actor, {
    displayName: 'Dashboard Reporting Engaged Account',
    legalName: 'Dashboard Reporting Engaged Account LLC',
    accountType: 'Dealer',
  });
  await createAccountLocation(actor, engagedAccount.id, {
    name: 'Primary',
    city: 'Dallas',
    state: 'TX',
    countryCode: 'US',
    isPrimary: true,
  });
  await prisma.account.update({
    where: { id: engagedAccount.id },
    data: {
      lifecycleStatus: 'ACTIVE',
      lastEngagementAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  });

  const atRiskAccount = await createAccount(actor, {
    displayName: 'Dashboard Reporting At Risk Account',
    legalName: 'Dashboard Reporting At Risk Account LLC',
    accountType: 'Dealer',
  });
  await createAccountLocation(actor, atRiskAccount.id, {
    name: 'Primary',
    city: 'Miami',
    state: 'FL',
    countryCode: 'US',
    isPrimary: true,
  });
  await prisma.account.update({
    where: { id: atRiskAccount.id },
    data: {
      lifecycleStatus: 'AT_RISK',
      lastEngagementAt: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000),
    },
  });

  const churnedAccount = await createAccount(actor, {
    displayName: 'Dashboard Reporting Churned Account',
    legalName: 'Dashboard Reporting Churned Account LLC',
    accountType: 'Dealer',
  });
  await prisma.account.update({
    where: { id: churnedAccount.id },
    data: {
      isActive: false,
      lifecycleStatus: 'CHURNED',
      lastEngagementAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
    },
  });

  const dashboard = await getTerritoryDashboard(actor);

  assert.equal(dashboard.coverage.eligibleAccountCount, 2);
  assert.equal(dashboard.coverage.engaged30DayCount, 1);
  assert.equal(dashboard.coverage.engaged60DayCount, 1);
  assert.equal(dashboard.coverage.engaged90DayCount, 2);
  assert.equal(dashboard.coverage.overdue90DayCount, 0);
  assert.equal(dashboard.coverage.engaged30DayPercent, 50);
  assert.equal(dashboard.coverage.engaged90DayPercent, 100);

  assert.equal(dashboard.lifecycle.activeAccountCount, 1);
  assert.equal(dashboard.lifecycle.atRiskAccountCount, 1);
  assert.equal(dashboard.lifecycle.inactiveAccountCount, 0);
  assert.equal(dashboard.lifecycle.churnedAccountCount, 1);

  assert.equal(dashboard.pipeline.newLeadCount, 1);
  assert.equal(dashboard.pipeline.discoveryLeadCount, 1);
  assert.equal(dashboard.pipeline.cisLeadCount, 1);
  assert.equal(dashboard.pipeline.onboardingLeadCount, 1);

  const texasWorkload = dashboard.workloads.find((item) => item.territoryId === texas.territory.id);
  assert.ok(texasWorkload);
  assert.equal(texasWorkload.engaged30DayAccountCount, 1);
  assert.equal(texasWorkload.overdue90DayAccountCount, 0);
  assert.equal(texasWorkload.atRiskAccountCount, 0);
  assert.equal(texasWorkload.newLeadCount, 1);
  assert.equal(texasWorkload.discoveryLeadCount, 0);
  assert.equal(texasWorkload.cisLeadCount, 1);
  assert.equal(texasWorkload.onboardingLeadCount, 0);

  const floridaWorkload = dashboard.workloads.find((item) => item.territoryId === florida.territory.id);
  assert.ok(floridaWorkload);
  assert.equal(floridaWorkload.engaged30DayAccountCount, 0);
  assert.equal(floridaWorkload.engaged90DayAccountCount, 1);
  assert.equal(floridaWorkload.atRiskAccountCount, 1);
  assert.equal(floridaWorkload.newLeadCount, 0);
  assert.equal(floridaWorkload.discoveryLeadCount, 0);
  assert.equal(floridaWorkload.cisLeadCount, 0);
  assert.equal(floridaWorkload.onboardingLeadCount, 1);

  const texasRegionRollup = dashboard.regionRollups.find((item) => item.regionId === texas.region.id);
  assert.ok(texasRegionRollup);
  assert.equal(texasRegionRollup.engaged30DayAccountCount, 1);
  assert.equal(texasRegionRollup.overdue90DayAccountCount, 0);
  assert.equal(texasRegionRollup.atRiskAccountCount, 0);
  assert.equal(texasRegionRollup.newLeadCount, 1);
  assert.equal(texasRegionRollup.cisLeadCount, 1);

  const floridaRegionRollup = dashboard.regionRollups.find((item) => item.regionId === florida.region.id);
  assert.ok(floridaRegionRollup);
  assert.equal(floridaRegionRollup.engaged30DayAccountCount, 0);
  assert.equal(floridaRegionRollup.engaged90DayAccountCount, 1);
  assert.equal(floridaRegionRollup.atRiskAccountCount, 1);
  assert.equal(floridaRegionRollup.onboardingLeadCount, 1);

  const texasTmMetric = dashboard.ownerMetrics.find(
    (item) => item.ownerRole === 'territory_manager' && item.ownerUserId === texas.manager.id,
  );
  assert.ok(texasTmMetric);
  assert.equal(texasTmMetric.engaged30DayAccountCount, 1);
  assert.equal(texasTmMetric.atRiskAccountCount, 0);

  const floridaTmMetric = dashboard.ownerMetrics.find(
    (item) => item.ownerRole === 'territory_manager' && item.ownerUserId === florida.manager.id,
  );
  assert.ok(floridaTmMetric);
  assert.equal(floridaTmMetric.engaged30DayAccountCount, 0);
  assert.equal(floridaTmMetric.atRiskAccountCount, 1);
});

test('territory dashboard reporting metrics stay scoped to the visible TM slice', SERIAL, async () => {
  const { actor } = await createAdminSession();
  await updateTerritoryPolicy(actor, {
    preHandoffTmVisibility: true,
  });

  const visible = await seedTerritoryFixture(actor, {
    suffix: 'dashboard_reporting_tm_visible',
    stateCode: 'TX',
  });
  const hidden = await seedTerritoryFixture(actor, {
    suffix: 'dashboard_reporting_tm_hidden',
    stateCode: 'FL',
  });

  await createLead(actor, {
    companyName: 'Dashboard Reporting TM Visible Lead',
    serviceTechCount: 7,
    state: 'TX',
  });
  const hiddenLead = await createLead(actor, {
    companyName: 'Dashboard Reporting TM Hidden Lead',
    serviceTechCount: 7,
    state: 'FL',
  });
  await prisma.lead.update({
    where: { id: hiddenLead.id },
    data: { stage: 'CIS_SENT' },
  });

  const visibleAccount = await createAccount(actor, {
    displayName: 'Dashboard Reporting TM Visible Account',
    legalName: 'Dashboard Reporting TM Visible Account LLC',
    accountType: 'Dealer',
  });
  await createAccountLocation(actor, visibleAccount.id, {
    name: 'Primary',
    city: 'Houston',
    state: 'TX',
    countryCode: 'US',
    isPrimary: true,
  });
  await prisma.account.update({
    where: { id: visibleAccount.id },
    data: {
      lifecycleStatus: 'ACTIVE',
      lastEngagementAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    },
  });

  const hiddenAccount = await createAccount(actor, {
    displayName: 'Dashboard Reporting TM Hidden Account',
    legalName: 'Dashboard Reporting TM Hidden Account LLC',
    accountType: 'Dealer',
  });
  await createAccountLocation(actor, hiddenAccount.id, {
    name: 'Primary',
    city: 'Miami',
    state: 'FL',
    countryCode: 'US',
    isPrimary: true,
  });
  await prisma.account.update({
    where: { id: hiddenAccount.id },
    data: {
      lifecycleStatus: 'AT_RISK',
      lastEngagementAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
    },
  });

  const dashboard = await getTerritoryDashboard(actorForUser(visible.manager));

  assert.equal(dashboard.coverage.eligibleAccountCount, 1);
  assert.equal(dashboard.coverage.engaged30DayCount, 1);
  assert.equal(dashboard.coverage.overdue90DayCount, 0);
  assert.equal(dashboard.lifecycle.activeAccountCount, 1);
  assert.equal(dashboard.lifecycle.atRiskAccountCount, 0);
  assert.equal(dashboard.pipeline.newLeadCount, 1);
  assert.equal(dashboard.pipeline.cisLeadCount, 0);
  assert.deepEqual(dashboard.workloads.map((item) => item.territoryId), [visible.territory.id]);
});

test('territory assignment history denies out-of-scope entity reads for TMs while keeping visible records accessible', SERIAL, async () => {
  const { actor } = await createAdminSession();
  await updateTerritoryPolicy(actor, {
    preHandoffTmVisibility: true,
  });
  const visible = await seedTerritoryFixture(actor, {
    suffix: 'history_scope_visible',
    stateCode: 'TX',
  });
  const hidden = await seedTerritoryFixture(actor, {
    suffix: 'history_scope_hidden',
    stateCode: 'FL',
  });

  const visibleLead = await createLead(actor, {
    companyName: 'History Scope Visible Lead',
    serviceTechCount: 6,
    state: 'TX',
  });
  const hiddenLead = await createLead(actor, {
    companyName: 'History Scope Hidden Lead',
    serviceTechCount: 6,
    state: 'FL',
  });

  const visibleAccount = await createAccount(actor, {
    displayName: 'History Scope Visible Account',
    legalName: 'History Scope Visible Account LLC',
    accountType: 'Dealer',
  });
  const hiddenAccount = await createAccount(actor, {
    displayName: 'History Scope Hidden Account',
    legalName: 'History Scope Hidden Account LLC',
    accountType: 'Dealer',
  });

  await createAccountLocation(actor, visibleAccount.id, {
    name: 'Primary',
    city: 'Austin',
    state: 'TX',
    countryCode: 'US',
    isPrimary: true,
  });
  await createAccountLocation(actor, hiddenAccount.id, {
    name: 'Primary',
    city: 'Fort Lauderdale',
    state: 'FL',
    countryCode: 'US',
    isPrimary: true,
  });

  const tmActor = actorForUser(visible.manager);

  const visibleLeadHistory = await listTerritoryAssignmentHistory(tmActor, 'lead', visibleLead.id);
  assert.ok(visibleLeadHistory.items.length >= 1);

  const visibleAccountHistory = await listTerritoryAssignmentHistory(tmActor, 'account', visibleAccount.id);
  assert.ok(visibleAccountHistory.items.length >= 1);

  await assert.rejects(
    () => listTerritoryAssignmentHistory(tmActor, 'lead', hiddenLead.id),
    (error) => error?.name === 'AuthorizationError',
  );
  await assert.rejects(
    () => listTerritoryAssignmentHistory(tmActor, 'account', hiddenAccount.id),
    (error) => error?.name === 'AuthorizationError',
  );
});

test('territory reassignment writes deny out-of-scope records for TMs and keep bulk updates atomic', SERIAL, async () => {
  const { actor } = await createAdminSession();
  await updateTerritoryPolicy(actor, {
    preHandoffTmVisibility: true,
  });
  const visible = await seedTerritoryFixture(actor, {
    suffix: 'reassign_scope_visible',
    stateCode: 'TX',
  });
  const hidden = await seedTerritoryFixture(actor, {
    suffix: 'reassign_scope_hidden',
    stateCode: 'FL',
  });

  const visibleLead = await createLead(actor, {
    companyName: 'Reassign Scope Visible Lead',
    serviceTechCount: 6,
    state: 'TX',
  });
  const hiddenLead = await createLead(actor, {
    companyName: 'Reassign Scope Hidden Lead',
    serviceTechCount: 6,
    state: 'FL',
  });

  const visibleAccount = await createAccount(actor, {
    displayName: 'Reassign Scope Visible Account',
    legalName: 'Reassign Scope Visible Account LLC',
    accountType: 'Dealer',
  });
  const hiddenAccount = await createAccount(actor, {
    displayName: 'Reassign Scope Hidden Account',
    legalName: 'Reassign Scope Hidden Account LLC',
    accountType: 'Dealer',
  });
  await createAccountLocation(actor, visibleAccount.id, {
    name: 'Primary',
    city: 'Austin',
    state: 'TX',
    countryCode: 'US',
    isPrimary: true,
  });
  await createAccountLocation(actor, hiddenAccount.id, {
    name: 'Primary',
    city: 'Fort Lauderdale',
    state: 'FL',
    countryCode: 'US',
    isPrimary: true,
  });

  const tmActor = actorForUser(visible.manager);
  const visibleLeadAssignment = await reassignLeadTerritory(tmActor, visibleLead.id, {
    territoryId: visible.territory.id,
    reasonCode: 'tm_visible_override',
  });
  assert.ok(visibleLeadAssignment);

  const visibleAccountAssignment = await reassignAccountTerritory(tmActor, visibleAccount.id, {
    territoryId: visible.territory.id,
    reasonCode: 'tm_visible_account_override',
  });
  assert.ok(visibleAccountAssignment);

  await assert.rejects(
    () =>
      reassignLeadTerritory(tmActor, visibleLead.id, {
        territoryId: hidden.territory.id,
        reasonCode: 'tm_hidden_target_override',
      }),
    /inaccessible territory/i,
  );
  await assert.rejects(
    () =>
      reassignAccountTerritory(tmActor, visibleAccount.id, {
        territoryId: hidden.territory.id,
        reasonCode: 'tm_hidden_target_account_override',
      }),
    /inaccessible territory/i,
  );

  await assert.rejects(
    () =>
      reassignLeadTerritory(tmActor, hiddenLead.id, {
        territoryId: visible.territory.id,
        reasonCode: 'tm_hidden_override',
      }),
    (error) => error?.name === 'AuthorizationError',
  );
  await assert.rejects(
    () =>
      reassignAccountTerritory(tmActor, hiddenAccount.id, {
        territoryId: visible.territory.id,
        reasonCode: 'tm_hidden_account_override',
      }),
    (error) => error?.name === 'AuthorizationError',
  );

  await assert.rejects(
    () =>
      bulkReassignLeadTerritories(tmActor, {
        leadIds: [visibleLead.id],
        territoryId: hidden.territory.id,
        reasonCode: 'tm_hidden_target_bulk_lead_override',
      }),
    /inaccessible territory/i,
  );
  await assert.rejects(
    () =>
      bulkReassignAccountTerritories(tmActor, {
        accountIds: [visibleAccount.id],
        territoryId: hidden.territory.id,
        reasonCode: 'tm_hidden_target_bulk_account_override',
      }),
    /inaccessible territory/i,
  );

  await assert.rejects(
    () =>
      bulkReassignAccountTerritories(tmActor, {
        accountIds: [visibleAccount.id, hiddenAccount.id],
        territoryId: visible.territory.id,
        reasonCode: 'tm_mixed_bulk_override',
      }),
    (error) => error?.name === 'AuthorizationError',
  );

  const hiddenDetail = await getAccountDetail(actor, hiddenAccount.id);
  assert.ok(hiddenDetail);
  assert.equal(hiddenDetail.territoryId, hidden.territory.id);
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

test('account territory assignment is derived from the primary location and refreshes when the primary state changes', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const texas = await seedTerritoryFixture(actor, {
    suffix: 'account_location_tx',
    stateCode: 'TX',
  });
  const florida = await seedTerritoryFixture(actor, {
    suffix: 'account_location_fl',
    stateCode: 'FL',
  });

  const account = await createAccount(actor, {
    displayName: 'Account Location Territory Refresh',
    legalName: 'Account Location Territory Refresh LLC',
    accountType: 'Dealer',
  });

  const location = await createAccountLocation(actor, account.id, {
    name: 'Primary',
    city: 'Dallas',
    state: 'TX',
    countryCode: 'US',
    isPrimary: true,
  });

  let detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  assert.equal(detail.territoryId, texas.territory.id);
  assert.equal(detail.shippingCenterId, texas.shippingCenter.id);
  assert.equal(detail.assignedTmUserId, texas.manager.id);
  assert.equal(detail.assignedRdUserId, texas.director.id);
  assert.equal(detail.territoryAssignmentMethod, 'default_state');

  await updateAccountLocation(actor, account.id, location.id, {
    state: 'FL',
  });

  detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  assert.equal(detail.territoryId, florida.territory.id);
  assert.equal(detail.shippingCenterId, florida.shippingCenter.id);
  assert.equal(detail.assignedTmUserId, florida.manager.id);
  assert.equal(detail.assignedRdUserId, florida.director.id);

  const history = await listTerritoryAssignmentHistory(actor, 'account', account.id);
  assert.equal(history.items.length, 2);
  assert.equal(history.items[0].nextTerritoryCode, florida.territory.code);
  assert.equal(history.items[1].nextTerritoryCode, texas.territory.code);
});

test('manual account override survives later primary-location changes until the override is cleared', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const texas = await seedTerritoryFixture(actor, {
    suffix: 'account_override_tx',
    stateCode: 'TX',
  });
  const florida = await seedTerritoryFixture(actor, {
    suffix: 'account_override_fl',
    stateCode: 'FL',
  });
  const alternateTm = await createUser('TERRITORY_MANAGER', 'tm-account-override@pulse.local', 'Account Override TM');
  const alternateRd = await createUser('REGIONAL_DIRECTOR', 'rd-account-override@pulse.local', 'Account Override RD');

  const account = await createAccount(actor, {
    displayName: 'Account Territory Manual Override',
    legalName: 'Account Territory Manual Override LLC',
    accountType: 'Dealer',
  });

  const location = await createAccountLocation(actor, account.id, {
    name: 'Primary',
    city: 'Austin',
    state: 'TX',
    countryCode: 'US',
    isPrimary: true,
  });

  let detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  assert.equal(detail.territoryId, texas.territory.id);

  const override = await reassignAccountTerritory(actor, account.id, {
    territoryId: florida.territory.id,
    assignedTmUserId: alternateTm.id,
    assignedRdUserId: alternateRd.id,
    reasonCode: 'manual_override',
    reasonNote: 'Customer belongs with the Florida team.',
  });
  assert.equal(override?.territoryId, florida.territory.id);
  assert.equal(override?.assignedTmUserId, alternateTm.id);
  assert.equal(override?.assignedRdUserId, alternateRd.id);

  await updateAccountLocation(actor, account.id, location.id, {
    state: 'TX',
    city: 'Houston',
  });

  detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  assert.equal(detail.territoryId, florida.territory.id);
  assert.equal(detail.assignedTmUserId, alternateTm.id);
  assert.equal(detail.assignedRdUserId, alternateRd.id);
  assert.equal(detail.territoryAssignmentMethod, 'manual_override');

  const history = await listTerritoryAssignmentHistory(actor, 'account', account.id);
  assert.equal(history.items.length, 2, 'location changes should not churn account history when an override still owns the account');
  assert.equal(history.items[0].nextTerritoryCode, florida.territory.code);
  assert.equal(history.items[1].nextTerritoryCode, texas.territory.code);
});

test('bulk account transfer reassigns multiple accounts with individual history and audit-safe ownership updates', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const texas = await seedTerritoryFixture(actor, {
    suffix: 'bulk_account_tx',
    stateCode: 'TX',
  });
  const florida = await seedTerritoryFixture(actor, {
    suffix: 'bulk_account_fl',
    stateCode: 'FL',
  });

  const first = await createAccount(actor, {
    displayName: 'Bulk Transfer Alpha',
    legalName: 'Bulk Transfer Alpha LLC',
    accountType: 'Dealer',
  });
  const second = await createAccount(actor, {
    displayName: 'Bulk Transfer Bravo',
    legalName: 'Bulk Transfer Bravo LLC',
    accountType: 'Dealer',
  });

  await createAccountLocation(actor, first.id, {
    name: 'Primary',
    city: 'Dallas',
    state: 'TX',
    countryCode: 'US',
    isPrimary: true,
  });
  await createAccountLocation(actor, second.id, {
    name: 'Primary',
    city: 'Austin',
    state: 'TX',
    countryCode: 'US',
    isPrimary: true,
  });

  const response = await bulkReassignAccountTerritories(actor, {
    accountIds: [first.id, second.id],
    territoryId: florida.territory.id,
    assignedTmUserId: florida.manager.id,
    assignedRdUserId: florida.director.id,
    reasonCode: 'territory_realignment',
    reasonNote: 'Bulk transfer after leadership approved the new Florida alignment.',
  });

  assert.equal(response.items.length, 2);
  assert.deepEqual(
    response.items.map((item) => item.accountId).sort(),
    [first.id, second.id].sort(),
  );
  assert.ok(response.items.every((item) => item.territoryId === florida.territory.id));
  assert.ok(response.items.every((item) => item.assignmentMethod === 'manual_override'));

  const firstDetail = await getAccountDetail(actor, first.id);
  const secondDetail = await getAccountDetail(actor, second.id);
  assert.equal(firstDetail?.territoryId, florida.territory.id);
  assert.equal(secondDetail?.territoryId, florida.territory.id);
  assert.equal(firstDetail?.assignedTmUserId, florida.manager.id);
  assert.equal(secondDetail?.assignedRdUserId, florida.director.id);

  const firstHistory = await listTerritoryAssignmentHistory(actor, 'account', first.id);
  const secondHistory = await listTerritoryAssignmentHistory(actor, 'account', second.id);
  assert.equal(firstHistory.items.length, 2);
  assert.equal(secondHistory.items.length, 2);
  assert.equal(firstHistory.items[0].reasonCode, 'territory_realignment');
  assert.equal(secondHistory.items[0].reasonCode, 'territory_realignment');
  assert.equal(firstHistory.items[0].previousTerritoryCode, texas.territory.code);
  assert.equal(secondHistory.items[0].previousTerritoryCode, texas.territory.code);
  assert.equal(firstHistory.items[0].nextTerritoryCode, florida.territory.code);
  assert.equal(secondHistory.items[0].nextTerritoryCode, florida.territory.code);

  const bulkAuditEntries = await prisma.auditEntry.findMany({
    where: {
      entityType: 'TERRITORY_ASSIGNMENT_OVERRIDE',
      entityId: {
        in: [first.id, second.id],
      },
      metadata: {
        path: ['operation'],
        equals: 'territory.bulk_reassign_accounts',
      },
    },
  });
  assert.equal(bulkAuditEntries.length, 2);
});

test('bulk lead transfer reassigns multiple pipeline leads with individual history and audit-safe ownership updates', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const texas = await seedTerritoryFixture(actor, {
    suffix: 'bulk_lead_tx',
    stateCode: 'TX',
  });
  const florida = await seedTerritoryFixture(actor, {
    suffix: 'bulk_lead_fl',
    stateCode: 'FL',
  });

  const first = await createLead(actor, {
    companyName: 'Bulk Lead Alpha',
    contactDisplayName: 'Alpha Contact',
    email: 'bulk.lead.alpha@example.com',
    phone: '555-100-4101',
    state: 'TX',
    serviceTechCount: 3,
  });
  const second = await createLead(actor, {
    companyName: 'Bulk Lead Bravo',
    contactDisplayName: 'Bravo Contact',
    email: 'bulk.lead.bravo@example.com',
    phone: '555-100-4102',
    state: 'TX',
    serviceTechCount: 4,
  });

  const response = await bulkReassignLeadTerritories(actor, {
    leadIds: [first.id, second.id],
    territoryId: florida.territory.id,
    assignedTmUserId: florida.manager.id,
    assignedRdUserId: florida.director.id,
    reasonCode: 'territory_realignment',
    reasonNote: 'Prototype parity bulk lead transfer for reassigned TM state ownership.',
  });

  assert.equal(response.items.length, 2);
  assert.deepEqual(
    response.items.map((item) => item.leadId).sort(),
    [first.id, second.id].sort(),
  );
  assert.ok(response.items.every((item) => item.territoryId === florida.territory.id));
  assert.ok(response.items.every((item) => item.assignmentMethod === 'manual_override'));

  const firstDetail = await getLeadDetail(actor, first.id);
  const secondDetail = await getLeadDetail(actor, second.id);
  assert.equal(firstDetail?.territoryId, florida.territory.id);
  assert.equal(secondDetail?.territoryId, florida.territory.id);
  assert.equal(firstDetail?.assignedTmUserId, florida.manager.id);
  assert.equal(secondDetail?.assignedRdUserId, florida.director.id);

  const firstHistory = await listTerritoryAssignmentHistory(actor, 'lead', first.id);
  const secondHistory = await listTerritoryAssignmentHistory(actor, 'lead', second.id);
  assert.equal(firstHistory.items.length, 2);
  assert.equal(secondHistory.items.length, 2);
  assert.equal(firstHistory.items[0].previousTerritoryCode, texas.territory.code);
  assert.equal(secondHistory.items[0].nextTerritoryCode, florida.territory.code);

  const bulkAuditEntries = await prisma.auditEntry.findMany({
    where: {
      entityType: 'TERRITORY_ASSIGNMENT_OVERRIDE',
      entityId: {
        in: [first.id, second.id],
      },
      metadata: {
        path: ['operation'],
        equals: 'territory.bulk_reassign_leads',
      },
    },
  });
  assert.equal(bulkAuditEntries.length, 2);
});

test('bulk lead transfer preserves existing lead activity authorship while recording transfer actor metadata', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const texas = await seedTerritoryFixture(actor, {
    suffix: 'bulk_lead_author_texas',
    stateCode: 'TX',
  });
  const florida = await seedTerritoryFixture(actor, {
    suffix: 'bulk_lead_author_florida',
    stateCode: 'FL',
  });
  const originalAuthor = await createUser('SALES_BD_REP', 'lead-author@pulse.local', 'Lead Original Author');
  const lead = await createLead(actor, {
    companyName: 'Bulk Lead Authorship',
    contactDisplayName: 'Casey Author',
    email: 'casey.author@example.com',
    phone: '555-0107',
    state: 'TX',
    countryCode: 'US',
    routingTeam: 'dealer_sales',
    serviceTechCount: 8,
    notes: 'Original note must keep its author after transfer.',
  });

  const stageEvent = await prisma.leadStageEvent.create({
    data: {
      leadId: lead.id,
      actorUserId: originalAuthor.id,
      toStage: 'DISCOVERY_SCHEDULED',
      note: 'Original author note before territory transfer.',
      metadata: {
        source: 'authorship_regression',
      },
    },
  });

  await bulkReassignLeadTerritories(actor, {
    leadIds: [lead.id],
    territoryId: florida.territory.id,
    assignedTmUserId: florida.manager.id,
    assignedRdUserId: florida.director.id,
    reasonCode: 'bulk_tm_transfer',
    reasonNote: 'Move to Florida TM without rewriting historical activity authorship.',
  });

  const preservedEvent = await prisma.leadStageEvent.findUniqueOrThrow({
    where: { id: stageEvent.id },
  });
  assert.equal(preservedEvent.actorUserId, originalAuthor.id);
  assert.equal(preservedEvent.note, 'Original author note before territory transfer.');

  const history = await listTerritoryAssignmentHistory(actor, 'lead', lead.id);
  assert.equal(history.items[0]?.changedByUserId, actor.userId);
  assert.equal(history.items[0]?.previousTerritoryCode, texas.territory.code);
  assert.equal(history.items[0]?.nextTerritoryCode, florida.territory.code);
  assert.equal(history.items[0]?.metadata?.operation, 'territory.bulk_reassign_leads');
  assert.equal(history.items[0]?.metadata?.bulkOperation, true);
  assert.equal(history.items[0]?.metadata?.entityCount, 1);
});

test('territory account route context can start a checked-in site visit without formal training completion', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await seedTerritoryFixture(actor, {
    suffix: 'field_visit',
    stateCode: 'GA',
  });
  const account = await createAccount(actor, {
    displayName: 'Territory Field Visit Account',
    legalName: 'Territory Field Visit Account LLC',
    accountType: 'Dealer',
  });

  await createAccountLocation(actor, account.id, {
    name: 'Primary',
    city: 'Atlanta',
    state: 'GA',
    countryCode: 'US',
    isPrimary: true,
  });

  const detail = await getAccountDetail(actor, account.id);
  assert.equal(detail?.territoryId, fixture.territory.id);
  assert.equal(detail?.assignedTmUserId, fixture.manager.id);

  const scheduledAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const visit = await createTrainingSession(actor, account.id, {
    trainerUserId: fixture.manager.id,
    activityKind: 'site_visit',
    title: 'Territory route check-in',
    scheduledAt,
    durationMinutes: 45,
    attendeeCount: 0,
    notes: 'Started from territory route context.',
  });

  assert.equal(visit.activityKind, 'site_visit');
  assert.equal(visit.certificationOutcome, 'not_applicable');

  const checkedIn = await checkInTrainingSession(actor, visit.id, {
    checkedInAt: scheduledAt,
    notes: 'Arrived at account from route plan.',
  });

  assert.equal(checkedIn.executionState, 'checked_in');
  assert.equal(checkedIn.activityKind, 'site_visit');
  assert.equal(checkedIn.accountId, account.id);
  assert.equal(checkedIn.trainerUserId, fixture.manager.id);
  assert.equal(checkedIn.notes, 'Arrived at account from route plan.');

  const checkedInWorkspace = await getTerritoryMapWorkspace(actor);
  const checkedInRouteStop = checkedInWorkspace.routePlans
    .flatMap((plan) => plan.stops)
    .find((stop) => stop.recordType === 'account' && stop.recordId === account.id);
  assert.ok(checkedInRouteStop);
  assert.equal(checkedInRouteStop.visitExecutionState, 'checked_in');
  assert.equal(checkedInRouteStop.activeVisitSessionId, visit.id);

  const completed = await completeTrainingSession(actor, visit.id, {
    completedAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    durationMinutes: 45,
    attendeeCount: 0,
    checkoutNotes: 'Completed route visit with required checkout notes.',
    completionSummary: 'Completed from territory route context.',
  });

  assert.equal(completed.executionState, 'completed');
  assert.equal(completed.activityKind, 'site_visit');
  assert.equal(completed.checkoutNotes, 'Completed route visit with required checkout notes.');
  assert.equal(completed.certificationOutcome, 'not_applicable');

  const completedWorkspace = await getTerritoryMapWorkspace(actor);
  const completedRouteStop = completedWorkspace.routePlans
    .flatMap((plan) => plan.stops)
    .find((stop) => stop.recordType === 'account' && stop.recordId === account.id);
  assert.ok(completedRouteStop);
  assert.equal(completedRouteStop.visitExecutionState, 'completed');
  assert.equal(completedRouteStop.lastVisitSessionId, visit.id);
  assert.equal(completedRouteStop.lastVisitTrainerName, fixture.manager.displayName);
  assert.ok(completedRouteStop.lastVisitCompletedAt);
});

test('territory admin updates refresh downstream account ownership and shipping alignment', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await seedTerritoryFixture(actor, {
    suffix: 'account_refresh_admin',
    stateCode: 'NV',
  });
  const nextTm = await createUser('TERRITORY_MANAGER', 'tm-account-refresh@pulse.local', 'Account Refresh TM');
  const nextShippingCenter = await createShippingCenter(actor, {
    code: 'ship_account_refresh_next',
    name: 'Account Refresh Shipping',
    city: 'Reno',
    state: 'NV',
  });

  const account = await createAccount(actor, {
    displayName: 'Account Territory Refresh',
    legalName: 'Account Territory Refresh LLC',
    accountType: 'Dealer',
  });

  await createAccountLocation(actor, account.id, {
    name: 'Primary',
    city: 'Las Vegas',
    state: 'NV',
    countryCode: 'US',
    isPrimary: true,
  });

  let detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  assert.equal(detail.assignedTmUserId, fixture.manager.id);
  assert.equal(detail.shippingCenterId, fixture.shippingCenter.id);

  await updateTerritory(actor, fixture.territory.id, {
    managerUserId: nextTm.id,
    shippingCenterId: nextShippingCenter.id,
  });

  detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  assert.equal(detail.assignedTmUserId, nextTm.id);
  assert.equal(detail.shippingCenterId, nextShippingCenter.id);
  assert.equal(detail.territoryId, fixture.territory.id);

  const history = await listTerritoryAssignmentHistory(actor, 'account', account.id);
  assert.equal(history.items.length, 2);
  assert.equal(history.items[0].reasonCode, 'territory_refresh');
  assert.equal(history.items[0].previousAssignedTmUserId, fixture.manager.id);
  assert.equal(history.items[0].nextAssignedTmUserId, nextTm.id);
  assert.equal(history.items[0].nextShippingCenterId, nextShippingCenter.id);
});

test('territory permissions allow RD admin actions, TM reassign actions, and deny unrelated roles', SERIAL, async () => {
  const { actor: adminActor } = await createAdminSession();
  const fixture = await seedTerritoryFixture(adminActor, {
    suffix: 'permissions',
    stateCode: 'NV',
  });

  const regionalDirectorActor = actorWithRole(adminActor, 'REGIONAL_DIRECTOR');
  const territoryManagerActor = actorForUser(fixture.manager);
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
    serviceTechCount: 8,
    state: 'NV',
  });
  await reassignLeadTerritory(adminActor, lead.id, {
    territoryId: fixture.territory.id,
    reasonCode: 'admin_seed_visible',
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
