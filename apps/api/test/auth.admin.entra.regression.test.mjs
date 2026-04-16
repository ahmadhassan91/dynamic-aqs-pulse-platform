import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let loadAppConfig;
let createPulseServer;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let authenticateAccessToken;
let updateMicrosoftEntraAdminSettings;
let mockEntra;
let config;
const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ createPulseServer } = await import('../dist/server.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword, authenticateAccessToken } = await import('../dist/modules/auth/service.js'));
  ({ updateMicrosoftEntraAdminSettings } = await import('../dist/modules/auth/policy.js'));
  await prisma.$connect();
});

test.after(async () => {
  if (mockEntra) {
    await mockEntra.close();
  }

  if (prisma) {
    await prisma.$disconnect();
  }
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
  mockEntra = await createMockMicrosoftEntraServer();
  applyMicrosoftEntraTestEnvironment(mockEntra.baseUrl);
  config = loadAppConfig(process.env);
  await ensureBootstrapAdminSeeded(config);
});

test.afterEach(async () => {
  if (mockEntra) {
    await mockEntra.close();
    mockEntra = null;
  }
});

async function createBootstrapActor() {
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
  return actor;
}

test('entra start + complete links an existing internal Pulse user by email', SERIAL, async () => {
  const linkedEmail = 'entra.linked.admin@pulse.local';
  await prisma.user.create({
    data: {
      email: linkedEmail,
      displayName: 'Existing Internal Admin',
      roleCode: 'SUPER_ADMIN',
      userType: 'INTERNAL',
      isActive: true,
    },
  });

  mockEntra.setScenario({
    claims: {
      oid: 'entra-bootstrap-admin',
      name: 'Pulse Bootstrap Admin',
      preferred_username: linkedEmail,
    },
    profile: {
      id: 'entra-bootstrap-admin',
      displayName: 'Pulse Bootstrap Admin',
      mail: linkedEmail,
      userPrincipalName: linkedEmail,
    },
    groups: [],
  });

  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const { port, payload: startPayload, state } = await startEntraFlow(runtime, '/leads/forms');
    assert.equal(startPayload.provider, 'microsoft_entra');

    const { response, payload } = await completeEntraFlow(port, state, 'bootstrap-code');
    assert.equal(response.status, 200);
    assert.equal(payload.identity.email, linkedEmail);
    assert.equal(payload.identity.role, 'SUPER_ADMIN');
    assert.equal(payload.nextPath, '/leads/forms');

    const identity = await prisma.userIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: 'MICROSOFT_ENTRA',
          providerSubject: 'entra-bootstrap-admin',
        },
      },
    });

    assert.ok(identity, 'expected a linked Microsoft Entra identity');

    const session = await prisma.session.findUnique({
      where: {
        accessTokenHash: sha256(payload.tokens.accessToken),
      },
    });
    assert.ok(session, 'expected an issued OIDC session');
    assert.equal(session.authMethod, 'OIDC');
  } finally {
    await runtime.close();
  }
});

test('entra complete auto-provisions an internal user when mapped group membership is present', SERIAL, async () => {
  process.env.MICROSOFT_ENTRA_GROUP_ROLE_MAP = 'group-training=TRAINING_OPS';
  config = loadAppConfig(process.env);
  await ensureBootstrapAdminSeeded(config);

  mockEntra.setScenario({
    claims: {
      oid: 'entra-training-user',
      name: 'Tina Training',
      preferred_username: 'training.ops@dynamicaqs.com',
    },
    profile: {
      id: 'entra-training-user',
      displayName: 'Tina Training',
      mail: 'training.ops@dynamicaqs.com',
      userPrincipalName: 'training.ops@dynamicaqs.com',
    },
    groups: ['group-training'],
  });

  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const { port, state } = await startEntraFlow(runtime);
    const { response, payload } = await completeEntraFlow(port, state, 'training-code');

    assert.equal(response.status, 200);
    assert.equal(payload.identity.role, 'TRAINING_OPS');
    assert.equal(payload.identity.actorType, 'internal');
    assert.equal(payload.identity.email, 'training.ops@dynamicaqs.com');

    const user = await prisma.user.findUnique({
      where: { email: 'training.ops@dynamicaqs.com' },
    });
    assert.ok(user, 'expected auto-provisioned internal user');
    assert.equal(user.roleCode, 'TRAINING_OPS');
    assert.equal(user.userType, 'INTERNAL');
  } finally {
    await runtime.close();
  }
});

test('entra complete respects admin policy when email linking is disabled', SERIAL, async () => {
  const linkedEmail = 'entra.linking.disabled@pulse.local';
  await prisma.user.create({
    data: {
      email: linkedEmail,
      displayName: 'Link Disabled User',
      roleCode: 'ADMIN_CSR_OPS',
      userType: 'INTERNAL',
      isActive: true,
    },
  });

  const actor = await createBootstrapActor();
  await updateMicrosoftEntraAdminSettings(actor, config, {
    allowEmailLinking: false,
    autoProvisionFromGroups: false,
  });

  mockEntra.setScenario({
    claims: {
      oid: 'entra-link-disabled-user',
      name: 'Link Disabled User',
      preferred_username: linkedEmail,
    },
    profile: {
      id: 'entra-link-disabled-user',
      displayName: 'Link Disabled User',
      mail: linkedEmail,
      userPrincipalName: linkedEmail,
    },
    groups: [],
  });

  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const { port, state } = await startEntraFlow(runtime);
    const { response, payload } = await completeEntraFlow(port, state, 'link-disabled-code');

    assert.equal(response.status, 403);
    assert.match(String(payload.detail), /email-based microsoft account linking is disabled/i);
  } finally {
    await runtime.close();
  }
});

test('entra complete auto-provisions from admin-managed group mapping when the domain is approved', SERIAL, async () => {
  process.env.MICROSOFT_ENTRA_GROUP_ROLE_MAP = '';
  config = loadAppConfig(process.env);
  await ensureBootstrapAdminSeeded(config);

  const actor = await createBootstrapActor();
  await updateMicrosoftEntraAdminSettings(actor, config, {
    allowEmailLinking: false,
    autoProvisionFromGroups: true,
    allowedDomains: ['dynamicaqs.com'],
    groupRoleMappings: [
      { groupId: 'group-training', role: 'TRAINING_OPS' },
    ],
  });

  mockEntra.setScenario({
    claims: {
      oid: 'entra-stored-policy-user',
      name: 'Tina Stored Mapping',
      preferred_username: 'tina.training@dynamicaqs.com',
    },
    profile: {
      id: 'entra-stored-policy-user',
      displayName: 'Tina Stored Mapping',
      mail: 'tina.training@dynamicaqs.com',
      userPrincipalName: 'tina.training@dynamicaqs.com',
    },
    groups: ['group-training'],
  });

  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const { port, state } = await startEntraFlow(runtime);
    const { response, payload } = await completeEntraFlow(port, state, 'stored-mapping-code');

    assert.equal(response.status, 200);
    assert.equal(payload.identity.role, 'TRAINING_OPS');

    const user = await prisma.user.findUnique({
      where: { email: 'tina.training@dynamicaqs.com' },
    });
    assert.ok(user, 'expected auto-provisioned user from stored mapping');
    assert.equal(user.roleCode, 'TRAINING_OPS');
  } finally {
    await runtime.close();
  }
});

test('entra complete rejects approved groups when the email domain is not allowed', SERIAL, async () => {
  process.env.MICROSOFT_ENTRA_GROUP_ROLE_MAP = '';
  config = loadAppConfig(process.env);
  await ensureBootstrapAdminSeeded(config);

  const actor = await createBootstrapActor();
  await updateMicrosoftEntraAdminSettings(actor, config, {
    allowEmailLinking: false,
    autoProvisionFromGroups: true,
    allowedDomains: ['dynamicaqs.com'],
    groupRoleMappings: [
      { groupId: 'group-finance', role: 'FINANCE' },
    ],
  });

  mockEntra.setScenario({
    claims: {
      oid: 'entra-domain-mismatch-user',
      name: 'Domain Mismatch User',
      preferred_username: 'outside.user@gmail.com',
    },
    profile: {
      id: 'entra-domain-mismatch-user',
      displayName: 'Domain Mismatch User',
      mail: 'outside.user@gmail.com',
      userPrincipalName: 'outside.user@gmail.com',
    },
    groups: ['group-finance'],
  });

  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const { port, state } = await startEntraFlow(runtime);
    const { response, payload } = await completeEntraFlow(port, state, 'domain-mismatch-code');

    assert.equal(response.status, 403);
    assert.match(String(payload.detail), /email domain is not approved/i);
  } finally {
    await runtime.close();
  }
});

test('entra complete rejects sign-in when no approved Pulse role is resolved', SERIAL, async () => {
  process.env.MICROSOFT_ENTRA_GROUP_ROLE_MAP = 'group-finance=FINANCE';
  config = loadAppConfig(process.env);
  await ensureBootstrapAdminSeeded(config);

  mockEntra.setScenario({
    claims: {
      oid: 'entra-unmapped-user',
      name: 'Unaffiliated User',
      preferred_username: 'external.user@dynamicaqs.com',
    },
    profile: {
      id: 'entra-unmapped-user',
      displayName: 'Unaffiliated User',
      mail: 'external.user@dynamicaqs.com',
      userPrincipalName: 'external.user@dynamicaqs.com',
    },
    groups: ['group-unknown'],
  });

  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const { port, state } = await startEntraFlow(runtime);
    const { response, payload } = await completeEntraFlow(port, state, 'reject-code');

    assert.equal(response.status, 403);
    assert.match(String(payload.detail), /no approved pulse role/i);
  } finally {
    await runtime.close();
  }
});

test('entra authorization state cannot be reused after a successful login', SERIAL, async () => {
  mockEntra.setScenario({
    claims: {
      oid: 'entra-bootstrap-reuse',
      name: 'Pulse Bootstrap Admin',
      preferred_username: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL,
    },
    profile: {
      id: 'entra-bootstrap-reuse',
      displayName: 'Pulse Bootstrap Admin',
      mail: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL,
      userPrincipalName: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL,
    },
    groups: [],
  });

  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const { port, state } = await startEntraFlow(runtime);
    const first = await completeEntraFlow(port, state, 'first-code');
    assert.equal(first.response.status, 200);

    const second = await completeEntraFlow(port, state, 'first-code');
    assert.equal(second.response.status, 401);
    assert.match(String(second.payload.detail), /authorization state expired/i);
  } finally {
    await runtime.close();
  }
});

async function startEntraFlow(runtime, nextPath) {
  const port = runtime.server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth/entra/start`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(nextPath ? { nextPath } : {}),
  });

  const payload = await response.json();
  assert.equal(response.status, 200);
  const state = new URL(payload.authorizationUrl).searchParams.get('state');
  assert.ok(state, 'expected an authorization state');

  return {
    port,
    payload,
    state,
  };
}

async function completeEntraFlow(port, state, code) {
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth/entra/complete`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      code,
      state,
    }),
  });

  return {
    response,
    payload: await response.json(),
  };
}

function applyMicrosoftEntraTestEnvironment(baseUrl) {
  process.env.MICROSOFT_ENTRA_TENANT_ID = 'test-tenant-id';
  process.env.MICROSOFT_ENTRA_CLIENT_ID = 'test-client-id';
  process.env.MICROSOFT_ENTRA_CLIENT_SECRET = 'test-client-secret';
  process.env.MICROSOFT_ENTRA_LOGIN_REDIRECT_URI = 'http://localhost:3000/auth/entra/callback';
  process.env.MICROSOFT_ENTRA_LOGIN_SCOPES = 'openid profile email offline_access User.Read';
  process.env.MICROSOFT_ENTRA_GROUP_ROLE_MAP = '';
  process.env.MICROSOFT_ENTRA_AUTH_BASE_URL = baseUrl;
  process.env.MICROSOFT_GRAPH_API_BASE_URL = baseUrl;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function createFakeIdToken(claims) {
  const encode = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payloadWithDefaults(claims))}.signature`;
}

function payloadWithDefaults(claims) {
  return {
    aud: 'test-client-id',
    iss: 'https://login.microsoftonline.com/test-tenant-id/v2.0',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  };
}

async function createMockMicrosoftEntraServer() {
  const scenario = {
    claims: {
      oid: 'entra-default-user',
      name: 'Default Entra User',
      preferred_username: 'default@pulse.local',
    },
    profile: {
      id: 'entra-default-user',
      displayName: 'Default Entra User',
      mail: 'default@pulse.local',
      userPrincipalName: 'default@pulse.local',
    },
    groups: [],
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const sendJson = (statusCode, body) => {
      const payload = JSON.stringify(body);
      res.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(payload),
      });
      res.end(payload);
    };

    if (req.method === 'POST' && url.pathname === '/test-tenant-id/oauth2/v2.0/token') {
      return sendJson(200, {
        access_token: 'entra-access-token',
        refresh_token: 'entra-refresh-token',
        expires_in: 3600,
        scope: 'openid profile email offline_access User.Read',
        id_token: createFakeIdToken(scenario.claims),
      });
    }

    if (req.method === 'GET' && url.pathname === '/me') {
      return sendJson(200, scenario.profile);
    }

    if (req.method === 'GET' && url.pathname === '/me/transitiveMemberOf/microsoft.graph.group') {
      return sendJson(200, {
        value: scenario.groups.map((groupId) => ({ id: groupId })),
      });
    }

    return sendJson(404, {
      error: 'not_found',
      path: url.pathname,
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    setScenario(nextScenario) {
      scenario.claims = nextScenario.claims;
      scenario.profile = nextScenario.profile;
      scenario.groups = nextScenario.groups ?? [];
    },
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}
