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
let createAccount;
let createAccountLocation;
let updateAccountLocation;
let getAccountDetail;
let createRegion;
let createShippingCenter;
let createTerritory;
let getTerritoryPolicy;
let listRegions;
let listShippingCenters;
let listTerritories;
let listTerritoryAssignmentHistory;
let listTerritoryAssignableUsers;
let reassignAccountTerritory;
let reassignLeadTerritory;
let replaceTerritoryCoverage;
let getTerritoryMapWorkspace;
let updateTerritory;
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
    createAccount,
    createAccountLocation,
    updateAccountLocation,
    getAccountDetail,
  } = await import('../dist/modules/accounts/service.js'));
  ({
    createRegion,
    createShippingCenter,
    createTerritory,
    ensureTerritoryPolicySeeded,
    getTerritoryPolicy,
    listRegions,
    listShippingCenters,
    listTerritories,
    listTerritoryAssignmentHistory,
    listTerritoryAssignableUsers,
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

    const [policyResponse, centersResponse, mapResponse] = await Promise.all([
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
    ]);

    assert.equal(policyResponse.status, 200);
    assert.equal(centersResponse.status, 200);
    assert.equal(mapResponse.status, 200);

    const policy = await policyResponse.json();
    const centers = await centersResponse.json();
    const map = await mapResponse.json();

    assert.equal(policy.preHandoffTmVisibility, false);
    assert.ok(Array.isArray(centers.items));
    assert.ok(centers.items.some((item) => item.code === 'nj_princeton'));
    assert.ok(centers.items.some((item) => item.code === 'fl_southeast'));
    assert.ok(centers.items.some((item) => item.code === 'nv_nevada'));
    assert.ok(Array.isArray(map.shippingCenters));
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
});

test('territory read visibility scopes region, territory, shipping center, and map workspace payloads for a TM', SERIAL, async () => {
  const { actor } = await createAdminSession();
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
});

test('territory assignment history denies out-of-scope entity reads for TMs while keeping visible records accessible', SERIAL, async () => {
  const { actor } = await createAdminSession();
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
