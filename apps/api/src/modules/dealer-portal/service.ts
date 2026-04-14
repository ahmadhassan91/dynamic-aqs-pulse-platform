import { randomBytes, scryptSync } from 'node:crypto';
import { assertActionAccess, assertModuleAccess, normalizeRole } from '@pulse/auth';
import {
  AuditAction,
  DealerPortalProvisioningStatus,
  DealerPortalUserStatus,
  IdentityProvider,
  PortalEligibilityStatus,
  Prisma,
  UserKind,
  prisma,
} from '@pulse/db';
import type {
  DealerPortalAccountDetail,
  DealerPortalAccountSummary,
  DealerPortalDashboardResponse,
  DealerPortalProvisioningStatusKey,
  DealerPortalUserStatusKey,
  DealerPortalUserSummary,
  ProvisionDealerPortalUserRequest,
  ProvisionDealerPortalUserResponse,
  ResetDealerPortalUserPasswordRequest,
  ResetDealerPortalUserPasswordResponse,
  UpdateDealerPortalUserStatusRequest,
  UpdateDealerPortalUserStatusResponse,
} from '@pulse/contracts';
import { createAccountContact } from '../accounts/service.js';
import type { AuthenticatedActor } from '../auth/types.js';
import { buildAuditEntryData } from '../../utils/audit.js';

const DEALER_PORTAL_ACCOUNT_ENTITY = 'DEALER_PORTAL_ACCOUNT';
const DEALER_PORTAL_USER_ENTITY = 'DEALER_PORTAL_USER';

const DEALER_PORTAL_ACCOUNT_INCLUDE = {
  sourceLead: {
    select: {
      id: true,
      conversionPreparation: {
        select: {
          portalEligibilityStatus: true,
        },
      },
    },
  },
  assignedTmUser: {
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  },
  assignedRdUser: {
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  },
  territory: {
    include: {
      region: true,
    },
  },
  shippingCenter: true,
  dealerPortalUsers: {
    orderBy: [
      { isPrimaryOwner: 'desc' },
      { createdAt: 'asc' },
    ],
    include: {
      contact: true,
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          isActive: true,
          lastLoginAt: true,
        },
      },
    },
  },
  dealerPortalAccount: {
    select: {
      accountId: true,
      status: true,
      notes: true,
      provisionedAt: true,
      suspendedAt: true,
      deactivatedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  contacts: {
    orderBy: [
      { isPrimary: 'desc' },
      { createdAt: 'asc' },
    ],
  },
  locations: {
    orderBy: [
      { isPrimary: 'desc' },
      { createdAt: 'asc' },
    ],
  },
} satisfies Prisma.AccountInclude;

type DealerPortalAccountRecord = Prisma.AccountGetPayload<{
  include: typeof DEALER_PORTAL_ACCOUNT_INCLUDE;
}>;

export async function getDealerPortalAccount(
  actor: AuthenticatedActor,
  accountId: string,
): Promise<DealerPortalAccountDetail | null> {
  assertModuleAccess(actor.role, 'dealer_portal');
  assertActionAccess(actor.role, 'lead.portal_setup');

  const account = await loadDealerPortalAccountRecord(accountId);
  if (!account) {
    return null;
  }

  return toDealerPortalAccountDetail(account);
}

export async function provisionDealerPortalUser(
  actor: AuthenticatedActor,
  accountId: string,
  input: ProvisionDealerPortalUserRequest,
): Promise<ProvisionDealerPortalUserResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');
  assertActionAccess(actor.role, 'lead.portal_setup');

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      sourceLead: {
        select: {
          id: true,
          conversionPreparation: {
            select: {
              portalEligibilityStatus: true,
            },
          },
        },
      },
      contacts: {
        orderBy: [
          { isPrimary: 'desc' },
          { createdAt: 'asc' },
        ],
      },
      dealerPortalAccount: {
        select: {
          accountId: true,
        },
      },
      dealerPortalUsers: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!account) {
    throw new Error('Account not found');
  }

  if (!account.isActive) {
    throw new Error('Inactive accounts cannot receive dealer portal access');
  }

  let contactId = input.contactId?.trim();
  let createdContactId: string | undefined;
  let contact = contactId
    ? account.contacts.find((entry) => entry.id === contactId) ?? null
    : null;

  if (contactId && !contact) {
    throw new Error('Selected contact does not belong to this account');
  }

  if (!contact) {
    const firstName = input.firstName?.trim();
    const lastName = input.lastName?.trim();
    if (!firstName || !lastName) {
      throw new Error('firstName and lastName are required when contactId is not provided');
    }

    const createdContact = await createAccountContact(actor, accountId, {
      firstName,
      lastName,
      ...(input.title?.trim() ? { title: input.title.trim() } : {}),
      ...(input.email?.trim() ? { email: input.email.trim() } : {}),
      isPrimary: input.isPrimaryOwner ?? false,
      isActive: true,
    });
    createdContactId = createdContact.id;
    contactId = createdContact.id;

    contact = await prisma.contact.findUnique({
      where: { id: createdContact.id },
    });
  }

  const email = normalizeEmail(input.email ?? contact?.email ?? undefined);
  if (!email) {
    throw new Error('Dealer portal user requires an email address');
  }

  const existingMembership = account.dealerPortalUsers.find((entry) =>
    entry.user.email.toLowerCase() === email
    || (contactId ? entry.contactId === contactId : false),
  );
  if (existingMembership) {
    throw new Error('A dealer portal user already exists for this contact or email');
  }

  const temporaryPassword = input.password?.trim() || createTemporaryPassword();
  const passwordHash = hashSecret(temporaryPassword);
  const displayName = contact
    ? `${contact.firstName} ${contact.lastName}`.trim()
    : `${input.firstName?.trim() ?? ''} ${input.lastName?.trim() ?? ''}`.trim();
  const roleCode = normalizeRole('DEALER_PORTAL_USER');
  const isPrimaryOwner = input.isPrimaryOwner ?? false;

  await prisma.$transaction(async (tx) => {
    if (isPrimaryOwner) {
      await tx.dealerPortalUser.updateMany({
        where: {
          accountId,
          isPrimaryOwner: true,
        },
        data: {
          isPrimaryOwner: false,
        },
      });
    }

    const user = await tx.user.create({
      data: {
        email,
        displayName,
        roleCode,
        userType: UserKind.DEALER,
        isActive: true,
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
      select: {
        id: true,
      },
    });

    await tx.dealerPortalAccount.upsert({
      where: { accountId },
      create: {
        accountId,
        status: DealerPortalProvisioningStatus.ACTIVE,
        provisionedAt: new Date(),
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      },
      update: {
        status: DealerPortalProvisioningStatus.ACTIVE,
        provisionedAt: new Date(),
        suspendedAt: null,
        deactivatedAt: null,
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      },
    });

    await tx.dealerPortalUser.create({
      data: {
        accountId,
        ...(contactId ? { contactId } : {}),
        userId: user.id,
        createdByUserId: actor.userId,
        status: DealerPortalUserStatus.ACTIVE,
        isPrimaryOwner,
        activatedAt: new Date(),
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: DEALER_PORTAL_ACCOUNT_ENTITY,
        entityId: accountId,
        metadata: {
          operation: 'dealer_portal.provision_account',
          sessionId: actor.sessionId,
          actorRole: actor.role,
        },
        afterData: {
          accountId,
          status: 'active',
        },
      }),
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: DEALER_PORTAL_USER_ENTITY,
        entityId: user.id,
        metadata: {
          operation: 'dealer_portal.provision_user',
          sessionId: actor.sessionId,
          actorRole: actor.role,
        },
        afterData: {
          accountId,
          userId: user.id,
          email,
          isPrimaryOwner,
        },
      }),
    });
  });

  const detail = await getDealerPortalAccount(actor, accountId);
  if (!detail) {
    throw new Error('Dealer portal account could not be loaded after provisioning');
  }

  const user = detail.users.find((entry) => entry.email.toLowerCase() === email);
  if (!user) {
    throw new Error('Dealer portal user could not be loaded after provisioning');
  }

  return {
    portalAccount: detail,
    user,
    temporaryPassword,
    ...(createdContactId ? { createdContactId } : {}),
  };
}

export async function updateDealerPortalUserStatus(
  actor: AuthenticatedActor,
  portalUserId: string,
  input: UpdateDealerPortalUserStatusRequest,
): Promise<UpdateDealerPortalUserStatusResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');
  assertActionAccess(actor.role, 'lead.portal_setup');

  const existing = await prisma.dealerPortalUser.findUnique({
    where: { id: portalUserId },
    include: {
      user: true,
    },
  });

  if (!existing) {
    throw new Error('Dealer portal user not found');
  }

  const nextStatus = toDealerPortalUserStatusEnum(input.status);

  await prisma.$transaction(async (tx) => {
    await tx.dealerPortalUser.update({
      where: { id: portalUserId },
      data: {
        status: nextStatus,
        suspendedAt: nextStatus === DealerPortalUserStatus.SUSPENDED ? new Date() : null,
        deactivatedAt: nextStatus === DealerPortalUserStatus.DEACTIVATED ? new Date() : null,
        ...(input.notes?.trim() !== undefined ? { notes: input.notes?.trim() || null } : {}),
      },
    });

    await tx.user.update({
      where: { id: existing.userId },
      data: {
        isActive: nextStatus === DealerPortalUserStatus.ACTIVE,
      },
    });

    if (nextStatus !== DealerPortalUserStatus.ACTIVE) {
      await tx.session.updateMany({
        where: {
          userId: existing.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokedReason: `dealer-portal-${input.status}`,
        },
      });
    }

    const activeUsers = await tx.dealerPortalUser.count({
      where: {
        accountId: existing.accountId,
        status: DealerPortalUserStatus.ACTIVE,
      },
    });

    await tx.dealerPortalAccount.upsert({
      where: { accountId: existing.accountId },
      create: {
        accountId: existing.accountId,
        status: nextStatus === DealerPortalUserStatus.ACTIVE
          ? DealerPortalProvisioningStatus.ACTIVE
          : nextStatus === DealerPortalUserStatus.SUSPENDED
            ? DealerPortalProvisioningStatus.SUSPENDED
            : DealerPortalProvisioningStatus.DEACTIVATED,
        ...(nextStatus === DealerPortalUserStatus.ACTIVE ? { provisionedAt: new Date() } : {}),
        ...(nextStatus === DealerPortalUserStatus.SUSPENDED ? { suspendedAt: new Date() } : {}),
        ...(nextStatus === DealerPortalUserStatus.DEACTIVATED ? { deactivatedAt: new Date() } : {}),
      },
      update: {
        status: activeUsers > 0
          ? DealerPortalProvisioningStatus.ACTIVE
          : nextStatus === DealerPortalUserStatus.SUSPENDED
            ? DealerPortalProvisioningStatus.SUSPENDED
            : DealerPortalProvisioningStatus.DEACTIVATED,
        ...(activeUsers > 0 ? { provisionedAt: new Date(), suspendedAt: null, deactivatedAt: null } : {}),
        ...(activeUsers === 0 && nextStatus === DealerPortalUserStatus.SUSPENDED ? { suspendedAt: new Date() } : {}),
        ...(activeUsers === 0 && nextStatus === DealerPortalUserStatus.DEACTIVATED ? { deactivatedAt: new Date() } : {}),
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: DEALER_PORTAL_USER_ENTITY,
        entityId: existing.id,
        metadata: {
          operation: 'dealer_portal.update_user_status',
          sessionId: actor.sessionId,
          actorRole: actor.role,
        },
        beforeData: {
          status: toDealerPortalUserStatusKey(existing.status),
          isActive: existing.user.isActive,
        },
        afterData: {
          status: input.status,
          isActive: nextStatus === DealerPortalUserStatus.ACTIVE,
        },
      }),
    });
  });

  const detail = await getDealerPortalAccount(actor, existing.accountId);
  if (!detail) {
    throw new Error('Dealer portal account could not be loaded after update');
  }

  const user = detail.users.find((entry) => entry.id === portalUserId);
  if (!user) {
    throw new Error('Dealer portal user could not be loaded after update');
  }

  return {
    portalAccount: detail,
    user,
  };
}

export async function resetDealerPortalUserPassword(
  actor: AuthenticatedActor,
  portalUserId: string,
  input: ResetDealerPortalUserPasswordRequest,
): Promise<ResetDealerPortalUserPasswordResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');
  assertActionAccess(actor.role, 'lead.portal_setup');

  const existing = await prisma.dealerPortalUser.findUnique({
    where: { id: portalUserId },
    include: {
      user: {
        include: {
          identities: {
            where: {
              provider: IdentityProvider.LOCAL,
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!existing) {
    throw new Error('Dealer portal user not found');
  }

  const localIdentity = existing.user.identities[0];
  if (!localIdentity) {
    throw new Error('Dealer portal user does not have a local password identity');
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
        userId: existing.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: 'dealer-portal-password-reset',
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: DEALER_PORTAL_USER_ENTITY,
        entityId: existing.id,
        metadata: {
          operation: 'dealer_portal.reset_password',
          sessionId: actor.sessionId,
          actorRole: actor.role,
        },
      }),
    });
  });

  return {
    userId: existing.userId,
    email: existing.user.email,
    temporaryPassword,
    resetAt: new Date().toISOString(),
  };
}

export async function getCurrentDealerPortalDashboard(
  actor: AuthenticatedActor,
): Promise<DealerPortalDashboardResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');

  const portalUser = await prisma.dealerPortalUser.findFirst({
    where: {
      userId: actor.userId,
      status: DealerPortalUserStatus.ACTIVE,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          isActive: true,
          lastLoginAt: true,
        },
      },
      account: {
        include: DEALER_PORTAL_ACCOUNT_INCLUDE,
      },
      contact: true,
    },
  });

  if (!portalUser) {
    throw new Error('Dealer portal user is not linked to an active dealer account');
  }

  const detail = toDealerPortalAccountDetail(portalUser.account);
  const currentUser = detail.users.find((entry) => entry.userId === actor.userId);
  if (!currentUser) {
    throw new Error('Dealer portal user record not found for current session');
  }

  return {
    portalAccount: toDealerPortalAccountSummary(portalUser.account),
    currentUser,
    companyUsers: detail.users,
    contacts: portalUser.account.contacts.map((contact) => ({
      id: contact.id,
      displayName: `${contact.firstName} ${contact.lastName}`.trim(),
      ...(contact.title ? { title: contact.title } : {}),
      ...(contact.email ? { email: contact.email } : {}),
      ...(contact.phone ? { phone: contact.phone } : {}),
      isPrimary: contact.isPrimary,
    })),
    locations: portalUser.account.locations.map((location) => ({
      id: location.id,
      name: location.name ?? location.locationCode ?? 'Location',
      ...(location.city ? { city: location.city } : {}),
      ...(location.state ? { state: location.state } : {}),
      ...(location.countryCode ? { countryCode: location.countryCode } : {}),
      isPrimary: location.isPrimary,
    })),
  };
}

async function loadDealerPortalAccountRecord(accountId: string) {
  return prisma.account.findUnique({
    where: { id: accountId },
    include: DEALER_PORTAL_ACCOUNT_INCLUDE,
  });
}

function toDealerPortalAccountDetail(account: DealerPortalAccountRecord): DealerPortalAccountDetail {
  return {
    ...toDealerPortalAccountSummary(account),
    users: account.dealerPortalUsers.map(toDealerPortalUserSummary),
  };
}

function toDealerPortalAccountSummary(account: DealerPortalAccountRecord): DealerPortalAccountSummary {
  const sourceLeadPortalStatus = account.sourceLead?.conversionPreparation?.portalEligibilityStatus;
  const persistedStatus = account.dealerPortalAccount?.status;
  const activePortalUsers = account.dealerPortalUsers.filter((entry) => entry.status === DealerPortalUserStatus.ACTIVE).length;
  const totalPortalUsers = account.dealerPortalUsers.length;

  const derivedStatus = persistedStatus
    ?? (sourceLeadPortalStatus === 'PROVISIONED'
      ? DealerPortalProvisioningStatus.ACTIVE
      : sourceLeadPortalStatus === 'READY'
        ? DealerPortalProvisioningStatus.READY_TO_PROVISION
        : DealerPortalProvisioningStatus.NOT_STARTED);

  const summary: DealerPortalAccountSummary = {
    accountId: account.id,
    accountDisplayName: account.displayName,
    status: toDealerPortalProvisioningStatusKey(derivedStatus),
    activePortalUsers,
    totalPortalUsers,
    createdAt: (account.dealerPortalAccount?.createdAt ?? account.createdAt).toISOString(),
    updatedAt: (account.dealerPortalAccount?.updatedAt ?? account.updatedAt).toISOString(),
  };

  if (account.accountNumber) {
    summary.accountNumber = account.accountNumber;
  }
  if (account.sourceLeadId) {
    summary.sourceLeadId = account.sourceLeadId;
  }
  if (account.dealerPortalAccount?.notes) {
    summary.notes = account.dealerPortalAccount.notes;
  }
  if (sourceLeadPortalStatus) {
    summary.portalEligibilityStatus = toPortalEligibilityStatusKey(sourceLeadPortalStatus);
  }
  if (account.territory?.name) {
    summary.territoryName = account.territory.name;
  }
  if (account.territory?.region?.name) {
    summary.regionName = account.territory.region.name;
  }
  if (account.shippingCenter?.name) {
    summary.shippingCenterName = account.shippingCenter.name;
  }
  if (account.assignedTmUser?.displayName) {
    summary.assignedTmName = account.assignedTmUser.displayName;
  }
  if (account.assignedTmUser?.email) {
    summary.assignedTmEmail = account.assignedTmUser.email;
  }
  if (account.assignedRdUser?.displayName) {
    summary.assignedRdName = account.assignedRdUser.displayName;
  }
  if (account.assignedRdUser?.email) {
    summary.assignedRdEmail = account.assignedRdUser.email;
  }
  if (account.dealerPortalAccount?.provisionedAt) {
    summary.provisionedAt = account.dealerPortalAccount.provisionedAt.toISOString();
  }

  return summary;
}

function toDealerPortalUserSummary(
  portalUser: DealerPortalAccountRecord['dealerPortalUsers'][number],
): DealerPortalUserSummary {
  const summary: DealerPortalUserSummary = {
    id: portalUser.id,
    userId: portalUser.userId,
    accountId: portalUser.accountId,
    email: portalUser.user.email,
    displayName: portalUser.user.displayName,
    status: toDealerPortalUserStatusKey(portalUser.status),
    isPrimaryOwner: portalUser.isPrimaryOwner,
    isActive: portalUser.user.isActive,
    createdAt: portalUser.createdAt.toISOString(),
    updatedAt: portalUser.updatedAt.toISOString(),
  };

  if (portalUser.contactId) {
    summary.contactId = portalUser.contactId;
  }
  if (portalUser.contact?.title) {
    summary.title = portalUser.contact.title;
  }
  if (portalUser.user.lastLoginAt) {
    summary.lastLoginAt = portalUser.user.lastLoginAt.toISOString();
  }
  if (portalUser.activatedAt) {
    summary.activatedAt = portalUser.activatedAt.toISOString();
  }
  if (portalUser.suspendedAt) {
    summary.suspendedAt = portalUser.suspendedAt.toISOString();
  }
  if (portalUser.deactivatedAt) {
    summary.deactivatedAt = portalUser.deactivatedAt.toISOString();
  }

  return summary;
}

function normalizeEmail(email: string | undefined) {
  return email?.trim().toLowerCase();
}

function createTemporaryPassword() {
  return randomBytes(12).toString('base64url');
}

function hashSecret(secret: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(secret, salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

function toDealerPortalProvisioningStatusKey(
  status: DealerPortalProvisioningStatus,
): DealerPortalProvisioningStatusKey {
  switch (status) {
    case DealerPortalProvisioningStatus.NOT_STARTED:
      return 'not_started';
    case DealerPortalProvisioningStatus.READY_TO_PROVISION:
      return 'ready_to_provision';
    case DealerPortalProvisioningStatus.ACTIVE:
      return 'active';
    case DealerPortalProvisioningStatus.SUSPENDED:
      return 'suspended';
    case DealerPortalProvisioningStatus.DEACTIVATED:
      return 'deactivated';
  }
}

function toDealerPortalUserStatusEnum(status: DealerPortalUserStatusKey) {
  switch (status) {
    case 'active':
      return DealerPortalUserStatus.ACTIVE;
    case 'suspended':
      return DealerPortalUserStatus.SUSPENDED;
    case 'deactivated':
      return DealerPortalUserStatus.DEACTIVATED;
  }
}

function toDealerPortalUserStatusKey(status: DealerPortalUserStatus): DealerPortalUserStatusKey {
  switch (status) {
    case DealerPortalUserStatus.ACTIVE:
      return 'active';
    case DealerPortalUserStatus.SUSPENDED:
      return 'suspended';
    case DealerPortalUserStatus.DEACTIVATED:
      return 'deactivated';
  }
}

function toPortalEligibilityStatusKey(
  status: PortalEligibilityStatus,
): NonNullable<DealerPortalAccountSummary['portalEligibilityStatus']> {
  switch (status) {
    case 'UNASSESSED':
      return 'unassessed';
    case 'BLOCKED':
      return 'blocked';
    case 'READY':
      return 'ready';
    case 'PROVISIONED':
      return 'provisioned';
  }
}
