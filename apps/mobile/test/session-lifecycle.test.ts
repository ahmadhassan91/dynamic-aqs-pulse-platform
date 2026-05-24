import test from 'node:test';
import assert from 'node:assert/strict';
import type { AuthBundle } from '../src/lib/api.ts';
import { isMobileAuthAllowed, resolveStoredSession } from '../src/lib/session-lifecycle.ts';

const mobileAuth = authBundle({ scopes: ['mobile', 'leads'] });

test('keeps stored session when access token is accepted', async () => {
  let refreshCalled = false;
  const resolution = await resolveStoredSession({ apiBaseUrl: 'https://pulse-crm.theclustox.com', auth: mobileAuth }, {
    fetchCurrentSession: async () => ({
      identity: { ...mobileAuth.identity, displayName: 'Fresh TM' },
      session: { ...mobileAuth.session, sessionId: 'fresh-session' },
    }),
    refreshPulseSession: async () => {
      refreshCalled = true;
      return authBundle();
    },
  });

  assert.equal(refreshCalled, false);
  assert.equal(resolution.auth?.session.sessionId, 'fresh-session');
  assert.equal(resolution.shouldSaveStoredSession, true);
  assert.equal(resolution.shouldClearStoredSession, false);
});

test('refreshes stored session when access token is stale', async () => {
  const refreshed = authBundle({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  const resolution = await resolveStoredSession({ auth: mobileAuth }, {
    fetchCurrentSession: async () => {
      throw Object.assign(new Error('Expired'), { status: 401 });
    },
    refreshPulseSession: async () => refreshed,
  });

  assert.equal(resolution.auth?.tokens.accessToken, 'new-access');
  assert.equal(resolution.shouldSaveStoredSession, true);
  assert.equal(resolution.shouldClearStoredSession, false);
});

test('signs out cleanly when refresh token is rejected', async () => {
  const resolution = await resolveStoredSession({ auth: mobileAuth }, {
    fetchCurrentSession: async () => {
      throw Object.assign(new Error('Expired'), { status: 401 });
    },
    refreshPulseSession: async () => {
      throw Object.assign(new Error('Rejected'), { status: 401 });
    },
  });

  assert.equal(resolution.auth, null);
  assert.equal(resolution.shouldClearStoredSession, true);
});

test('does not clear stored session on transient refresh failure', async () => {
  const resolution = await resolveStoredSession({ auth: mobileAuth }, {
    fetchCurrentSession: async () => {
      throw Object.assign(new Error('Expired'), { status: 401 });
    },
    refreshPulseSession: async () => {
      throw Object.assign(new Error('Unavailable'), { status: 503 });
    },
  });

  assert.equal(resolution.auth?.tokens.accessToken, mobileAuth.tokens.accessToken);
  assert.equal(resolution.shouldClearStoredSession, false);
  assert.match(resolution.errorMessage ?? '', /Could not refresh/);
});

test('rejects non-mobile sessions before entering the field app', async () => {
  const nonMobile = authBundle({ scopes: ['home', 'admin'], role: 'SUPER_ADMIN' });

  assert.equal(isMobileAuthAllowed(nonMobile), false);
  const resolution = await resolveStoredSession({ auth: nonMobile }, {
    fetchCurrentSession: async () => ({
      identity: nonMobile.identity,
      session: nonMobile.session,
    }),
    refreshPulseSession: async () => nonMobile,
  });

  assert.equal(resolution.auth, null);
  assert.equal(resolution.shouldClearStoredSession, true);
});

function authBundle(overrides: { accessToken?: string; refreshToken?: string; role?: AuthBundle['identity']['role']; scopes?: string[] } = {}): AuthBundle {
  return {
    identity: {
      actorType: 'internal',
      displayName: 'Tammy TM',
      email: 'tammy.tm@pulse.local',
      role: overrides.role ?? 'TERRITORY_MANAGER',
      userId: 'user-tm',
    },
    session: {
      issuedAt: '2026-05-24T00:00:00.000Z',
      expiresAt: '2026-05-24T01:00:00.000Z',
      role: overrides.role ?? 'TERRITORY_MANAGER',
      scopes: overrides.scopes as AuthBundle['session']['scopes'] ?? ['mobile'],
      sessionId: 'session-old',
      subjectId: 'user-tm',
      tokenVersion: 1,
    },
    tokens: {
      accessToken: overrides.accessToken ?? 'access-old',
      refreshToken: overrides.refreshToken ?? 'refresh-old',
      accessTokenExpiresAt: '2026-05-24T01:00:00.000Z',
      refreshTokenExpiresAt: '2026-05-25T00:00:00.000Z',
    },
  };
}
