import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { AuthorizationError, assertActionAccess, assertModuleAccess, normalizeRole } from '@pulse/auth';
import {
  AuditAction,
  CatalogRuleResultAction,
  CatalogRuleSetStatus,
  DealerPortalAccessRole,
  DealerPortalProvisioningStatus,
  DealerPortalUserStatus,
  DigitalAssetReviewStatus,
  DigitalAssetStatus,
  DigitalAssetVisibility,
  IdentityProvider,
  OrderDraftStatus,
  OrderSource,
  PortalEligibilityStatus,
  Prisma,
  ProductLifecycleStatus,
  ProductPublishStatus,
  DealerCatalogViewKind,
  UserKind,
  prisma,
} from '@pulse/db';
import type {
  CatalogRuleConditionInput,
  AcceptDealerPortalInviteRequest,
  AcceptDealerPortalInviteResponse,
  AddDealerPortalCartItemRequest,
  CreateDealerPortalInviteResponse,
  DealerPortalAccessRoleKey,
  DealerPortalAccountDetail,
  DealerPortalAccountSummary,
  DealerPortalAssetOpenResponse,
  DealerPortalCartLine,
  DealerPortalCartResponse,
  DealerPortalCatalogResponse,
  DealerPortalCatalogDiagnostics,
  DealerPortalDashboardResponse,
  DealerPortalFavoriteProductResponse,
  DealerPortalInternalPreviewResponse,
  DealerPortalOrderDetail,
  DealerPortalOrdersResponse,
  DealerPortalOrderSummary,
  OrderDraftStatusKey,
  SubmitDealerPortalOrderRequest,
  UpdateDealerPortalCartItemRequest,
  DealerPortalSelfCreateUserRequest,
  DealerPortalSelfCreateUserResponse,
  DealerPortalSelfUpdateUserRequest,
  DealerPortalSelfUpdateUserResponse,
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
import { loadAppConfig } from '@pulse/config';
import { createAccountContact } from '../accounts/service.js';
import type { AuthenticatedActor } from '../auth/types.js';
import { buildPublicAssetUrl } from '../digital-assets/storage.js';
import { buildAuditEntryData } from '../../utils/audit.js';

const DEALER_PORTAL_ACCOUNT_ENTITY = 'DEALER_PORTAL_ACCOUNT';
const DEALER_PORTAL_USER_ENTITY = 'DEALER_PORTAL_USER';
const DEALER_PORTAL_CATALOG_ASSET_ENTITY = 'DEALER_PORTAL_CATALOG_ASSET';
const DEALER_PORTAL_INTERNAL_PREVIEW_ENTITY = 'DEALER_PORTAL_INTERNAL_PREVIEW';
const DEALER_PORTAL_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
type DealerPortalAssetDeliverySource = 'legacy_url' | 'external_url' | 'cloudfront_storage_key' | 'missing_delivery_url';

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

const DEALER_PORTAL_ACCOUNT_CATALOG_CONTEXT_INCLUDE = {
  ...DEALER_PORTAL_ACCOUNT_INCLUDE,
  affinityGroup: true,
  ownershipGroup: true,
} satisfies Prisma.AccountInclude;

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

export async function getDealerPortalInternalPreview(
  actor: AuthenticatedActor,
  accountId: string,
  accessRole: DealerPortalAccessRoleKey,
): Promise<DealerPortalInternalPreviewResponse | null> {
  assertModuleAccess(actor.role, 'dealer_portal');
  assertActionAccess(actor.role, 'lead.portal_setup');
  assertInternalActor(actor);

  const selectedRole = toDealerPortalAccessRoleKey(toDealerPortalAccessRoleEnum(accessRole));
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: DEALER_PORTAL_ACCOUNT_CATALOG_CONTEXT_INCLUDE,
  });
  if (!account) {
    return null;
  }

  const catalogContext = await buildDealerPortalCatalogForAccount(account, {
    includeDiagnostics: true,
    selectedPreviewRole: selectedRole,
  });
  const dashboard = buildDealerPortalDashboardContext(account);
  const generatedAt = new Date();

  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.EXPORT,
      entityType: DEALER_PORTAL_INTERNAL_PREVIEW_ENTITY,
      entityId: accountId,
      metadata: {
        operation: 'dealer_portal.internal_preview',
        sessionId: actor.sessionId,
        actorRole: actor.role,
        actorType: actor.actorType,
        selectedRole,
        catalogViewId: catalogContext.catalog.catalogView?.id ?? null,
        productCount: catalogContext.catalog.products.length,
      },
      afterData: {
        accountId,
        selectedRole,
        readOnly: true,
        generatedAt: generatedAt.toISOString(),
      },
    }),
  });

  return {
    previewRole: selectedRole,
    preview: {
      mode: 'internal_preview',
      readOnly: true,
      accountId,
      selectedRole,
      actorUserId: actor.userId,
      generatedAt: generatedAt.toISOString(),
      restrictions: [
        'read_only',
        'no_dealer_session',
        'no_pricing',
        'no_orders',
        'no_invoices',
        'no_payments',
        'no_credit_enforcement',
      ],
    },
    portalAccount: toDealerPortalAccountSummary(account),
    dashboard,
    catalog: catalogContext.catalog,
    visibleProductCount: catalogContext.catalog.products.length,
    visibleFileCount: catalogContext.catalog.products.reduce((total, product) => total + product.assets.length, 0),
    generatedAt: generatedAt.toISOString(),
    diagnostics: catalogContext.diagnostics,
  };
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
  const inviteToken = createInviteToken();
  const inviteExpiresAt = new Date(Date.now() + DEALER_PORTAL_INVITE_TTL_MS);
  const displayName = contact
    ? `${contact.firstName} ${contact.lastName}`.trim()
    : `${input.firstName?.trim() ?? ''} ${input.lastName?.trim() ?? ''}`.trim();
  const roleCode = normalizeRole('DEALER_PORTAL_USER');
  const isPrimaryOwner = input.isPrimaryOwner ?? false;
  const accessRole = input.accessRole ? toDealerPortalAccessRoleEnum(input.accessRole) : DealerPortalAccessRole.ADMIN;

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
        accessRole,
        isPrimaryOwner,
        inviteTokenHash: hashToken(inviteToken),
        inviteIssuedAt: new Date(),
        inviteExpiresAt,
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
          accessRole: toDealerPortalAccessRoleKey(accessRole),
          inviteExpiresAt: inviteExpiresAt.toISOString(),
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
    inviteToken,
    invitePath: buildInvitePath(inviteToken),
    ...(createdContactId ? { createdContactId } : {}),
  };
}

export async function createDealerPortalInvite(
  actor: AuthenticatedActor,
  portalUserId: string,
): Promise<CreateDealerPortalInviteResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');
  assertActionAccess(actor.role, 'lead.portal_setup');

  const existing = await prisma.dealerPortalUser.findUnique({
    where: { id: portalUserId },
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
      contact: true,
    },
  });

  if (!existing) {
    throw new Error('Dealer portal user not found');
  }
  if (existing.status !== DealerPortalUserStatus.ACTIVE || !existing.user.isActive) {
    throw new Error('Only active dealer portal users can receive an invite');
  }

  const inviteToken = createInviteToken();
  const inviteExpiresAt = new Date(Date.now() + DEALER_PORTAL_INVITE_TTL_MS);
  const updated = await prisma.$transaction(async (tx) => {
    const nextUser = await tx.dealerPortalUser.update({
      where: { id: portalUserId },
      data: {
        inviteTokenHash: hashToken(inviteToken),
        inviteIssuedAt: new Date(),
        inviteExpiresAt,
        inviteAcceptedAt: null,
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
        contact: true,
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: DEALER_PORTAL_USER_ENTITY,
        entityId: portalUserId,
        metadata: {
          operation: 'dealer_portal.issue_invite',
          sessionId: actor.sessionId,
          actorRole: actor.role,
          expiresAt: inviteExpiresAt.toISOString(),
        },
      }),
    });

    return nextUser;
  });

  return {
    user: toDealerPortalUserSummary(updated as DealerPortalAccountRecord['dealerPortalUsers'][number]),
    inviteToken,
    invitePath: buildInvitePath(inviteToken),
    expiresAt: inviteExpiresAt.toISOString(),
  };
}

export async function acceptDealerPortalInvite(
  input: AcceptDealerPortalInviteRequest,
): Promise<AcceptDealerPortalInviteResponse> {
  const token = input.token?.trim();
  const password = input.password?.trim();
  if (!token) {
    throw new Error('Invite token is required');
  }
  if (!password || password.length < 10) {
    throw new Error('Password must be at least 10 characters long');
  }

  const portalUser = await prisma.dealerPortalUser.findUnique({
    where: {
      inviteTokenHash: hashToken(token),
    },
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

  if (!portalUser || portalUser.status !== DealerPortalUserStatus.ACTIVE || !portalUser.user.isActive) {
    throw new Error('Dealer invite link is invalid or has expired');
  }
  if (portalUser.inviteAcceptedAt || !portalUser.inviteExpiresAt || portalUser.inviteExpiresAt.getTime() <= Date.now()) {
    throw new Error('Dealer invite link is invalid or has expired');
  }

  const localIdentity = portalUser.user.identities[0];
  if (!localIdentity) {
    throw new Error('Dealer portal user does not have a local password identity');
  }

  const acceptedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.userIdentity.update({
      where: { id: localIdentity.id },
      data: {
        passwordHash: hashSecret(password),
      },
    });

    await tx.dealerPortalUser.update({
      where: { id: portalUser.id },
      data: {
        inviteAcceptedAt: acceptedAt,
        inviteTokenHash: null,
      },
    });

    await tx.session.updateMany({
      where: {
        userId: portalUser.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: acceptedAt,
        revokedReason: 'dealer-portal-invite-accepted',
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: portalUser.userId,
        action: AuditAction.UPDATE,
        entityType: DEALER_PORTAL_USER_ENTITY,
        entityId: portalUser.id,
        metadata: {
          operation: 'dealer_portal.accept_invite',
        },
      }),
    });
  });

  return {
    email: portalUser.user.email,
    acceptedAt: acceptedAt.toISOString(),
  };
}

export async function createCurrentDealerPortalUser(
  actor: AuthenticatedActor,
  input: DealerPortalSelfCreateUserRequest,
): Promise<DealerPortalSelfCreateUserResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');
  const currentPortalUser = await loadActiveDealerPortalUser(actor);
  assertDealerPortalSelfAdmin(currentPortalUser.accessRole);

  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  const email = normalizeEmail(input.email);
  const title = input.title?.trim();
  const notes = input.notes?.trim();
  const accessRole = toDealerPortalAccessRoleEnum(input.accessRole);
  if (!firstName || !lastName) {
    throw new Error('First and last name are required');
  }
  if (!email) {
    throw new Error('Email is required');
  }
  if (accessRole === DealerPortalAccessRole.ADMIN) {
    throw new AuthorizationError('Dealer admins cannot create additional admin users from the portal');
  }

  const account = await prisma.account.findUnique({
    where: { id: currentPortalUser.accountId },
    include: {
      contacts: true,
      dealerPortalUsers: {
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      },
    },
  });

  if (!account || !account.isActive) {
    throw new Error('Dealer account is not active');
  }

  const existingMembership = account.dealerPortalUsers.find((entry) => entry.user.email.toLowerCase() === email);
  if (existingMembership) {
    throw new Error('A portal user already exists for this email');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    throw new Error('A Pulse user already exists for this email');
  }

  const inviteToken = createInviteToken();
  const inviteExpiresAt = new Date(Date.now() + DEALER_PORTAL_INVITE_TTL_MS);
  const temporaryPassword = createTemporaryPassword();
  const passwordHash = hashSecret(temporaryPassword);
  const displayName = `${firstName} ${lastName}`.trim();
  let createdPortalUserId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const contact = await tx.contact.create({
      data: {
        accountId: account.id,
        firstName,
        lastName,
        ...(title ? { title } : {}),
        email,
        isPrimary: false,
        isActive: true,
      },
      select: { id: true },
    });

    const user = await tx.user.create({
      data: {
        email,
        displayName,
        roleCode: normalizeRole('DEALER_PORTAL_USER'),
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
      select: { id: true },
    });

    const portalUser = await tx.dealerPortalUser.create({
      data: {
        accountId: account.id,
        contactId: contact.id,
        userId: user.id,
        createdByUserId: actor.userId,
        status: DealerPortalUserStatus.ACTIVE,
        accessRole,
        isPrimaryOwner: false,
        inviteTokenHash: hashToken(inviteToken),
        inviteIssuedAt: new Date(),
        inviteExpiresAt,
        activatedAt: new Date(),
        ...(notes ? { notes } : {}),
      },
      select: { id: true },
    });
    createdPortalUserId = portalUser.id;

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: DEALER_PORTAL_USER_ENTITY,
        entityId: portalUser.id,
        metadata: {
          operation: 'dealer_portal.self_admin_create_user',
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
          accountId: account.id,
        },
        afterData: {
          accountId: account.id,
          userId: user.id,
          email,
          accessRole: toDealerPortalAccessRoleKey(accessRole),
          inviteExpiresAt: inviteExpiresAt.toISOString(),
        },
      }),
    });
  });

  const dashboard = await getCurrentDealerPortalDashboard(actor);
  const createdUser = dashboard.companyUsers.find((user) => user.id === createdPortalUserId);
  if (!createdUser) {
    throw new Error('Created dealer portal user could not be loaded');
  }

  return {
    dashboard,
    user: createdUser,
    inviteToken,
    invitePath: buildInvitePath(inviteToken),
    expiresAt: inviteExpiresAt.toISOString(),
  };
}

export async function updateCurrentDealerPortalUser(
  actor: AuthenticatedActor,
  portalUserId: string,
  input: DealerPortalSelfUpdateUserRequest,
): Promise<DealerPortalSelfUpdateUserResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');
  const currentPortalUser = await loadActiveDealerPortalUser(actor);
  assertDealerPortalSelfAdmin(currentPortalUser.accessRole);

  const normalizedPortalUserId = portalUserId.trim();
  if (!normalizedPortalUserId) {
    throw new Error('Dealer portal user id is required');
  }
  if (normalizedPortalUserId === currentPortalUser.id) {
    throw new AuthorizationError('Dealer admins cannot deactivate their own portal access');
  }

  const nextStatus = toDealerPortalUserStatusEnum(input.status);
  if (nextStatus === DealerPortalUserStatus.SUSPENDED) {
    throw new AuthorizationError('Dealer admins can activate or deactivate users only');
  }

  const existing = await prisma.dealerPortalUser.findFirst({
    where: {
      id: normalizedPortalUserId,
      accountId: currentPortalUser.accountId,
    },
    include: {
      user: true,
    },
  });
  if (!existing) {
    throw new Error('Dealer portal user not found for this account');
  }
  if (existing.isPrimaryOwner) {
    throw new AuthorizationError('Primary owner access must be managed by Dynamic AQS');
  }
  if (existing.accessRole === DealerPortalAccessRole.ADMIN) {
    throw new AuthorizationError('Admin access must be managed by Dynamic AQS');
  }

  const notes = input.notes?.trim();
  const changedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.dealerPortalUser.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        suspendedAt: null,
        deactivatedAt: nextStatus === DealerPortalUserStatus.DEACTIVATED ? changedAt : null,
        activatedAt: nextStatus === DealerPortalUserStatus.ACTIVE ? changedAt : existing.activatedAt,
        ...(notes !== undefined ? { notes: notes || null } : {}),
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
          revokedAt: changedAt,
          revokedReason: 'dealer-portal-self-admin-deactivated',
        },
      });
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: DEALER_PORTAL_USER_ENTITY,
        entityId: existing.id,
        metadata: {
          operation: 'dealer_portal.self_admin_update_user',
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
          accountId: currentPortalUser.accountId,
        },
        beforeData: {
          status: toDealerPortalUserStatusKey(existing.status),
          isActive: existing.user.isActive,
        },
        afterData: {
          status: toDealerPortalUserStatusKey(nextStatus),
          isActive: nextStatus === DealerPortalUserStatus.ACTIVE,
        },
      }),
    });
  });

  const dashboard = await getCurrentDealerPortalDashboard(actor);
  const updatedUser = dashboard.companyUsers.find((user) => user.id === existing.id);
  if (!updatedUser) {
    throw new Error('Updated dealer portal user could not be loaded');
  }

  return {
    dashboard,
    user: updatedUser,
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
    ...buildDealerPortalDashboardContext(portalUser.account),
  };
}

export async function getCurrentDealerPortalCatalog(
  actor: AuthenticatedActor,
): Promise<DealerPortalCatalogResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');

  const portalUser = await loadActiveDealerPortalUser(actor);
  const { catalog } = await buildDealerPortalCatalogForAccount(portalUser.account, {
    dealerPortalUserId: portalUser.id,
  });

  return catalog;
}

async function buildDealerPortalCatalogForAccount(
  account: Parameters<typeof resolveCatalogViewForAccount>[0],
  options: {
    dealerPortalUserId?: string;
    includeDiagnostics?: boolean;
    selectedPreviewRole?: DealerPortalAccessRoleKey;
  } = {},
): Promise<{
  catalog: DealerPortalCatalogResponse;
  diagnostics: DealerPortalCatalogDiagnostics;
}> {
  const catalogResolution = await resolveCatalogViewForAccount(account);
  const catalogView = catalogResolution.catalogView;
  const selectedPreviewRole = options.selectedPreviewRole ?? 'viewer';

  if (!catalogView) {
    const warnings = [catalogResolution.reviewReason ?? 'No published catalog view is assigned to this dealer account yet.'];
    return {
      catalog: {
        products: [],
        userFavorites: {
          count: 0,
          presentationIds: [],
        },
        warnings,
      },
      diagnostics: buildDealerPortalVisibilityDiagnostics({
        catalogView: null,
        catalogResolution,
        membershipContext: buildDealerPortalMembershipContext(account),
        products: [],
        selectedPreviewRole,
      }),
    };
  }

  const now = new Date();
  const activeSnapshot = await prisma.dealerCatalogSnapshot.findFirst({
    where: { dealerCatalogViewId: catalogView.id, isActive: true },
    include: { items: { orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }] } },
    orderBy: [{ version: 'desc' }],
  });
  const snapshotItemsByPresentationId = new Map((activeSnapshot?.items ?? []).map((item) => [item.presentationId, item]));
  const snapshotPresentationIds = activeSnapshot?.items.map((item) => item.presentationId) ?? [];
  const presentations = await prisma.productPresentation.findMany({
    where: {
      ...(activeSnapshot ? { id: { in: snapshotPresentationIds } } : {}),
      publishStatus: ProductPublishStatus.PUBLISHED,
      readyForDealerPortal: true,
      baseProduct: {
        lifecycleStatus: ProductLifecycleStatus.ACTIVE,
        isSellable: true,
        isDealerVisible: true,
      },
      ...(activeSnapshot ? {} : {
        inclusions: {
          some: {
            dealerCatalogViewId: catalogView.id,
            isVisible: true,
            publishStatus: ProductPublishStatus.PUBLISHED,
            OR: [
              { effectiveFrom: null },
              { effectiveFrom: { lte: now } },
            ],
            AND: [
              {
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gte: now } },
                ],
              },
            ],
          },
        },
      }),
    },
    include: {
      baseProduct: {
        include: {
          category: true,
          family: true,
        },
      },
      assetAssignments: {
        include: {
          asset: {
            include: {
              versions: {
                where: { isCurrent: true },
                take: 1,
              },
            },
          },
          assetVersion: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: [{ displayName: 'asc' }],
  });
  if (activeSnapshot) {
    presentations.sort((left, right) => (snapshotItemsByPresentationId.get(left.id)?.sortOrder ?? 9999) - (snapshotItemsByPresentationId.get(right.id)?.sortOrder ?? 9999));
  }

  const presentationIds = presentations.map((presentation) => presentation.id);
  const [userFavoriteRows, favoriteCounts] = presentationIds.length > 0
    ? await Promise.all([
        options.dealerPortalUserId
          ? prisma.dealerPortalFavoriteProduct.findMany({
              where: {
                dealerPortalUserId: options.dealerPortalUserId,
                productPresentationId: {
                  in: presentationIds,
                },
              },
              select: {
                productPresentationId: true,
              },
            })
          : Promise.resolve([]),
        options.dealerPortalUserId
          ? prisma.dealerPortalFavoriteProduct.groupBy({
              by: ['productPresentationId'],
              where: {
                productPresentationId: {
                  in: presentationIds,
                },
              },
              _count: {
                _all: true,
              },
            })
          : Promise.resolve([]),
      ])
    : [[], []];
  const userFavoritePresentationIds = new Set(userFavoriteRows.map((favorite) => favorite.productPresentationId));
  const favoriteCountsByPresentationId = new Map(
    favoriteCounts.map((favorite) => [favorite.productPresentationId, favorite._count._all]),
  );

  const products = presentations.map((presentation: any) => {
    const snapshotItem = snapshotItemsByPresentationId.get(presentation.id);
    const snapshotAssetIds = new Set(readSnapshotAssetPayload(snapshotItem).map((asset) => asset.assetId));
    const assets = presentation.assetAssignments
      .filter((assignment: any) => isDealerVisibleAsset(assignment, catalogView))
      .filter((assignment: any) => !activeSnapshot || snapshotAssetIds.has(assignment.assetId))
      .map((assignment: any) => {
        const version = assignment.assetVersion ?? assignment.asset.versions?.[0] ?? null;
        const delivery = resolveDealerPortalAssetDelivery(assignment);
        return compact({
          id: assignment.assetId,
          title: assignment.asset.title,
          role: lower(assignment.role),
          kind: lower(assignment.asset.kind),
          visibility: lower(assignment.asset.visibility),
          stableSlug: assignment.asset.stableSlug,
          fileName: version?.fileName ?? assignment.asset.legacyFileName ?? undefined,
          downloadUrl: delivery.downloadUrl,
          deliverySource: delivery.deliverySource,
          brandScope: assignment.asset.brandScope ?? undefined,
          regionScope: assignment.asset.regionScope ?? undefined,
        });
      });

    return compact({
      productId: presentation.baseProductId,
      presentationId: presentation.id,
      sku: snapshotItem?.sku ?? presentation.baseProduct.sku,
      displayName: snapshotItem?.displayName ?? presentation.displayName,
      shortDescription: presentation.shortDescription ?? undefined,
      longDescription: presentation.longDescription ?? undefined,
      specSummary: presentation.specSummary ?? undefined,
      categoryName: presentation.baseProduct.category?.name ?? undefined,
      familyName: presentation.baseProduct.family?.name ?? undefined,
      brandLabel: presentation.brandLabel ?? undefined,
      regionScope: presentation.regionScope ?? undefined,
      isFavorite: userFavoritePresentationIds.has(presentation.id),
      favoriteCount: favoriteCountsByPresentationId.get(presentation.id) ?? 0,
      assets,
    });
  });
  const diagnostics = buildDealerPortalVisibilityDiagnostics({
    catalogView,
    catalogResolution,
    membershipContext: buildDealerPortalMembershipContext(account),
    products,
    selectedPreviewRole,
  });
  const catalog: DealerPortalCatalogResponse = {
    catalogView: compact({
      id: catalogView.id,
      name: catalogView.name,
      kind: lower(catalogView.kind),
      resolverLabel: catalogView.resolverLabel ?? undefined,
      regionScope: catalogView.regionScope ?? undefined,
      brandLabel: catalogView.brandLabel ?? undefined,
      snapshotId: activeSnapshot?.id,
      snapshotVersion: activeSnapshot?.version,
      snapshotPublishedAt: activeSnapshot?.publishedAt.toISOString(),
    }),
    products,
    userFavorites: {
      count: userFavoriteRows.length,
      presentationIds: userFavoriteRows.map((favorite) => favorite.productPresentationId),
    },
    warnings: options.includeDiagnostics ? diagnostics.warnings : [],
  };

  return {
    catalog,
    diagnostics,
  };
}

function buildDealerPortalVisibilityDiagnostics(input: {
  catalogView: Awaited<ReturnType<typeof resolveCatalogViewForAccount>>['catalogView'];
  catalogResolution: Awaited<ReturnType<typeof resolveCatalogViewForAccount>>;
  membershipContext?: DealerPortalCatalogDiagnostics['membershipContext'];
  products: DealerPortalCatalogResponse['products'];
  selectedPreviewRole: DealerPortalAccessRoleKey;
}): DealerPortalCatalogDiagnostics {
  const visibleFileCount = input.products.reduce((total, product) => total + product.assets.length, 0);
  const productsWithoutDealerSafeFiles = input.products.filter((product) => product.assets.length === 0);
  const warnings: string[] = [];

  if (!input.catalogView) {
    warnings.push(input.catalogResolution.reviewReason ?? 'No published catalog view is assigned to this dealer account yet.');
  }
  if (input.catalogView && input.products.length === 0) {
    warnings.push('No visible products matched this dealer catalog view.');
  }
  if (productsWithoutDealerSafeFiles.length > 0) {
    warnings.push(`${productsWithoutDealerSafeFiles.length} visible product${productsWithoutDealerSafeFiles.length === 1 ? '' : 's'} do not have dealer-safe files matched.`);
  }

  const catalogView = input.catalogView
    ? compact({
        id: input.catalogView.id,
        name: input.catalogView.name,
        kind: lower(input.catalogView.kind),
        resolverLabel: input.catalogView.resolverLabel ?? undefined,
        regionScope: input.catalogView.regionScope ?? undefined,
        brandLabel: input.catalogView.brandLabel ?? undefined,
        resolutionSource: input.catalogResolution.source,
        ruleId: input.catalogResolution.ruleId,
        ruleName: input.catalogResolution.ruleName,
      })
    : undefined;

  return {
    catalogResolution: compact({
      source: input.catalogResolution.source,
      ruleId: input.catalogResolution.ruleId,
      ruleName: input.catalogResolution.ruleName,
      reviewReason: input.catalogResolution.reviewReason,
    }),
    ...(input.membershipContext ? { membershipContext: input.membershipContext } : {}),
    ...(catalogView ? { catalogView } : {}),
    selectedPreviewRole: input.selectedPreviewRole,
    visibleProductCount: input.products.length,
    visibleFileCount,
    warnings,
    productReasons: input.products.map((product) => ({
      productId: product.productId,
      presentationId: product.presentationId,
      sku: product.sku,
      displayName: product.displayName,
      dealerSafeFileCount: product.assets.length,
      reasons: [
        'Published presentation',
        'Dealer-ready presentation',
        'Included in resolved Dealer Catalog View',
        product.assets.length > 0 ? 'Dealer-safe files matched' : 'No dealer-safe files matched',
      ],
      warnings: product.assets.length === 0 ? ['Product is visible, but no dealer-safe files matched this catalog context.'] : [],
    })),
    blockedProductSummary: {
      scanned: false,
      reason: 'Blocked product deep diagnostics were not scanned in this preview to avoid an expensive full catalog scan; use Product Management readiness and catalog rule preview for blocked product detail.',
    },
  };
}

function buildDealerPortalMembershipContext(account: Parameters<typeof resolveCatalogViewForAccount>[0]): DealerPortalCatalogDiagnostics['membershipContext'] {
  const portalStatus = account.sourceLead?.conversionPreparation?.portalEligibilityStatus;
  const affinitySelection = account.affinityGroupSelection;
  const ownershipSelection = account.ownershipGroupSelection;

  return compact({
    affinityGroupSelection: affinitySelection,
    affinityGroupCode: account.affinityGroup?.code,
    affinityGroupName: account.affinityGroup?.name,
    ownershipGroupSelection: ownershipSelection,
    ownershipGroupCode: account.ownershipGroup?.code,
    ownershipGroupName: account.ownershipGroup?.name,
    groupClassification: account.groupClassification ?? undefined,
    regionCode: account.territory?.region?.code,
    regionName: account.territory?.region?.name,
    portalEligible: portalStatus === PortalEligibilityStatus.READY || portalStatus === PortalEligibilityStatus.PROVISIONED,
    independent: account.groupClassification === 'INDEPENDENT' || (affinitySelection === 'NONE' && ownershipSelection === 'NONE'),
  });
}

export async function favoriteCurrentDealerPortalProduct(
  actor: AuthenticatedActor,
  presentationId: string,
): Promise<DealerPortalFavoriteProductResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');

  const context = await loadVisibleDealerCatalogPresentation(actor, presentationId);
  assertDealerPortalCanManageFavorites(context.portalUser.accessRole);

  await prisma.dealerPortalFavoriteProduct.upsert({
    where: {
      dealerPortalUserId_productPresentationId: {
        dealerPortalUserId: context.portalUser.id,
        productPresentationId: context.presentation.id,
      },
    },
    create: {
      dealerPortalUserId: context.portalUser.id,
      accountId: context.portalUser.accountId,
      userId: context.portalUser.userId,
      productPresentationId: context.presentation.id,
      baseProductId: context.presentation.baseProductId,
    },
    update: {},
  });

  return buildFavoriteProductResponse(context.presentation.id, true);
}

export async function unfavoriteCurrentDealerPortalProduct(
  actor: AuthenticatedActor,
  presentationId: string,
): Promise<DealerPortalFavoriteProductResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');

  const context = await loadVisibleDealerCatalogPresentation(actor, presentationId);
  assertDealerPortalCanManageFavorites(context.portalUser.accessRole);

  await prisma.dealerPortalFavoriteProduct.deleteMany({
    where: {
      dealerPortalUserId: context.portalUser.id,
      productPresentationId: context.presentation.id,
    },
  });

  return buildFavoriteProductResponse(context.presentation.id, false);
}

export async function recordCurrentDealerPortalAssetOpen(
  actor: AuthenticatedActor,
  assetId: string,
): Promise<DealerPortalAssetOpenResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');

  const context = await loadVisibleDealerCatalogAsset(actor, assetId);
  const version = context.assignment.assetVersion ?? context.assignment.asset.versions?.[0] ?? null;
  const delivery = resolveDealerPortalAssetDelivery(context.assignment);
  const targetUrl = delivery.targetUrl;
  const downloadUrl = delivery.downloadUrl;

  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.EXPORT,
      entityType: DEALER_PORTAL_CATALOG_ASSET_ENTITY,
      entityId: context.assignment.assetId,
      metadata: {
        operation: 'dealer_portal.asset_open',
        sessionId: actor.sessionId,
        actorRole: actor.role,
        accountId: context.portalUser.accountId,
        dealerPortalUserId: context.portalUser.id,
        dealerPortalAccessRole: lower(context.portalUser.accessRole),
        catalogViewId: context.catalogView.id,
        catalogViewName: context.catalogView.name,
        catalogViewKind: lower(context.catalogView.kind),
        presentationId: context.assignment.presentationId,
        assetVersionId: version?.id ?? null,
        assetVisibility: lower(context.assignment.asset.visibility),
        assetReviewStatus: lower(context.assignment.asset.reviewStatus),
        visibilitySource: buildAssetVisibilitySource(context.assignment, context.catalogView),
        deliverySource: delivery.deliverySource,
        deliveryOutcome: targetUrl ? 'url_opened' : 'missing_delivery_url',
      },
      afterData: {
        assetId: context.assignment.assetId,
        title: context.assignment.asset.title,
        stableSlug: context.assignment.asset.stableSlug,
        targetUrl: targetUrl ?? null,
        downloadUrl: downloadUrl ?? null,
        deliverySource: delivery.deliverySource,
      },
    }),
  });

  const response: DealerPortalAssetOpenResponse = {
    ok: true,
    assetId: context.assignment.assetId,
    presentationId: context.assignment.presentationId,
  };
  if (targetUrl) {
    response.targetUrl = targetUrl;
  }
  if (downloadUrl) {
    response.downloadUrl = downloadUrl;
  }

  return response;
}

// --- Dealer self-service ordering (cart + order submission) ---
// A dealer order IS an OrderDraft (source = DEALER_SELF_SERVICE, account = the dealer's own
// account, createdBy = the dealer user). The persistent cart is the single DRAFT-status draft
// for that user; submit is the DRAFT -> SUBMITTED transition so it flows into the existing
// back-office /orders triage queue. No price is shown or stored; payment/shipping/tax/delivery
// date/Acumatica placement are parked. We do the OrderDraft writes here (rather than calling the
// internal orders service, which hard-asserts internal order.* actions on the platform role).

const DEALER_PORTAL_ORDER_ENTITY = 'ORDER_DRAFT';
const DEALER_PORTAL_MAX_CART_LINES = 200;
const DEALER_PORTAL_MAX_LINE_QUANTITY = 1_000_000;

const DEALER_PORTAL_ORDER_INCLUDE = {
  lines: { orderBy: { position: 'asc' } },
} satisfies Prisma.OrderDraftInclude;

type DealerPortalOrderRecord = Prisma.OrderDraftGetPayload<{
  include: typeof DEALER_PORTAL_ORDER_INCLUDE;
}>;
type DealerPortalOrderLineRecord = DealerPortalOrderRecord['lines'][number];

export async function getCurrentDealerPortalCart(
  actor: AuthenticatedActor,
): Promise<DealerPortalCartResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');
  assertActionAccess(actor.role, 'dealer.order_view');

  const portalUser = await loadActiveDealerPortalUser(actor);
  const cart = await findOrCreateDealerPortalCart(actor, portalUser.accountId);
  return toDealerPortalCart(cart);
}

export async function addCurrentDealerPortalCartItem(
  actor: AuthenticatedActor,
  body: AddDealerPortalCartItemRequest,
): Promise<DealerPortalCartResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');
  assertActionAccess(actor.role, 'dealer.order_create');

  // Resolve the presentation against the dealer's LIVE visible catalog. This both enforces the
  // in-account access gate (ADMIN/PURCHASING only) and rejects any presentation that is not
  // visible/sellable for this dealer — never trust the client-supplied presentation/product id.
  const context = await loadVisibleDealerCatalogPresentation(actor, body.presentationId);
  assertDealerPortalCanManageOrders(context.portalUser.accessRole);

  const quantity = clampDealerPortalQuantity(body.quantity);
  const lineNote = optionalDealerPortalText(body.lineNote);
  const baseProductId = context.presentation.baseProductId;
  const sku = context.presentation.baseProduct.sku;
  const productName = context.presentation.displayName ?? context.presentation.baseProduct.productName;
  const unitOfMeasure = context.presentation.baseProduct.uom ?? undefined;

  const cart = await findOrCreateDealerPortalCart(actor, context.portalUser.accountId);
  if (cart.lines.length >= DEALER_PORTAL_MAX_CART_LINES) {
    const existing = cart.lines.find((line) => line.baseProductId === baseProductId);
    if (!existing) {
      throw new Error(`A dealer cart cannot exceed ${DEALER_PORTAL_MAX_CART_LINES} lines`);
    }
  }

  await prisma.$transaction(async (tx) => {
    // Merge onto the existing line for the same product so add-to-cart is idempotent per product.
    const existing = cart.lines.find((line) => line.baseProductId === baseProductId);
    if (existing) {
      await tx.orderDraftLine.update({
        where: { id: existing.id },
        data: {
          quantity: clampDealerPortalQuantity(existing.quantity + quantity),
          ...(lineNote !== undefined ? { lineNote } : {}),
        },
      });
    } else {
      // Position from a fresh in-transaction count, not the stale pre-transaction
      // cart.lines.length, so concurrent adds can't assign duplicate positions.
      const lineCountInTx = await tx.orderDraftLine.count({ where: { orderDraftId: cart.id } });
      await tx.orderDraftLine.create({
        data: {
          orderDraft: { connect: { id: cart.id } },
          baseProduct: { connect: { id: baseProductId } },
          productName,
          quantity,
          position: lineCountInTx,
          sku,
          ...(unitOfMeasure ? { unitOfMeasure } : {}),
          ...(lineNote ? { lineNote } : {}),
        },
      });
    }

    await recomputeDealerPortalCartCounts(tx, cart.id);
  });

  const next = await loadDealerPortalCartById(cart.id);
  return toDealerPortalCart(next);
}

export async function updateCurrentDealerPortalCartItem(
  actor: AuthenticatedActor,
  lineId: string,
  body: UpdateDealerPortalCartItemRequest,
): Promise<DealerPortalCartResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');
  assertActionAccess(actor.role, 'dealer.order_create');

  const portalUser = await loadActiveDealerPortalUser(actor);
  assertDealerPortalCanManageOrders(portalUser.accessRole);

  const cart = await findOrCreateDealerPortalCart(actor, portalUser.accountId);
  const line = cart.lines.find((entry) => entry.id === lineId.trim());
  if (!line) {
    throw new Error('Cart line not found');
  }

  const data: Prisma.OrderDraftLineUpdateInput = {};
  if (body.quantity !== undefined) {
    data.quantity = clampDealerPortalQuantity(body.quantity);
  }
  if (body.lineNote !== undefined) {
    data.lineNote = normalizeDealerPortalNullableText(body.lineNote);
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.orderDraftLine.update({ where: { id: line.id }, data });
    }
    await recomputeDealerPortalCartCounts(tx, cart.id);
  });

  const next = await loadDealerPortalCartById(cart.id);
  return toDealerPortalCart(next);
}

export async function removeCurrentDealerPortalCartItem(
  actor: AuthenticatedActor,
  lineId: string,
): Promise<DealerPortalCartResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');
  assertActionAccess(actor.role, 'dealer.order_create');

  const portalUser = await loadActiveDealerPortalUser(actor);
  assertDealerPortalCanManageOrders(portalUser.accessRole);

  const cart = await findOrCreateDealerPortalCart(actor, portalUser.accountId);
  const line = cart.lines.find((entry) => entry.id === lineId.trim());
  if (!line) {
    throw new Error('Cart line not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderDraftLine.delete({ where: { id: line.id } });
    // Re-pack positions from the lines that ACTUALLY remain (re-queried in-transaction, not
    // the stale pre-transaction snapshot) so they stay 0-based contiguous under concurrency.
    const remaining = await tx.orderDraftLine.findMany({
      where: { orderDraftId: cart.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, position: true },
    });
    await Promise.all(
      remaining.map((entry, index) =>
        entry.position === index
          ? Promise.resolve(null)
          : tx.orderDraftLine.update({ where: { id: entry.id }, data: { position: index } }),
      ),
    );
    await recomputeDealerPortalCartCounts(tx, cart.id);
  });

  const next = await loadDealerPortalCartById(cart.id);
  return toDealerPortalCart(next);
}

export async function submitCurrentDealerPortalOrder(
  actor: AuthenticatedActor,
  body: SubmitDealerPortalOrderRequest,
): Promise<DealerPortalOrderDetail> {
  assertModuleAccess(actor.role, 'dealer_portal');
  assertActionAccess(actor.role, 'dealer.order_submit');

  const portalUser = await loadActiveDealerPortalUser(actor);
  assertDealerPortalCanManageOrders(portalUser.accessRole);

  const poNumber = body.poNumber?.trim();
  if (!poNumber) {
    throw new Error('A purchase order (PO) number is required to submit a dealer order');
  }

  const cart = await findOrCreateDealerPortalCart(actor, portalUser.accountId);
  if (cart.lineCount < 1 || cart.lines.length < 1) {
    throw new Error('Add at least one product to your cart before submitting an order');
  }

  // Ship-to (when supplied) must belong to the dealer's OWN account — derived from the portal
  // user, never from client input.
  const shipToLocationId = optionalDealerPortalText(body.shipToLocationId);
  if (shipToLocationId) {
    await assertDealerPortalShipToBelongsToAccount(portalUser.accountId, shipToLocationId);
  }

  // CREDIT-HOLD SEAM (parked): there is no Pulse-side credit-hold field today — only
  // Account.financeAuthorityMode, which is not a real-time credit signal. Once an
  // Acumatica-synced credit-hold flag exists, the block would go HERE (throw before the
  // transition). For now submit always proceeds. Do NOT fabricate a credit-hold block.

  const notes = optionalDealerPortalText(body.notes);

  const submitted = await prisma.$transaction(async (tx) => {
    // Atomic DRAFT -> SUBMITTED guard: only advance if the row is still the DRAFT cart, so a
    // double-submit (e.g. double click) cannot double-fire submittedAt/submittedBy. source stays
    // DEALER_SELF_SERVICE so it lands in the back-office triage queue.
    const result = await tx.orderDraft.updateMany({
      // lineCount >= 1 is part of the atomic guard: if a concurrent remove drained the cart
      // between the pre-check and here, this matches nothing and we throw instead of
      // submitting an empty order.
      where: { id: cart.id, status: OrderDraftStatus.DRAFT, source: OrderSource.DEALER_SELF_SERVICE, lineCount: { gte: 1 } },
      data: {
        status: OrderDraftStatus.SUBMITTED,
        submittedAt: new Date(),
        submittedByUserId: actor.userId,
        customerPoNumber: poNumber,
        ...(shipToLocationId ? { shipToLocationId } : { shipToLocationId: null }),
        ...(notes !== undefined ? { notes } : {}),
      },
    });
    if (result.count === 0) {
      throw new Error('This order was already submitted; reload your cart and try again');
    }

    const draft = await tx.orderDraft.findUniqueOrThrow({
      where: { id: cart.id },
      include: DEALER_PORTAL_ORDER_INCLUDE,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: DEALER_PORTAL_ORDER_ENTITY,
        entityId: draft.id,
        metadata: {
          operation: 'dealer_portal.submit_order',
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
          accountId: portalUser.accountId,
          dealerPortalUserId: portalUser.id,
          transition: 'submit',
          source: toOrderSourceKey(draft.source),
        },
        beforeData: { status: toOrderDraftStatusKey(cart.status) },
        afterData: {
          status: toOrderDraftStatusKey(draft.status),
          customerPoNumber: draft.customerPoNumber,
          shipToLocationId: draft.shipToLocationId,
          lineCount: draft.lineCount,
        },
      }),
    });

    return draft;
  });

  return toDealerPortalOrder(submitted);
}

export async function getCurrentDealerPortalOrders(
  actor: AuthenticatedActor,
): Promise<DealerPortalOrdersResponse> {
  assertModuleAccess(actor.role, 'dealer_portal');
  assertActionAccess(actor.role, 'dealer.order_view');

  const portalUser = await loadActiveDealerPortalUser(actor);

  const where: Prisma.OrderDraftWhereInput = {
    accountId: portalUser.accountId,
    source: OrderSource.DEALER_SELF_SERVICE,
    status: { not: OrderDraftStatus.DRAFT },
  };

  const [items, total] = await Promise.all([
    prisma.orderDraft.findMany({
      where,
      orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
      include: DEALER_PORTAL_ORDER_INCLUDE,
    }),
    prisma.orderDraft.count({ where }),
  ]);

  return {
    items: items.map((order) => toDealerPortalOrderSummary(order)),
    total,
  };
}

export async function getCurrentDealerPortalOrder(
  actor: AuthenticatedActor,
  orderId: string,
): Promise<DealerPortalOrderDetail | null> {
  assertModuleAccess(actor.role, 'dealer_portal');
  assertActionAccess(actor.role, 'dealer.order_view');

  const portalUser = await loadActiveDealerPortalUser(actor);

  const order = await prisma.orderDraft.findFirst({
    where: {
      id: orderId.trim(),
      accountId: portalUser.accountId,
      source: OrderSource.DEALER_SELF_SERVICE,
      status: { not: OrderDraftStatus.DRAFT },
    },
    include: DEALER_PORTAL_ORDER_INCLUDE,
  });

  return order ? toDealerPortalOrder(order) : null;
}

async function findOrCreateDealerPortalCart(
  actor: AuthenticatedActor,
  accountId: string,
): Promise<DealerPortalOrderRecord> {
  // Serializable so a concurrent first-add (two requests when no DRAFT cart exists yet)
  // cannot both pass the find then both create — Postgres SSI aborts the loser, preserving
  // the one-DRAFT-cart-per-dealer-user invariant (no DB-level partial-unique needed). Once a
  // cart exists this is a single read with no write, so there is nothing to conflict on.
  return prisma.$transaction(async (tx) => {
    const existing = await tx.orderDraft.findFirst({
      where: {
        accountId,
        createdByUserId: actor.userId,
        source: OrderSource.DEALER_SELF_SERVICE,
        status: OrderDraftStatus.DRAFT,
      },
      orderBy: [{ updatedAt: 'desc' }],
      include: DEALER_PORTAL_ORDER_INCLUDE,
    });
    if (existing) {
      return existing;
    }

    return tx.orderDraft.create({
      data: {
        account: { connect: { id: accountId } },
        createdBy: { connect: { id: actor.userId } },
        source: OrderSource.DEALER_SELF_SERVICE,
        status: OrderDraftStatus.DRAFT,
      },
      include: DEALER_PORTAL_ORDER_INCLUDE,
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function loadDealerPortalCartById(cartId: string): Promise<DealerPortalOrderRecord> {
  return prisma.orderDraft.findUniqueOrThrow({
    where: { id: cartId },
    include: DEALER_PORTAL_ORDER_INCLUDE,
  });
}

async function recomputeDealerPortalCartCounts(tx: Prisma.TransactionClient, cartId: string) {
  const lines = await tx.orderDraftLine.findMany({
    where: { orderDraftId: cartId },
    select: { id: true },
  });
  await tx.orderDraft.update({
    where: { id: cartId },
    data: { lineCount: lines.length, subtotalCents: 0, pricingEstimated: false },
  });
}

async function assertDealerPortalShipToBelongsToAccount(accountId: string, shipToLocationId: string) {
  const location = await prisma.accountLocation.findFirst({
    where: { id: shipToLocationId, accountId },
    select: { id: true },
  });
  if (!location) {
    throw new Error('Ship-to location does not belong to this dealer account');
  }
}

// Dealer self-service ordering is a write capability: mirror favorites' ADMIN/PURCHASING gate.
function assertDealerPortalCanManageOrders(accessRole: DealerPortalAccessRole) {
  if (accessRole === DealerPortalAccessRole.ADMIN || accessRole === DealerPortalAccessRole.PURCHASING) {
    return;
  }

  throw new AuthorizationError('This dealer portal role cannot place orders');
}

function clampDealerPortalQuantity(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  const truncated = Math.trunc(value);
  return Math.min(Math.max(truncated, 1), DEALER_PORTAL_MAX_LINE_QUANTITY);
}

function optionalDealerPortalText(value?: string | null): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeDealerPortalNullableText(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toDealerPortalCartLine(line: DealerPortalOrderLineRecord): DealerPortalCartLine {
  const mapped: DealerPortalCartLine = {
    id: line.id,
    productName: line.productName,
    quantity: line.quantity,
    position: line.position,
  };
  if (line.baseProductId) {
    mapped.baseProductId = line.baseProductId;
  }
  if (line.sku) {
    mapped.sku = line.sku;
  }
  if (line.unitOfMeasure) {
    mapped.unitOfMeasure = line.unitOfMeasure;
  }
  if (line.lineNote) {
    mapped.lineNote = line.lineNote;
  }
  return mapped;
}

function toDealerPortalCart(cart: DealerPortalOrderRecord): DealerPortalCartResponse {
  const lines = cart.lines.map(toDealerPortalCartLine);
  const response: DealerPortalCartResponse = {
    lines,
    lineCount: lines.length,
    totalUnits: lines.reduce((total, line) => total + line.quantity, 0),
    updatedAt: cart.updatedAt.toISOString(),
  };
  if (cart.shipToLocationId) {
    response.shipToLocationId = cart.shipToLocationId;
  }
  if (cart.customerPoNumber) {
    response.customerPoNumber = cart.customerPoNumber;
  }
  if (cart.notes) {
    response.notes = cart.notes;
  }
  return response;
}

function toDealerPortalOrderSummary(order: DealerPortalOrderRecord): DealerPortalOrderSummary {
  const summary: DealerPortalOrderSummary = {
    id: order.id,
    status: toOrderDraftStatusKey(order.status),
    lineCount: order.lineCount,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
  if (order.customerPoNumber) {
    summary.customerPoNumber = order.customerPoNumber;
  }
  if (order.shipToLocationId) {
    summary.shipToLocationId = order.shipToLocationId;
  }
  if (order.submittedAt) {
    summary.submittedAt = order.submittedAt.toISOString();
  }
  if (order.fulfilledAt) {
    summary.fulfilledAt = order.fulfilledAt.toISOString();
  }
  if (order.cancelledAt) {
    summary.cancelledAt = order.cancelledAt.toISOString();
  }
  return summary;
}

function toDealerPortalOrder(order: DealerPortalOrderRecord): DealerPortalOrderDetail {
  const detail: DealerPortalOrderDetail = {
    ...toDealerPortalOrderSummary(order),
    lines: order.lines.map(toDealerPortalCartLine),
  };
  if (order.notes) {
    detail.notes = order.notes;
  }
  return detail;
}

function toOrderDraftStatusKey(value: OrderDraftStatus): OrderDraftStatusKey {
  switch (value) {
    case OrderDraftStatus.DRAFT:
      return 'draft';
    case OrderDraftStatus.SUBMITTED:
      return 'submitted';
    case OrderDraftStatus.FULFILLED:
      return 'fulfilled';
    case OrderDraftStatus.CANCELLED:
      return 'cancelled';
  }
}

function toOrderSourceKey(value: OrderSource): string {
  switch (value) {
    case OrderSource.INTERNAL_ON_BEHALF:
      return 'internal_on_behalf';
    case OrderSource.DEALER_SELF_SERVICE:
      return 'dealer_self_service';
  }
}

function resolveDealerPortalAssetDelivery(assignment: any): {
  targetUrl?: string;
  downloadUrl?: string;
  deliverySource: DealerPortalAssetDeliverySource;
} {
  const version = assignment.assetVersion ?? assignment.asset?.versions?.[0] ?? null;
  const legacyUrl = cleanDeliveryUrl(assignment.asset?.legacyUrl);
  if (legacyUrl) {
    return {
      targetUrl: legacyUrl,
      downloadUrl: legacyUrl,
      deliverySource: 'legacy_url',
    };
  }

  const externalUrl = cleanDeliveryUrl(version?.externalUrl);
  if (externalUrl) {
    return {
      targetUrl: externalUrl,
      downloadUrl: externalUrl,
      deliverySource: 'external_url',
    };
  }

  const managedStorageUrl = buildPublicAssetUrl(loadAppConfig(), version?.storageKey);
  if (managedStorageUrl) {
    return {
      targetUrl: managedStorageUrl,
      downloadUrl: managedStorageUrl,
      deliverySource: 'cloudfront_storage_key',
    };
  }

  return {
    deliverySource: 'missing_delivery_url',
  };
}

function cleanDeliveryUrl(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function buildDealerPortalDashboardContext(account: DealerPortalAccountRecord) {
  const detail = toDealerPortalAccountDetail(account);
  return {
    companyUsers: detail.users,
    contacts: account.contacts.map((contact) => ({
      id: contact.id,
      displayName: `${contact.firstName} ${contact.lastName}`.trim(),
      ...(contact.title ? { title: contact.title } : {}),
      ...(contact.email ? { email: contact.email } : {}),
      ...(contact.phone ? { phone: contact.phone } : {}),
      isPrimary: contact.isPrimary,
    })),
    locations: account.locations.map((location) => ({
      id: location.id,
      name: location.name ?? location.locationCode ?? 'Location',
      ...(location.city ? { city: location.city } : {}),
      ...(location.state ? { state: location.state } : {}),
      ...(location.countryCode ? { countryCode: location.countryCode } : {}),
      isPrimary: location.isPrimary,
    })),
  };
}

async function loadActiveDealerPortalUser(actor: AuthenticatedActor) {
  const portalUser = await prisma.dealerPortalUser.findFirst({
    where: {
      userId: actor.userId,
      status: DealerPortalUserStatus.ACTIVE,
      user: {
        isActive: true,
      },
    },
    include: {
      account: {
        include: {
          affinityGroup: true,
          ownershipGroup: true,
          territory: {
            include: {
              region: true,
            },
          },
          sourceLead: {
            select: {
              conversionPreparation: {
                select: {
                  portalEligibilityStatus: true,
                },
              },
            },
          },
          dealerPortalAccount: {
            select: {
              status: true,
            },
          },
        },
      },
    },
  });

  if (!portalUser) {
    throw new Error('Dealer portal user is not linked to an active dealer account');
  }

  return portalUser;
}

async function loadVisibleDealerCatalogPresentation(
  actor: AuthenticatedActor,
  presentationId: string,
) {
  const normalizedPresentationId = presentationId.trim();
  if (!normalizedPresentationId) {
    throw new Error('Product presentation id is required');
  }

  const portalUser = await loadActiveDealerPortalUser(actor);
  const { catalogView } = await resolveCatalogViewForAccount(portalUser.account);
  if (!catalogView) {
    throw new Error('No published catalog view is assigned to this dealer account yet');
  }

  const activeSnapshot = await loadActiveDealerCatalogSnapshot(catalogView.id);
  const snapshotItem = activeSnapshot?.items.find((item) => item.presentationId === normalizedPresentationId);
  if (activeSnapshot && !snapshotItem) {
    throw new Error('Product presentation is not visible in the active dealer catalog snapshot');
  }

  const presentation = await prisma.productPresentation.findFirst({
    where: {
      id: normalizedPresentationId,
      ...visibleDealerCatalogPresentationWhere(catalogView.id),
    },
    include: {
      baseProduct: true,
    },
  });

  if (!presentation) {
    throw new Error('Product presentation is not visible in the current dealer catalog');
  }

  return {
    portalUser,
    catalogView,
    presentation,
  };
}

async function loadVisibleDealerCatalogAsset(
  actor: AuthenticatedActor,
  assetId: string,
) {
  const normalizedAssetId = assetId.trim();
  if (!normalizedAssetId) {
    throw new Error('Asset id is required');
  }

  const portalUser = await loadActiveDealerPortalUser(actor);
  const { catalogView } = await resolveCatalogViewForAccount(portalUser.account);
  if (!catalogView) {
    throw new Error('No published catalog view is assigned to this dealer account yet');
  }

  const activeSnapshot = await loadActiveDealerCatalogSnapshot(catalogView.id);
  const snapshotAssetIds = new Set(
    (activeSnapshot?.items ?? []).flatMap((item) => readSnapshotAssetPayload(item).map((asset) => asset.assetId)),
  );
  if (activeSnapshot && !snapshotAssetIds.has(normalizedAssetId)) {
    throw new Error('Asset is not visible in the active dealer catalog snapshot');
  }

  const assignments = await prisma.productAssetAssignment.findMany({
    where: {
      assetId: normalizedAssetId,
      presentation: visibleDealerCatalogPresentationWhere(catalogView.id),
    },
    include: {
      presentation: {
        include: {
          baseProduct: true,
        },
      },
      asset: {
        include: {
          versions: {
            where: { isCurrent: true },
            take: 1,
          },
        },
      },
      assetVersion: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const assignment = assignments.find((entry: any) => isDealerVisibleAsset(entry, catalogView));

  if (!assignment) {
    throw new Error('Asset is not visible in the current dealer catalog');
  }

  return {
    portalUser,
    catalogView,
    assignment,
  };
}

async function loadActiveDealerCatalogSnapshot(dealerCatalogViewId: string) {
  return prisma.dealerCatalogSnapshot.findFirst({
    where: { dealerCatalogViewId, isActive: true },
    include: { items: true },
    orderBy: [{ version: 'desc' }],
  });
}

function assertDealerPortalCanManageFavorites(accessRole: DealerPortalAccessRole) {
  if (accessRole === DealerPortalAccessRole.ADMIN || accessRole === DealerPortalAccessRole.PURCHASING) {
    return;
  }

  throw new AuthorizationError('This dealer portal role cannot save catalog favorites');
}

// Authoritative gate for dealer self-service user management (POST/PATCH /me/users). The
// admin-vs-regular distinction is the per-user DealerPortalAccessRole, not the platform role —
// every dealer is DEALER_PORTAL_USER — so this cannot be expressed as a role-keyed
// WORKSPACE_ACTIONS grant (that would apply to all dealer users). This per-user check, paired with
// the module guard and the no-dealer-creates-admin rule, is the correct enforcement for this model.
function assertDealerPortalSelfAdmin(accessRole: DealerPortalAccessRole) {
  if (accessRole === DealerPortalAccessRole.ADMIN) {
    return;
  }

  throw new AuthorizationError('Only dealer portal admins can manage company portal users');
}

function visibleDealerCatalogPresentationWhere(catalogViewId: string): Prisma.ProductPresentationWhereInput {
  const now = new Date();
  return {
    publishStatus: ProductPublishStatus.PUBLISHED,
    readyForDealerPortal: true,
    baseProduct: {
      lifecycleStatus: ProductLifecycleStatus.ACTIVE,
      isSellable: true,
      isDealerVisible: true,
    },
    inclusions: {
      some: {
        dealerCatalogViewId: catalogViewId,
        isVisible: true,
        publishStatus: ProductPublishStatus.PUBLISHED,
        OR: [
          { effectiveFrom: null },
          { effectiveFrom: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: now } },
            ],
          },
        ],
      },
    },
  };
}

async function buildFavoriteProductResponse(
  presentationId: string,
  isFavorite: boolean,
): Promise<DealerPortalFavoriteProductResponse> {
  const favoriteCount = await prisma.dealerPortalFavoriteProduct.count({
    where: {
      productPresentationId: presentationId,
    },
  });

  return {
    ok: true,
    presentationId,
    isFavorite,
    favoriteCount,
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
    accessRole: toDealerPortalAccessRoleKey(portalUser.accessRole),
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
  if (portalUser.inviteIssuedAt) {
    summary.inviteIssuedAt = portalUser.inviteIssuedAt.toISOString();
  }
  if (portalUser.inviteExpiresAt) {
    summary.inviteExpiresAt = portalUser.inviteExpiresAt.toISOString();
  }
  if (portalUser.inviteAcceptedAt) {
    summary.inviteAcceptedAt = portalUser.inviteAcceptedAt.toISOString();
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

function createInviteToken() {
  return randomBytes(32).toString('base64url');
}

function buildInvitePath(token: string) {
  return `/dealer/accept-invite?token=${encodeURIComponent(token)}`;
}

function hashSecret(secret: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(secret, salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
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

function toDealerPortalAccessRoleEnum(accessRole: DealerPortalAccessRoleKey) {
  switch (accessRole) {
    case 'admin':
      return DealerPortalAccessRole.ADMIN;
    case 'purchasing':
      return DealerPortalAccessRole.PURCHASING;
    case 'accounting':
      return DealerPortalAccessRole.ACCOUNTING;
    case 'viewer':
      return DealerPortalAccessRole.VIEWER;
  }
}

function toDealerPortalAccessRoleKey(accessRole: DealerPortalAccessRole): DealerPortalAccessRoleKey {
  return lower(accessRole) as DealerPortalAccessRoleKey;
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

async function resolveCatalogViewForAccount(account: {
  affinityGroup?: { code: string; name: string } | null;
  ownershipGroup?: { code: string; name: string } | null;
  affinityGroupSelection: string;
  ownershipGroupSelection: string;
  groupClassification?: string | null;
  territory?: { region?: { code: string; name: string } | null } | null;
  sourceLead?: { conversionPreparation?: { portalEligibilityStatus: PortalEligibilityStatus } | null } | null;
  dealerPortalAccount?: { status: DealerPortalProvisioningStatus } | null;
}) {
  const ruleSet = await prisma.catalogRuleSet.findFirst({
    where: {
      status: CatalogRuleSetStatus.ACTIVE,
      isActive: true,
    },
    include: {
      rules: {
        where: {
          isEnabled: true,
        },
        include: {
          dealerCatalogView: true,
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: [{ activatedAt: 'desc' }, { updatedAt: 'desc' }],
  });

  const matchedRule = ruleSet?.rules.find((rule: any) =>
    normalizeConditionArray(rule.conditions).every((condition) => doesAccountMatchCondition(account, condition)),
  );

  if (matchedRule?.resultAction === CatalogRuleResultAction.REQUIRE_REVIEW) {
    return {
      catalogView: null,
      source: 'review' as const,
      ruleId: matchedRule.id,
      ruleName: matchedRule.name,
      reviewReason: matchedRule.requireReviewReason ?? 'This dealer account needs catalog review before products and files are shown.',
    };
  }

  if (matchedRule?.dealerCatalogView?.isActive) {
    return {
      catalogView: matchedRule.dealerCatalogView,
      source: 'rule' as const,
      ruleId: matchedRule.id,
      ruleName: matchedRule.name,
    };
  }

  const defaultCatalogView = await prisma.dealerCatalogView.findFirst({
    where: {
      isDefault: true,
      isActive: true,
    },
    orderBy: [{ precedence: 'asc' }, { name: 'asc' }],
  });

  return {
    catalogView: defaultCatalogView,
    source: defaultCatalogView ? 'default' as const : 'none' as const,
  };
}

function assertInternalActor(actor: AuthenticatedActor) {
  if (actor.actorType !== 'internal') {
    throw new AuthorizationError('Dealer portal internal preview is only available to internal staff');
  }
}

function normalizeConditionArray(value: unknown): CatalogRuleConditionInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is CatalogRuleConditionInput =>
    typeof entry === 'object'
    && entry !== null
    && 'field' in entry
    && 'operator' in entry,
  );
}

function doesAccountMatchCondition(
  account: Parameters<typeof resolveCatalogViewForAccount>[0],
  condition: CatalogRuleConditionInput,
) {
  if (condition.field === 'brand_label') return false;
  const rawValue = readAccountConditionValue(account, condition.field);
  const expected = condition.value;
  if (condition.operator === 'is_empty') return rawValue === '' || rawValue === false;
  if (condition.operator === 'is_not_empty') return rawValue !== '' && rawValue !== false;
  if (condition.operator === 'is_any') return true;
  if (condition.operator === 'is_not') return String(rawValue).toLowerCase() !== String(expected ?? '').toLowerCase();
  return String(rawValue).toLowerCase() === String(expected ?? '').toLowerCase();
}

function readAccountConditionValue(
  account: Parameters<typeof resolveCatalogViewForAccount>[0],
  field: CatalogRuleConditionInput['field'],
) {
  if (field === 'affinity_group') return account.affinityGroup?.code ?? account.affinityGroup?.name ?? '';
  if (field === 'ownership_group') return account.ownershipGroup?.code ?? account.ownershipGroup?.name ?? '';
  if (field === 'independent') return account.groupClassification === 'INDEPENDENT' || (account.affinityGroupSelection === 'NONE' && account.ownershipGroupSelection === 'NONE');
  if (field === 'region') return account.territory?.region?.code ?? account.territory?.region?.name ?? '';
  if (field === 'portal_eligible') {
    const status = account.sourceLead?.conversionPreparation?.portalEligibilityStatus;
    const persistedStatus = account.dealerPortalAccount?.status;
    return status === PortalEligibilityStatus.READY
      || status === PortalEligibilityStatus.PROVISIONED
      || persistedStatus === DealerPortalProvisioningStatus.ACTIVE
      || persistedStatus === DealerPortalProvisioningStatus.READY_TO_PROVISION;
  }
  return '';
}

function isDealerVisibleAsset(assignment: any, catalogView: { kind?: DealerCatalogViewKind | null; resolverKey?: string | null; brandLabel?: string | null; regionScope?: string | null }) {
  const asset = assignment.asset;
  if (!asset || asset.status !== DigitalAssetStatus.ACTIVE) {
    return false;
  }

  if (asset.visibility !== DigitalAssetVisibility.DEALER_PORTAL && asset.visibility !== DigitalAssetVisibility.PUBLIC) {
    return false;
  }

  if (asset.reviewStatus !== DigitalAssetReviewStatus.APPROVED && asset.reviewStatus !== DigitalAssetReviewStatus.NOT_REQUIRED) {
    return false;
  }

  if (asset.brandScope && catalogView.brandLabel && asset.brandScope !== catalogView.brandLabel) {
    return false;
  }

  if (asset.regionScope && catalogView.regionScope && asset.regionScope !== catalogView.regionScope) {
    return false;
  }

  if (assignment.brandLabel && assignment.brandLabel !== catalogView.brandLabel) {
    return false;
  }

  if (assignment.regionScope && assignment.regionScope !== catalogView.regionScope) {
    return false;
  }

  if (!doesAssignmentMatchCatalogView(assignment, catalogView)) {
    return false;
  }

  return true;
}

function doesAssignmentMatchCatalogView(
  assignment: { dealerGroupType?: string | null; dealerGroupId?: string | null },
  catalogView: { kind?: DealerCatalogViewKind | null; resolverKey?: string | null },
) {
  const type = assignment.dealerGroupType?.trim().toLowerCase();
  const id = assignment.dealerGroupId?.trim().toLowerCase();
  if (!type || type === 'all_dealers' || type === 'standard') return true;
  const expectedKind = dealerCatalogViewKindFromLegacyType(type);
  if (catalogView.kind && expectedKind !== catalogView.kind) return false;
  if (id && (catalogView.resolverKey ?? '').trim().toLowerCase() !== id) return false;
  return true;
}

function dealerCatalogViewKindFromLegacyType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'affinity_group') return DealerCatalogViewKind.AFFINITY;
  if (normalized === 'ownership_group') return DealerCatalogViewKind.OWNERSHIP;
  if (normalized === 'independent') return DealerCatalogViewKind.INDEPENDENT;
  if (normalized === 'region') return DealerCatalogViewKind.REGION;
  if (normalized === 'brand') return DealerCatalogViewKind.BRAND;
  if (normalized === 'private_label') return DealerCatalogViewKind.PRIVATE_LABEL;
  if (normalized === 'account_override') return DealerCatalogViewKind.ACCOUNT_OVERRIDE;
  return DealerCatalogViewKind.STANDARD;
}

function buildAssetVisibilitySource(
  assignment: {
    role?: string | null;
    dealerGroupType?: string | null;
    dealerGroupId?: string | null;
    brandLabel?: string | null;
    regionScope?: string | null;
    asset: {
      visibility: DigitalAssetVisibility;
      brandScope?: string | null;
      regionScope?: string | null;
    };
  },
  catalogView: { id: string; brandLabel?: string | null; regionScope?: string | null },
) {
  return compact({
    source: 'dealer_catalog_view_assignment',
    catalogViewId: catalogView.id,
    assetVisibility: lower(assignment.asset.visibility),
    assignmentRole: assignment.role ?? undefined,
    assignmentDealerGroupType: assignment.dealerGroupType ?? undefined,
    assignmentDealerGroupId: assignment.dealerGroupId ?? undefined,
    assignmentBrandLabel: assignment.brandLabel ?? undefined,
    assignmentRegionScope: assignment.regionScope ?? undefined,
    assetBrandScope: assignment.asset.brandScope ?? undefined,
    assetRegionScope: assignment.asset.regionScope ?? undefined,
    catalogBrandLabel: catalogView.brandLabel ?? undefined,
    catalogRegionScope: catalogView.regionScope ?? undefined,
  });
}

function readSnapshotAssetPayload(snapshotItem: { assetVersionPayload?: unknown } | undefined) {
  if (!snapshotItem || !Array.isArray(snapshotItem.assetVersionPayload)) {
    return [];
  }
  return snapshotItem.assetVersionPayload.filter((item): item is { assetId: string } => {
    return typeof item === 'object' && item !== null && typeof (item as { assetId?: unknown }).assetId === 'string';
  });
}

function lower(value: string) {
  return value.toLowerCase();
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as {
    [K in keyof T as undefined extends T[K] ? K : K]: Exclude<T[K], undefined>;
  };
}
