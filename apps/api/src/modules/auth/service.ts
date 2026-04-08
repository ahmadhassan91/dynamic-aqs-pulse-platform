import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { normalizeRole, ROLE_DEFAULT_MODULE_ACCESS } from '@pulse/auth';
import {
  AuditAction,
  IdentityProvider,
  SessionAuthMethod,
  UserKind,
  Prisma,
  prisma,
  type Session,
  type User,
  type UserIdentity,
} from '@pulse/db';
import type { AppConfig } from '../../config.js';
import type {
  AuthIdentity,
  AuthSession,
  LoginRequest,
  RefreshSessionRequest,
  TokenPair,
} from '@pulse/contracts';
import type { AuthRequestContext, AuthResponse } from './types.js';

const SESSION_ENTITY_TYPE = 'SESSION';

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

  const tokenBundle = buildTokenBundle(config);
  const session = await prisma.$transaction(async (tx) => {
    const sessionData: Parameters<typeof tx.session.create>[0]['data'] = {
      userId: identity.userId,
      identityId: identity.id,
      accessTokenHash: hashToken(tokenBundle.accessToken),
      refreshTokenHash: hashToken(tokenBundle.refreshToken),
      authMethod: SessionAuthMethod.PASSWORD,
      expiresAt: tokenBundle.accessTokenExpiresAt,
      refreshExpiresAt: tokenBundle.refreshTokenExpiresAt,
      lastSeenAt: new Date(),
    };

    if (ctx.ipAddress !== undefined) {
      sessionData.ipAddress = ctx.ipAddress;
    }
    if (ctx.userAgent !== undefined) {
      sessionData.userAgent = ctx.userAgent;
    }

    const createdSession = await tx.session.create({
      data: sessionData,
    });

    await Promise.all([
      tx.user.update({
        where: { id: identity.userId },
        data: {
          lastLoginAt: new Date(),
        },
      }),
      tx.userIdentity.update({
        where: { id: identity.id },
        data: {
          lastAuthenticatedAt: new Date(),
        },
      }),
      tx.auditEntry.create({
        data: buildAuditEntryData({
          actorUserId: identity.userId,
          action: AuditAction.LOGIN,
          entityId: createdSession.id,
          requestId: ctx.requestId,
          correlationId: ctx.correlationId,
          metadata: {
            provider: identity.provider,
            authMethod: SessionAuthMethod.PASSWORD,
            userType: identity.user.userType,
          },
        }),
      }),
    ]);

    return createdSession;
  });

  return buildAuthResponse(identity.user, session, tokenBundle);
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

  return buildSessionState(session.user, session);
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

export async function ensureBootstrapAdminSeeded(config: AppConfig) {
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
  const data: Parameters<typeof prisma.auditEntry.create>[0]['data'] = {
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: SESSION_ENTITY_TYPE,
    entityId: input.entityId,
    sourceSystem: 'pulse-api',
  };

  if (input.requestId !== undefined) {
    data.requestId = input.requestId;
  }
  if (input.correlationId !== undefined) {
    data.correlationId = input.correlationId;
  }
  if (input.metadata !== undefined) {
    data.metadata = toJsonValue(input.metadata);
  }

  return data;
}

function toJsonValue(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
