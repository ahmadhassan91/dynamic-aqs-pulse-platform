import { randomBytes, scryptSync } from 'node:crypto';
import {
  AUTH_ROLES,
  ROLE_PROFILE_CATALOG,
  ROLE_DEFAULT_ACTION_ACCESS,
  ROLE_DEFAULT_MODULE_ACCESS,
  type AdminIntegrationStatusResponse,
  type AdminOverviewResponse,
  type AdminRoleAccessCatalogResponse,
  type AdminSystemHealthResponse,
  type AdminUserStatus,
  type AdminUserSummary,
  type CreateAdminUserRequest,
  type CreateAdminUserResponse,
  type ImportAdminUsersRequest,
  type ImportAdminUsersResponse,
  type ListAdminActivityRequest,
  type ListAdminActivityResponse,
  type ListAdminUsersRequest,
  type ListAdminUsersResponse,
  type ResetAdminUserPasswordRequest,
  type ResetAdminUserPasswordResponse,
  type UpdateAdminUserRequest,
  type UpdateAdminUserResponse,
} from '@pulse/contracts';
import { normalizeRole } from '@pulse/auth';
import {
  AuditAction,
  IdentityProvider,
  Prisma,
  UserKind,
  prisma,
} from '@pulse/db';
import type { AppConfig } from '../../config.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import { listMicrosoftEntraIntegrationStatuses } from '../auth/policy.js';
import type { AuthenticatedActor } from '../auth/types.js';
import { listOutlookIntegrationStatuses } from '../calendar/policy.js';
import { listPaymentIntegrationStatusesForConfig } from '../cis/policy.js';
import { listLeadOperationalAlertIntegrationStatuses } from '../leads/service.js';

const USER_ENTITY_TYPE = 'USER';

type AdminSystemHealthSnapshot = {
  config: AppConfig;
  database: {
    ok: boolean;
    checkedAt: string;
    error?: string | undefined;
  };
  queue: {
    ok: boolean;
    checkedAt?: string | undefined;
    error?: string | undefined;
  };
  workers: {
    running?: boolean;
    registeredWorkers?: number;
    queue?: {
      registeredWorkers?: number;
    };
  };
  acumatica: {
    ok: boolean;
    checkedAt?: string | undefined;
    status?: string | undefined;
    error?: string | undefined;
  };
};

const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  roleCode: true,
  userType: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  identities: {
    select: {
      id: true,
      provider: true,
      isPrimary: true,
      lastAuthenticatedAt: true,
      loginEmail: true,
    },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  },
  sessions: {
    where: {
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
    },
  },
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{
  select: typeof USER_SELECT;
}>;

export async function listAdminUsers(input: ListAdminUsersRequest = {}): Promise<ListAdminUsersResponse> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const where = buildUserWhere(input);

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: USER_SELECT,
    }),
  ]);

  return {
    users: users.map(toAdminUserSummary),
    total,
    page,
    limit,
  };
}

// Privileged roles can read/manage everything; granting them is reserved for SUPER_ADMIN so an
// admin.user_manage holder (e.g. ADMIN_CSR_OPS) cannot mint or self-escalate into them.
const PRIVILEGED_ROLES: ReadonlySet<string> = new Set(['SUPER_ADMIN', 'EXECUTIVE']);

function assertCanAssignRole(actor: AuthenticatedActor, targetRole: string): void {
  if (PRIVILEGED_ROLES.has(targetRole) && actor.role !== 'SUPER_ADMIN') {
    throw new Error('Only a super admin can assign the SUPER_ADMIN or EXECUTIVE role.');
  }
}

export async function createAdminUser(
  actor: AuthenticatedActor,
  input: CreateAdminUserRequest,
): Promise<CreateAdminUserResponse> {
  const email = normalizeEmail(input.email);
  const role = normalizeRole(input.role);
  assertCanAssignRole(actor, role);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  if (!email || !firstName || !lastName) {
    throw new Error('Email, first name, and last name are required');
  }

  const temporaryPassword = input.password?.trim() || createTemporaryPassword();
  const passwordHash = hashSecret(temporaryPassword);

  // UX-AD-011: support explicit actorType so dealer-portal users can be created from admin.
  const resolvedUserKind = input.actorType === 'dealer' ? UserKind.DEALER : UserKind.INTERNAL;

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        displayName: `${firstName} ${lastName}`.trim(),
        roleCode: role,
        userType: resolvedUserKind,
        isActive: input.isActive ?? true,
        identities: {
          create: {
            provider: IdentityProvider.LOCAL,
            providerSubject: email,
            loginEmail: email,
            passwordHash,
            isPrimary: true,
          },
        },
      },
      select: USER_SELECT,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: USER_ENTITY_TYPE,
        entityId: user.id,
        afterData: {
          email: user.email,
          displayName: user.displayName,
          role: role,
          isActive: user.isActive,
        },
        metadata: {
          operation: 'admin.create_user',
          provider: 'LOCAL',
        },
      }),
    });

    return user;
  });

  return {
    user: toAdminUserSummary(created),
    temporaryPassword,
  };
}

export async function updateAdminUser(
  actor: AuthenticatedActor,
  userId: string,
  input: UpdateAdminUserRequest,
): Promise<UpdateAdminUserResponse> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_SELECT,
  });

  if (!existing) {
    throw new Error('User not found');
  }

  const nextEmail = input.email ? normalizeEmail(input.email) : existing.email;
  const nextFirstName = input.firstName?.trim() || splitDisplayName(existing.displayName).firstName;
  const nextLastName = input.lastName?.trim() || splitDisplayName(existing.displayName).lastName;
  const nextDisplayName = `${nextFirstName} ${nextLastName}`.trim();
  const nextRole = input.role ? normalizeRole(input.role) : normalizeRole(existing.roleCode);
  // Block escalation: changing a user INTO a privileged role (or editing an existing privileged
  // user) requires SUPER_ADMIN. Re-saving an unchanged non-privileged role stays open.
  if (input.role && nextRole !== normalizeRole(existing.roleCode)) {
    assertCanAssignRole(actor, nextRole);
  }
  if (PRIVILEGED_ROLES.has(normalizeRole(existing.roleCode)) && actor.role !== 'SUPER_ADMIN') {
    throw new Error('Only a super admin can modify a SUPER_ADMIN or EXECUTIVE user.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        email: nextEmail,
        displayName: nextDisplayName,
        roleCode: nextRole,
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: USER_SELECT,
    });

    const localIdentity = existing.identities.find((identity) => identity.provider === IdentityProvider.LOCAL);
    if (localIdentity && nextEmail !== existing.email) {
      await tx.userIdentity.update({
        where: { id: localIdentity.id },
        data: {
          loginEmail: nextEmail,
          providerSubject: nextEmail,
        },
      });
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: USER_ENTITY_TYPE,
        entityId: user.id,
        beforeData: {
          email: existing.email,
          displayName: existing.displayName,
          role: existing.roleCode,
          isActive: existing.isActive,
        },
        afterData: {
          email: user.email,
          displayName: user.displayName,
          role: user.roleCode,
          isActive: user.isActive,
        },
        metadata: {
          operation: 'admin.update_user',
        },
      }),
    });

    return user;
  });

  return {
    user: toAdminUserSummary(updated),
  };
}

export async function resetAdminUserPassword(
  actor: AuthenticatedActor,
  userId: string,
  input: ResetAdminUserPasswordRequest,
): Promise<ResetAdminUserPasswordResponse> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      identities: {
        where: {
          provider: IdentityProvider.LOCAL,
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (!existing) {
    throw new Error('User not found');
  }

  const localIdentity = existing.identities[0];
  if (!localIdentity) {
    throw new Error('User does not have a local password identity');
  }

  const temporaryPassword = input.password?.trim() || createTemporaryPassword();
  const passwordHash = hashSecret(temporaryPassword);

  await prisma.$transaction(async (tx) => {
    await tx.userIdentity.update({
      where: { id: localIdentity.id },
      data: {
        passwordHash,
      },
    });

    await tx.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: 'password-reset',
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: USER_ENTITY_TYPE,
        entityId: userId,
        metadata: {
          operation: 'admin.reset_password',
        },
      }),
    });
  });

  return {
    userId,
    email: existing.email,
    temporaryPassword,
    resetAt: new Date().toISOString(),
  };
}

export async function importAdminUsers(
  actor: AuthenticatedActor,
  input: ImportAdminUsersRequest,
): Promise<ImportAdminUsersResponse> {
  const users: AdminUserSummary[] = [];
  const credentials: ImportAdminUsersResponse['credentials'] = [];
  const errors: ImportAdminUsersResponse['errors'] = [];

  for (const [index, row] of input.rows.entries()) {
    try {
      const response = await createAdminUser(actor, row);
      users.push(response.user);
      credentials.push({
        email: response.user.email,
        temporaryPassword: response.temporaryPassword,
      });
    } catch (error) {
      errors.push({
        row: index + 1,
        email: row.email,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    totalProcessed: input.rows.length,
    successful: users.length,
    failed: errors.length,
    users,
    credentials,
    errors,
  };
}

export async function listAdminRoleAccess(): Promise<AdminRoleAccessCatalogResponse> {
  return {
    roles: AUTH_ROLES.map((role) => ({
      role,
      displayName: ROLE_PROFILE_CATALOG[role].displayName,
      summary: ROLE_PROFILE_CATALOG[role].summary,
      bestFor: ROLE_PROFILE_CATALOG[role].bestFor,
      scopeSummary: ROLE_PROFILE_CATALOG[role].scopeSummary,
      modules: [...ROLE_DEFAULT_MODULE_ACCESS[role]],
      actions: [...ROLE_DEFAULT_ACTION_ACCESS[role]],
      workspaceHighlights: [...ROLE_PROFILE_CATALOG[role].workspaceHighlights],
      actionHighlights: [...ROLE_PROFILE_CATALOG[role].actionHighlights],
    })),
  };
}

export async function listAdminActivity(input: ListAdminActivityRequest = {}): Promise<ListAdminActivityResponse> {
  const entries = await prisma.auditEntry.findMany({
    where: {
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      ...(input.action ? { action: input.action as AuditAction } : {}),
      ...(input.entityType ? { entityType: input.entityType } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    take: Math.min(100, Math.max(1, input.limit ?? 20)),
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          displayName: true,
          roleCode: true,
        },
      },
    },
  });

  return {
    entries: entries.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt.toISOString(),
      action: entry.action,
      entityType: entry.entityType,
      ...(entry.entityId ? { entityId: entry.entityId } : {}),
      ...(entry.actor
        ? {
            actor: {
              userId: entry.actor.id,
              displayName: entry.actor.displayName,
              email: entry.actor.email,
              role: normalizeRole(entry.actor.roleCode),
            },
          }
        : {}),
      summary: summarizeAuditEntry(entry.action, entry.entityType, entry.metadata),
      ...(isRecord(entry.metadata) ? { metadata: entry.metadata } : {}),
    })),
  };
}

export async function getAdminOverview(): Promise<AdminOverviewResponse> {
  const now = new Date();

  const [totalUsers, activeUsers, pendingUsers, activeSessions, recentActivity] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true, lastLoginAt: null } }),
    prisma.session.count({
      where: {
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
    }),
    listAdminActivity({ limit: 8 }),
  ]);

  return {
    totalUsers,
    activeUsers,
    pendingUsers,
    activeSessions,
    recentActivity: recentActivity.entries,
  };
}

export async function getAdminSystemHealth(
  snapshot: AdminSystemHealthSnapshot,
): Promise<AdminSystemHealthResponse> {
  const now = new Date();
  const checkedAt = new Date().toISOString();
  const [totalUsers, activeUsers, pendingUsers, activeSessions, revokedSessions] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true, lastLoginAt: null } }),
    prisma.session.count({
      where: {
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
    }),
    prisma.session.count({
      where: {
        revokedAt: {
          not: null,
        },
      },
    }),
  ]);

  return {
    checkedAt,
    application: {
      service: snapshot.config.app.name,
      version: snapshot.config.app.version,
      environment: snapshot.config.environment.name,
    },
    users: {
      total: totalUsers,
      active: activeUsers,
      pending: pendingUsers,
    },
    sessions: {
      active: activeSessions,
      revoked: revokedSessions,
    },
    database: {
      ok: snapshot.database.ok,
      checkedAt: snapshot.database.checkedAt,
      ...(snapshot.database.error ? { error: snapshot.database.error } : {}),
    },
    queue: {
      ok: snapshot.queue.ok,
      ...(snapshot.queue.checkedAt ? { checkedAt: snapshot.queue.checkedAt } : {}),
      ...(snapshot.queue.error ? { error: snapshot.queue.error } : {}),
    },
    workers: {
      registeredWorkers:
        snapshot.workers.registeredWorkers
        ?? snapshot.workers.queue?.registeredWorkers
        ?? 0,
      ...(snapshot.workers.running ? { startedAt: checkedAt } : {}),
    },
    acumatica: {
      ok: snapshot.acumatica.ok,
      ...(snapshot.acumatica.checkedAt ? { checkedAt: snapshot.acumatica.checkedAt } : {}),
      ...(snapshot.acumatica.status ? { status: snapshot.acumatica.status } : {}),
      ...(snapshot.acumatica.error ? { error: snapshot.acumatica.error } : {}),
    },
  };
}

export async function getAdminIntegrationStatus(
  snapshot: AdminSystemHealthSnapshot,
): Promise<AdminIntegrationStatusResponse> {
  const checkedAt = new Date().toISOString();
  const [calendarIntegrations, authIntegrations, paymentIntegrations, leadAlertIntegrations] = await Promise.all([
    listOutlookIntegrationStatuses(snapshot.config),
    listMicrosoftEntraIntegrationStatuses(snapshot.config),
    listPaymentIntegrationStatusesForConfig(snapshot.config),
    listLeadOperationalAlertIntegrationStatuses(snapshot.config),
  ]);

  return {
    integrations: [
      {
        key: 'database',
        label: 'PostgreSQL',
        status: snapshot.database.ok ? 'connected' : 'error',
        health: snapshot.database.ok ? 100 : 0,
        lastCheckedAt: snapshot.database.checkedAt,
        detail: snapshot.database.ok ? 'Primary CRM system of record is reachable.' : snapshot.database.error ?? 'Database is unavailable.',
      },
      {
        key: 'queue',
        label: 'Queue Runtime',
        status: snapshot.queue.ok ? 'connected' : 'error',
        health: snapshot.queue.ok ? 100 : 0,
        lastCheckedAt: snapshot.queue.checkedAt ?? checkedAt,
        detail: snapshot.queue.ok ? 'Background worker runtime is available.' : snapshot.queue.error ?? 'Queue is unavailable.',
      },
      {
        key: 'acumatica',
        label: 'Acumatica',
        status: snapshot.acumatica.ok ? 'connected' : 'warning',
        health: snapshot.acumatica.ok ? 100 : 45,
        lastCheckedAt: snapshot.acumatica.checkedAt ?? checkedAt,
        detail: snapshot.acumatica.ok
          ? 'Acumatica connectivity is healthy.'
          : snapshot.acumatica.error ?? 'Awaiting sandbox certification or upstream access.',
      },
      ...authIntegrations,
      ...paymentIntegrations,
      ...calendarIntegrations,
      ...leadAlertIntegrations,
    ],
  };
}

function buildUserWhere(input: ListAdminUsersRequest): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (input.search) {
    where.OR = [
      {
        email: {
          contains: input.search,
          mode: 'insensitive',
        },
      },
      {
        displayName: {
          contains: input.search,
          mode: 'insensitive',
        },
      },
    ];
  }

  if (input.role) {
    where.roleCode = normalizeRole(input.role);
  }

  if (input.status === 'ACTIVE') {
    where.isActive = true;
    where.lastLoginAt = {
      not: null,
    };
  } else if (input.status === 'PENDING') {
    where.isActive = true;
    where.lastLoginAt = null;
  } else if (input.status === 'INACTIVE') {
    where.isActive = false;
  }

  return where;
}

function toAdminUserSummary(user: SelectedUser): AdminUserSummary {
  const primaryIdentity = user.identities[0];
  const name = splitDisplayName(user.displayName);

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    firstName: name.firstName,
    lastName: name.lastName,
    role: normalizeRole(user.roleCode),
    actorType: mapUserKind(user.userType),
    provider: mapProvider(primaryIdentity?.provider),
    status: deriveUserStatus(user.isActive, user.lastLoginAt),
    isActive: user.isActive,
    ...(user.lastLoginAt ? { lastLoginAt: user.lastLoginAt.toISOString() } : {}),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    activeSessionCount: user.sessions.length,
  };
}

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return {
      firstName: 'Pulse',
      lastName: 'User',
    };
  }

  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: firstName || 'Pulse',
    lastName: rest.join(' ') || 'User',
  };
}

function deriveUserStatus(isActive: boolean, lastLoginAt: Date | null): AdminUserStatus {
  if (!isActive) {
    return 'INACTIVE';
  }

  if (!lastLoginAt) {
    return 'PENDING';
  }

  return 'ACTIVE';
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createTemporaryPassword() {
  return randomBytes(9).toString('base64url');
}

function hashSecret(secret: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(secret, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function mapProvider(provider: IdentityProvider | undefined): AdminUserSummary['provider'] {
  switch (provider) {
    case IdentityProvider.LOCAL:
      return 'LOCAL';
    case IdentityProvider.MICROSOFT_ENTRA:
      return 'MICROSOFT_ENTRA';
    case IdentityProvider.SERVICE:
      return 'SERVICE';
    default:
      return 'UNKNOWN';
  }
}

function mapUserKind(userKind: UserKind): AdminUserSummary['actorType'] {
  switch (userKind) {
    case UserKind.DEALER:
      return 'dealer';
    case UserKind.SERVICE:
      return 'service';
    default:
      return 'internal';
  }
}

function summarizeAuditEntry(
  action: AuditAction,
  entityType: string,
  metadata: Prisma.JsonValue | null,
) {
  const operation = isRecord(metadata) && typeof metadata.operation === 'string'
    ? metadata.operation.replace(/^admin\./, '').replace(/_/g, ' ')
    : undefined;

  return operation
    ? `${capitalize(action.toLowerCase())}: ${operation}`
    : `${capitalize(action.toLowerCase())} ${entityType.toLowerCase()}`;
}

function capitalize(value: string) {
  return value ? `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}` : value;
}

function isRecord(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
