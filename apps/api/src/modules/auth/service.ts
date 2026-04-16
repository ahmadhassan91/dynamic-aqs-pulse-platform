import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { normalizeRole, ROLE_DEFAULT_MODULE_ACCESS } from '@pulse/auth';
import {
  AuditAction,
  IdentityProvider,
  Prisma,
  SessionAuthMethod,
  UserKind,
  prisma,
  type Session,
  type User,
  type UserIdentity,
} from '@pulse/db';
import type { AppConfig } from '../../config.js';
import { buildAuditEntryData as buildDomainAuditEntryData } from '../../utils/audit.js';
import { getResolvedMicrosoftEntraPolicy } from './policy.js';
import type {
  AuthIdentity,
  AuthRole,
  AuthSession,
  CompleteMicrosoftEntraLoginResponse,
  LoginRequest,
  RefreshSessionRequest,
  StartMicrosoftEntraLoginResponse,
  TokenPair,
} from '@pulse/contracts';
import type { AuthRequestContext, AuthResponse, AuthenticatedActor } from './types.js';

const SESSION_ENTITY_TYPE = 'SESSION';
const AUTH_LOGIN_STATE_TTL_MS = 10 * 60 * 1000;
let bootstrapAdminSeedPromise: Promise<void> | null = null;

type RawMicrosoftEntraTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type MicrosoftEntraTokenResponse = {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresIn: number;
  scope?: string | undefined;
  idToken?: string | undefined;
};

type MicrosoftEntraProfileResponse = {
  id?: string;
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
};

type MicrosoftEntraGroupResponse = {
  value?: Array<{
    id?: string | null;
  }>;
  '@odata.nextLink'?: string;
};

type MicrosoftEntraIdTokenClaims = {
  oid?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  groups?: string[];
};

const INTERNAL_ENTRA_ROLE_PRIORITY: Record<AuthRole, number> = {
  SUPER_ADMIN: 100,
  EXECUTIVE: 90,
  SALES_BD_LEADERSHIP: 80,
  FINANCE: 75,
  ADMIN_CSR_OPS: 70,
  REGIONAL_DIRECTOR: 65,
  TERRITORY_MANAGER: 60,
  TRAINING_OPS: 55,
  SALES_BD_REP: 50,
  DEALER_PORTAL_USER: 0,
};

export class MicrosoftEntraAuthUnavailableError extends Error {
  constructor(message = 'Microsoft Entra auth is not configured') {
    super(message);
    this.name = 'MicrosoftEntraAuthUnavailableError';
  }
}

type ConfiguredMicrosoftEntraAuth = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authBaseUrl: string;
  graphBaseUrl: string;
  groupRoleMap: Record<string, string>;
};

export async function loginWithPassword(
  config: AppConfig,
  input: LoginRequest,
  ctx: AuthRequestContext = {},
): Promise<AuthResponse> {
  const email = normalizeEmail(input.email);
  const password = input.password?.trim();

  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  await ensureBootstrapAdminSeeded(config);

  const identity = await prisma.userIdentity.findFirst({
    where: {
      provider: IdentityProvider.LOCAL,
      loginEmail: email,
    },
    include: {
      user: true,
    },
  });

  if (!identity?.passwordHash || !verifySecret(password, identity.passwordHash)) {
    throw new Error('Invalid email or password');
  }

  if (!identity.user.isActive) {
    throw new Error('User is inactive');
  }

  return issueSessionForIdentity(config, identity.user, identity, SessionAuthMethod.PASSWORD, ctx);
}

export async function refreshSession(
  config: AppConfig,
  input: RefreshSessionRequest,
  ctx: AuthRequestContext = {},
): Promise<AuthResponse> {
  const refreshToken = input.refreshToken?.trim();
  if (!refreshToken) {
    throw new Error('refreshToken is required');
  }

  const session = await prisma.session.findUnique({
    where: {
      refreshTokenHash: hashToken(refreshToken),
    },
    include: {
      user: true,
      identity: true,
    },
  });

  const activeSession = validateActiveSession(session, 'refresh');
  const tokenBundle = buildTokenBundle(config);

  const updatedSession = await prisma.$transaction(async (tx) => {
    const nextSession = await tx.session.update({
      where: { id: activeSession.id },
      data: {
        accessTokenHash: hashToken(tokenBundle.accessToken),
        refreshTokenHash: hashToken(tokenBundle.refreshToken),
        expiresAt: tokenBundle.accessTokenExpiresAt,
        refreshExpiresAt: tokenBundle.refreshTokenExpiresAt,
        lastSeenAt: new Date(),
        revokedAt: null,
        revokedReason: null,
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: activeSession.userId,
        action: AuditAction.UPDATE,
        entityId: activeSession.id,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        metadata: {
          operation: 'refresh',
          provider: activeSession.identity.provider,
          authMethod: activeSession.authMethod,
        },
      }),
    });

    return nextSession;
  });

  return buildAuthResponse(activeSession.user, updatedSession, tokenBundle);
}

export async function getCurrentSession(accessToken: string) {
  const session = await resolveSessionByAccessToken(accessToken);
  if (!session) {
    return null;
  }

  return {
    identity: buildAuthIdentity(session.user),
    session: buildSessionState(session.user, session),
  };
}

export async function authenticateAccessToken(accessToken: string): Promise<AuthenticatedActor | null> {
  const session = await resolveSessionByAccessToken(accessToken);
  if (!session) {
    return null;
  }

  return {
    userId: session.user.id,
    sessionId: session.id,
    role: normalizeRole(session.user.roleCode),
    actorType: mapUserKind(session.user.userType),
    email: session.user.email,
    displayName: session.user.displayName,
  };
}

export async function logoutCurrentSession(accessToken: string, ctx: AuthRequestContext = {}) {
  const session = await resolveSessionByAccessToken(accessToken);
  if (!session) {
    return null;
  }

  if (!session.revokedAt) {
    await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          revokedReason: 'logout',
        },
      }),
      prisma.auditEntry.create({
        data: buildAuditEntryData({
          actorUserId: session.userId,
          action: AuditAction.LOGOUT,
          entityId: session.id,
          requestId: ctx.requestId,
          correlationId: ctx.correlationId,
          metadata: {
            provider: session.identity.provider,
            authMethod: session.authMethod,
          },
        }),
      }),
    ]);
  }

  return {
    sessionId: session.id,
    revokedAt: new Date().toISOString(),
  };
}

export async function startMicrosoftEntraLogin(
  config: AppConfig,
  nextPath?: string,
): Promise<StartMicrosoftEntraLoginResponse> {
  const entra = requireConfiguredMicrosoftEntra(config);
  const state = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + AUTH_LOGIN_STATE_TTL_MS);

  await prisma.authLoginState.create({
    data: {
      provider: IdentityProvider.MICROSOFT_ENTRA,
      stateHash: hashState(state),
      nextPath: normalizeNextPath(nextPath) ?? null,
      expiresAt,
    },
  });

  const authorizationUrl = new URL(`${entra.authBaseUrl.replace(/\/$/, '')}/${entra.tenantId}/oauth2/v2.0/authorize`);
  authorizationUrl.searchParams.set('client_id', entra.clientId);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('redirect_uri', entra.redirectUri);
  authorizationUrl.searchParams.set('response_mode', 'query');
  authorizationUrl.searchParams.set('scope', entra.scopes.join(' '));
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('prompt', 'select_account');

  return {
    provider: 'microsoft_entra',
    authorizationUrl: authorizationUrl.toString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function completeMicrosoftEntraLogin(
  config: AppConfig,
  input: {
    code?: string | null;
    state?: string | null;
  },
  ctx: AuthRequestContext = {},
): Promise<CompleteMicrosoftEntraLoginResponse> {
  requireConfiguredMicrosoftEntra(config);
  const code = input.code?.trim();
  const state = input.state?.trim();

  if (!code || !state) {
    throw new Error('Missing Microsoft Entra authorization code or state');
  }

  const authState = await prisma.authLoginState.findUnique({
    where: {
      stateHash: hashState(state),
    },
  });

  if (!authState || authState.provider !== IdentityProvider.MICROSOFT_ENTRA) {
    throw new Error('Microsoft Entra authorization state was not recognized');
  }

  if (authState.usedAt || authState.expiresAt.getTime() < Date.now()) {
    throw new Error('Microsoft Entra authorization state expired');
  }

  const tokenResponse = await exchangeMicrosoftEntraToken(config, {
    grant_type: 'authorization_code',
    code,
  });
  const claims = parseMicrosoftEntraIdToken(tokenResponse.idToken);
  const profile = await fetchMicrosoftEntraProfile(config, tokenResponse.accessToken);

  const providerSubject = claims.oid?.trim() || profile.id?.trim() || '';
  const email = normalizeEmail(
    claims.preferred_username
      ?? claims.email
      ?? profile.mail
      ?? profile.userPrincipalName
      ?? undefined,
  );
  const displayName = claims.name?.trim() || profile.displayName?.trim() || email;

  if (!providerSubject) {
    throw new Error('Microsoft Entra login did not return a stable user identifier');
  }

  if (!email) {
    throw new Error('Microsoft Entra login did not return a usable email address');
  }

  const entraPolicy = await getResolvedMicrosoftEntraPolicy(config);
  const mappedRole = await resolveMicrosoftEntraRole(
    config,
    tokenResponse.accessToken,
    claims.groups,
    entraPolicy.effectiveGroupRoleMappings,
  );
  const isAllowedDomain = isEmailAllowedByMicrosoftEntraPolicy(email, entraPolicy.allowedDomains);
  const outcome = await prisma.$transaction(async (tx) => {
    const existingIdentity = await tx.userIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: IdentityProvider.MICROSOFT_ENTRA,
          providerSubject,
        },
      },
      include: {
        user: true,
      },
    });

    const emailMatchedUser = existingIdentity
      ? null
      : await tx.user.findUnique({
        where: { email },
        include: {
          identities: true,
        },
      });

    const linkedUser = existingIdentity?.user ?? emailMatchedUser ?? null;
    if (linkedUser && linkedUser.userType !== UserKind.INTERNAL) {
      await auditMicrosoftEntraRejectedAttempt(tx, {
        email,
        result: 'rejected_non_internal_user',
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      });
      throw new Error('This Microsoft account is not allowed to access the internal Pulse workspace');
    }

    if (!existingIdentity && !isAllowedDomain) {
      await auditMicrosoftEntraRejectedAttempt(tx, {
        email,
        result: 'rejected_domain_not_allowed',
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        allowedDomains: entraPolicy.allowedDomains,
      });
      throw new Error('This Microsoft account email domain is not approved for internal Pulse access');
    }

    if (!existingIdentity && emailMatchedUser && !entraPolicy.allowEmailLinking && !mappedRole) {
      await auditMicrosoftEntraRejectedAttempt(tx, {
        email,
        result: 'rejected_email_linking_disabled',
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      });
      throw new Error('Email-based Microsoft account linking is disabled. Ask an admin to approve this user or add a group-role mapping.');
    }

    if (!existingIdentity && !linkedUser && !entraPolicy.autoProvisionFromGroups && mappedRole) {
      await auditMicrosoftEntraRejectedAttempt(tx, {
        email,
        result: 'rejected_auto_provision_disabled',
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        mappedRole,
      });
      throw new Error('Automatic Microsoft account provisioning is disabled. Ask an admin to create this Pulse user first.');
    }

    const effectiveRole = mappedRole ?? (linkedUser ? normalizeRole(linkedUser.roleCode) : null);
    if (!effectiveRole || !isInternalRole(effectiveRole)) {
      await auditMicrosoftEntraRejectedAttempt(tx, {
        email,
        result: 'rejected_no_mapped_role',
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      });
      throw new Error('No approved Pulse role was resolved for this Microsoft account');
    }

    const user = linkedUser
      ? await tx.user.update({
          where: { id: linkedUser.id },
          data: {
            email,
            displayName: displayName || linkedUser.displayName,
            roleCode: mappedRole ? effectiveRole : linkedUser.roleCode,
            userType: UserKind.INTERNAL,
            isActive: linkedUser.isActive,
          },
        })
      : await tx.user.create({
          data: {
            email,
            displayName: displayName || email,
            roleCode: effectiveRole,
            userType: UserKind.INTERNAL,
            isActive: true,
          },
        });

    if (!user.isActive) {
      throw new Error('User is inactive');
    }

    const linkedUserIdentities = linkedUser
      ? await tx.userIdentity.findMany({
          where: { userId: linkedUser.id },
        })
      : [];
    const existingLocalPrimary = linkedUserIdentities.some((identity) => identity.isPrimary);
    const identity = await tx.userIdentity.upsert({
      where: {
        provider_providerSubject: {
          provider: IdentityProvider.MICROSOFT_ENTRA,
          providerSubject,
        },
      },
      update: {
        userId: user.id,
        loginEmail: email,
        isPrimary: existingIdentity?.isPrimary ?? !existingLocalPrimary,
      },
      create: {
        userId: user.id,
        provider: IdentityProvider.MICROSOFT_ENTRA,
        providerSubject,
        loginEmail: email,
        isPrimary: !existingLocalPrimary,
      },
    });

    if (!existingIdentity && !linkedUser) {
      await tx.auditEntry.create({
        data: buildDomainAuditEntryData({
          actorUserId: user.id,
          action: AuditAction.CREATE,
          entityType: 'USER',
          entityId: user.id,
          requestId: ctx.requestId,
          correlationId: ctx.correlationId,
          sourceSystem: 'microsoft_entra',
          metadata: {
            provider: 'microsoft_entra',
            result: 'auto_provisioned',
            mappedRole: effectiveRole,
          },
        }),
      });
    }

    await tx.authLoginState.update({
      where: { id: authState.id },
      data: { usedAt: new Date() },
    });

    const authResponse = await issueSessionForIdentity(
      config,
      user,
      identity,
      SessionAuthMethod.OIDC,
      ctx,
      tx,
    );

    return {
      authResponse,
      nextPath: authState.nextPath ?? undefined,
    };
  });

  return {
    ...outcome.authResponse,
    ...(outcome.nextPath ? { nextPath: outcome.nextPath } : {}),
  };
}

export async function ensureBootstrapAdminSeeded(config: AppConfig) {
  if (bootstrapAdminSeedPromise) {
    return bootstrapAdminSeedPromise;
  }

  bootstrapAdminSeedPromise = ensureBootstrapAdminSeededInternal(config).finally(() => {
    bootstrapAdminSeedPromise = null;
  });

  return bootstrapAdminSeedPromise;
}

async function ensureBootstrapAdminSeededInternal(config: AppConfig) {
  const bootstrap = config.auth.bootstrapAdmin;
  const email = normalizeEmail(bootstrap.email);
  const password = bootstrap.password?.trim();

  if (!email || !password) {
    return;
  }

  const roleCode = normalizeRole(bootstrap.role);
  const passwordHash = hashSecret(password);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email },
      update: {
        displayName: bootstrap.displayName,
        roleCode,
        userType: UserKind.INTERNAL,
        isActive: true,
      },
      create: {
        email,
        displayName: bootstrap.displayName,
        roleCode,
        userType: UserKind.INTERNAL,
        isActive: true,
      },
    });

    await tx.userIdentity.upsert({
      where: {
        provider_providerSubject: {
          provider: IdentityProvider.LOCAL,
          providerSubject: email,
        },
      },
      update: {
        userId: user.id,
        loginEmail: email,
        passwordHash,
        isPrimary: true,
      },
      create: {
        userId: user.id,
        provider: IdentityProvider.LOCAL,
        providerSubject: email,
        loginEmail: email,
        passwordHash,
        isPrimary: true,
      },
    });
  });
}

export function readBearerToken(authorizationHeader: string | undefined) {
  const trimmed = authorizationHeader?.trim();
  if (!trimmed) {
    return null;
  }

  const [scheme, token] = trimmed.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

async function issueSessionForIdentity(
  config: AppConfig,
  user: User,
  identity: UserIdentity,
  authMethod: SessionAuthMethod,
  ctx: AuthRequestContext = {},
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<AuthResponse> {
  const tokenBundle = buildTokenBundle(config);
  const authenticatedAt = new Date();
  const session = await db.session.create({
    data: {
      userId: user.id,
      identityId: identity.id,
      accessTokenHash: hashToken(tokenBundle.accessToken),
      refreshTokenHash: hashToken(tokenBundle.refreshToken),
      authMethod,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
      expiresAt: tokenBundle.accessTokenExpiresAt,
      refreshExpiresAt: tokenBundle.refreshTokenExpiresAt,
      lastSeenAt: authenticatedAt,
    },
  });

  const nextUser = await db.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: authenticatedAt,
    },
  });

  await db.userIdentity.update({
    where: { id: identity.id },
    data: {
      loginEmail: user.email || identity.loginEmail || null,
      lastAuthenticatedAt: authenticatedAt,
    },
  });

  await db.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: nextUser.id,
      action: AuditAction.LOGIN,
      entityId: session.id,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      metadata: {
        provider: identity.provider,
        authMethod,
      },
    }),
  });

  return buildAuthResponse(nextUser, session, tokenBundle);
}

function requireConfiguredMicrosoftEntra(config: AppConfig): ConfiguredMicrosoftEntraAuth {
  const entra = config.auth.entra;
  if (
    !entra.enabled
    || !entra.tenantId
    || !entra.clientId
    || !entra.clientSecret
    || !entra.redirectUri
  ) {
    throw new MicrosoftEntraAuthUnavailableError();
  }

  return {
    tenantId: entra.tenantId,
    clientId: entra.clientId,
    clientSecret: entra.clientSecret,
    redirectUri: entra.redirectUri,
    scopes: entra.scopes,
    authBaseUrl: entra.authBaseUrl,
    graphBaseUrl: entra.graphBaseUrl,
    groupRoleMap: entra.groupRoleMap,
  };
}

async function exchangeMicrosoftEntraToken(
  config: AppConfig,
  input: {
    grant_type: 'authorization_code' | 'refresh_token';
    code?: string | undefined;
    refreshToken?: string | undefined;
  },
): Promise<MicrosoftEntraTokenResponse> {
  const entra = requireConfiguredMicrosoftEntra(config);
  const endpoint = `${entra.authBaseUrl.replace(/\/$/, '')}/${entra.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: entra.clientId,
    client_secret: entra.clientSecret,
    redirect_uri: entra.redirectUri,
    scope: entra.scopes.join(' '),
    grant_type: input.grant_type,
  });

  if (input.grant_type === 'authorization_code') {
    if (!input.code?.trim()) {
      throw new Error('Microsoft Entra authorization code is required');
    }
    body.set('code', input.code.trim());
  } else {
    if (!input.refreshToken?.trim()) {
      throw new Error('Microsoft Entra refresh token is required');
    }
    body.set('refresh_token', input.refreshToken.trim());
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const payload = (await response.json().catch(() => ({}))) as RawMicrosoftEntraTokenResponse;

  if (!response.ok || payload.error || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Microsoft Entra token exchange failed');
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in ?? 3600,
    scope: payload.scope,
    idToken: payload.id_token,
  };
}

async function fetchMicrosoftEntraProfile(
  config: AppConfig,
  accessToken: string,
): Promise<MicrosoftEntraProfileResponse> {
  const entra = requireConfiguredMicrosoftEntra(config);
  const response = await fetch(
    `${entra.graphBaseUrl.replace(/\/$/, '')}/me?$select=id,displayName,mail,userPrincipalName`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error('Microsoft Entra profile lookup failed');
  }

  return (await response.json()) as MicrosoftEntraProfileResponse;
}

async function fetchMicrosoftEntraGroupIds(
  config: AppConfig,
  accessToken: string,
): Promise<string[]> {
  const entra = requireConfiguredMicrosoftEntra(config);
  const groupIds = new Set<string>();
  let nextUrl: string | null = `${entra.graphBaseUrl.replace(/\/$/, '')}/me/transitiveMemberOf/microsoft.graph.group?$select=id`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Microsoft Entra group lookup failed');
    }

    const payload = (await response.json()) as MicrosoftEntraGroupResponse;
    for (const entry of payload.value ?? []) {
      const id = entry.id?.trim();
      if (id) {
        groupIds.add(id.toLowerCase());
      }
    }
    nextUrl = payload['@odata.nextLink'] ?? null;
  }

  return [...groupIds];
}

async function resolveMicrosoftEntraRole(
  config: AppConfig,
  accessToken: string,
  tokenGroupIds?: string[] | undefined,
  configuredEntriesInput?: Array<{ groupId: string; role: AuthRole }>,
): Promise<AuthRole | null> {
  const configuredMappings = configuredEntriesInput ?? [];
  const configuredEntries = configuredMappings.length > 0
    ? configuredMappings.map((entry) => [entry.groupId, entry.role] as const)
    : Object.entries(config.auth.entra.groupRoleMap);
  if (configuredEntries.length === 0) {
    return null;
  }

  const availableGroupIds = new Set(
    (tokenGroupIds ?? [])
      .map((groupId) => groupId?.trim().toLowerCase())
      .filter(Boolean) as string[],
  );

  if (availableGroupIds.size === 0) {
    for (const groupId of await fetchMicrosoftEntraGroupIds(config, accessToken)) {
      availableGroupIds.add(groupId);
    }
  }

  let resolvedRole: AuthRole | null = null;
  let highestPriority = -1;
  for (const [groupId, mappedRole] of configuredEntries) {
    if (!availableGroupIds.has(groupId.trim().toLowerCase())) {
      continue;
    }

    try {
      const normalizedRole = normalizeRole(mappedRole);
      if (!isInternalRole(normalizedRole)) {
        continue;
      }

      const priority = INTERNAL_ENTRA_ROLE_PRIORITY[normalizedRole] ?? 0;
      if (priority > highestPriority) {
        highestPriority = priority;
        resolvedRole = normalizedRole;
      }
    } catch {
      continue;
    }
  }

  return resolvedRole;
}

function isEmailAllowedByMicrosoftEntraPolicy(email: string, allowedDomains: string[]) {
  if (allowedDomains.length === 0) {
    return true;
  }

  const [, domain = ''] = email.toLowerCase().split('@');
  return Boolean(domain) && allowedDomains.includes(domain);
}

async function auditMicrosoftEntraRejectedAttempt(
  tx: Prisma.TransactionClient,
  input: {
    email: string;
    result: string;
    requestId?: string | undefined;
    correlationId?: string | undefined;
    mappedRole?: AuthRole | null | undefined;
    allowedDomains?: string[] | undefined;
  },
) {
  await tx.auditEntry.create({
    data: buildDomainAuditEntryData({
      action: AuditAction.LOGIN,
      entityType: 'auth_attempt',
      requestId: input.requestId,
      correlationId: input.correlationId,
      sourceSystem: 'microsoft_entra',
      metadata: {
        provider: 'microsoft_entra',
        email: input.email,
        result: input.result,
        ...(input.mappedRole ? { mappedRole: input.mappedRole } : {}),
        ...(input.allowedDomains ? { allowedDomains: input.allowedDomains } : {}),
      },
    }),
  });
}

function parseMicrosoftEntraIdToken(idToken?: string | undefined): MicrosoftEntraIdTokenClaims {
  if (!idToken?.trim()) {
    return {};
  }

  const parts = idToken.split('.');
  if (parts.length < 2 || !parts[1]) {
    throw new Error('Microsoft Entra id_token could not be parsed');
  }

  try {
    return JSON.parse(decodeBase64Url(parts[1])) as MicrosoftEntraIdTokenClaims;
  } catch {
    throw new Error('Microsoft Entra id_token could not be parsed');
  }
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function normalizeNextPath(nextPath?: string | null) {
  const trimmed = nextPath?.trim();
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return undefined;
  }

  if (trimmed.startsWith('/auth/')) {
    return '/leads';
  }

  return trimmed;
}

function hashState(state: string) {
  return createHash('sha256').update(state).digest('hex');
}

function isInternalRole(role: AuthRole) {
  return role !== 'DEALER_PORTAL_USER';
}

async function resolveSessionByAccessToken(accessToken: string) {
  if (!accessToken.trim()) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      accessTokenHash: hashToken(accessToken),
    },
    include: {
      user: true,
      identity: true,
    },
  });

  if (!session) {
    return null;
  }

  return validateActiveSession(session, 'access');
}

function validateActiveSession(
  session: (Session & { user: User; identity: UserIdentity }) | null,
  tokenType: 'access' | 'refresh',
) {
  if (!session) {
    throw new Error('Invalid session');
  }

  if (session.revokedAt) {
    throw new Error('Session has been revoked');
  }

  if (!session.user.isActive) {
    throw new Error('User is inactive');
  }

  const now = Date.now();
  const expiry = tokenType === 'access'
    ? session.expiresAt.getTime()
    : session.refreshExpiresAt.getTime();

  if (expiry <= now) {
    throw new Error(`Session ${tokenType} token has expired`);
  }

  return session;
}

function buildAuthResponse(user: User, session: Session, tokenBundle: BuiltTokenBundle): AuthResponse {
  return {
    identity: buildAuthIdentity(user),
    session: buildSessionState(user, session),
    tokens: {
      accessToken: tokenBundle.accessToken,
      refreshToken: tokenBundle.refreshToken,
      accessTokenExpiresAt: tokenBundle.accessTokenExpiresAt.toISOString(),
      refreshTokenExpiresAt: tokenBundle.refreshTokenExpiresAt.toISOString(),
    },
  };
}

function buildAuthIdentity(user: User): AuthIdentity {
  return {
    userId: user.id,
    role: normalizeRole(user.roleCode),
    displayName: user.displayName,
    email: user.email,
    actorType: mapUserKind(user.userType),
  };
}

function buildSessionState(user: User, session: Session): AuthSession {
  const role = normalizeRole(user.roleCode);

  return {
    sessionId: session.id,
    subjectId: user.id,
    role,
    issuedAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    refreshExpiresAt: session.refreshExpiresAt.toISOString(),
    tokenVersion: 1,
    scopes: [...ROLE_DEFAULT_MODULE_ACCESS[role]],
  };
}

type BuiltTokenBundle = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
};

function buildTokenBundle(config: AppConfig): BuiltTokenBundle {
  const now = Date.now();
  const accessTokenExpiresAt = new Date(now + (config.auth.accessTokenTtlMinutes * 60_000));
  const refreshTokenExpiresAt = new Date(now + (config.auth.refreshTokenTtlDays * 86_400_000));

  return {
    accessToken: randomToken(),
    refreshToken: randomToken(),
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  };
}

function normalizeEmail(email: string | undefined) {
  const normalized = email?.trim().toLowerCase();
  return normalized || '';
}

function mapUserKind(userKind: UserKind): AuthIdentity['actorType'] {
  switch (userKind) {
    case UserKind.DEALER:
      return 'dealer';
    case UserKind.SERVICE:
      return 'service';
    default:
      return 'internal';
  }
}

function hashSecret(secret: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(secret, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifySecret(secret: string, storedHash: string) {
  const [algorithm, salt, expected] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) {
    return false;
  }

  const actual = scryptSync(secret, salt, 64).toString('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(actual, 'hex');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function randomToken() {
  return randomBytes(48).toString('base64url');
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function buildAuditEntryData(input: {
  actorUserId: string;
  action: AuditAction;
  entityId: string;
  requestId?: string | undefined;
  correlationId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}) {
  return buildDomainAuditEntryData({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: SESSION_ENTITY_TYPE,
    entityId: input.entityId,
    requestId: input.requestId,
    correlationId: input.correlationId,
    metadata: input.metadata,
  });
}
