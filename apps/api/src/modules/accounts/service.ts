import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import { AccountLifecycleStatus, AuditAction, CisPaymentVaultProvider, Prisma, TerritoryAssignmentMethod, prisma } from '@pulse/db';
import type {
  AccountDetail,
  AccountActivityReviewEvent,
  AccountActivityReviewSummary,
  AccountDocumentBoundary,
  AccountReadinessCheck,
  AccountReadinessSummary,
  AccountLifecycleStatusKey,
  AccountLocationSummary,
  AccountPaymentMethodSummary,
  AccountSummary,
  ContactSummary,
  CreateAccountPaymentMethodRequest,
  CreateAccountRequest,
  CreateAccountLocationRequest,
  CreateContactRequest,
  ListAccountPaymentMethodsResponse,
  ListAccountsRequest,
  ListAccountsResponse,
  UpdateAccountPaymentMethodRequest,
  UpdateAccountLifecycleRequest,
  UpdateAccountLocationRequest,
  UpdateAccountRequest,
  UpdateContactRequest,
} from '@pulse/contracts/accounts';
import type { CisPaymentVaultProviderKey } from '@pulse/contracts/cis';
import type { AuthenticatedActor } from '../auth/types.js';
import { buildAccountRecordScope } from '../auth/visibility.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import {
  deriveGroupClassification,
  resolveAffinityGroupAxis,
  resolveOwnershipGroupAxis,
  toGroupAxisSelectionKey,
  toGroupClassificationKey,
} from '../reference/group-classification.js';
import { syncAccountTerritoryAssignment } from '../territories/service.js';

const ACCOUNT_ENTITY_TYPE = 'ACCOUNT';
const LOCATION_ENTITY_TYPE = 'ACCOUNT_LOCATION';
const CONTACT_ENTITY_TYPE = 'CONTACT';
const ACCOUNT_PAYMENT_METHOD_ENTITY_TYPE = 'ACCOUNT_PAYMENT_METHOD';

const ACCOUNT_SUMMARY_INCLUDE = {
  affinityGroup: true,
  ownershipGroup: true,
  territory: {
    include: {
      region: true,
    },
  },
  shippingCenter: true,
  assignedTmUser: {
    select: {
      id: true,
      displayName: true,
    },
  },
  assignedRdUser: {
    select: {
      id: true,
      displayName: true,
    },
  },
  _count: {
    select: {
      contacts: true,
      locations: true,
      consignmentSites: true,
    },
  },
} satisfies Prisma.AccountInclude;

export async function listAccounts(actor: AuthenticatedActor, query: ListAccountsRequest = {}): Promise<ListAccountsResponse> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'customer.view');

  const limit = normalizeLimit(query.limit);
  const search = query.search?.trim();
  const includeInactive = query.includeInactive ?? false;
  const lifecycleStatus = query.lifecycleStatus ? toAccountLifecycleStatusEnum(query.lifecycleStatus) : undefined;
  const scopeWhere = buildAccountRecordScope(actor);

  const where: Prisma.AccountWhereInput = {};
  if (!includeInactive) {
    where.isActive = true;
  }
  if (lifecycleStatus) {
    where.lifecycleStatus = lifecycleStatus;
  }
  if (search) {
    where.OR = [
      { displayName: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { legalName: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { accountNumber: { contains: search, mode: Prisma.QueryMode.insensitive } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.account.findMany({
      where: scopeWhere ? { AND: [scopeWhere, where] } : where,
      orderBy: [
        { displayName: 'asc' },
        { createdAt: 'asc' },
      ],
      take: limit,
      include: ACCOUNT_SUMMARY_INCLUDE,
    }),
    prisma.account.count({ where: scopeWhere ? { AND: [scopeWhere, where] } : where }),
  ]);

  return {
    items: items.map((account) => toAccountSummary(account)),
    total,
  };
}

export async function createAccount(actor: AuthenticatedActor, input: CreateAccountRequest): Promise<AccountSummary> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'customer.create');

  if (actor.role !== 'SUPER_ADMIN') {
    throw new Error('Direct customer creation is reserved for bootstrap or migration workflows. Convert from lead on first order instead.');
  }

  const displayName = input.displayName?.trim();
  if (!displayName) {
    throw new Error('displayName is required');
  }

  const legalName = optionalTrimmed(input.legalName);
  const accountType = optionalTrimmed(input.accountType);
  const isActive = input.isActive ?? true;
  const lifecycleStatus = isActive ? AccountLifecycleStatus.ACTIVE : AccountLifecycleStatus.INACTIVE;

  const account = await prisma.$transaction(async (tx) => {
    const classification = await resolveAccountClassificationInput(tx, input);
    const created = await tx.account.create({
      data: {
        displayName,
        ...(legalName !== undefined ? { legalName } : {}),
        ...(accountType !== undefined ? { accountType } : {}),
        affinityGroupSelection: classification.affinity.selection,
        ownershipGroupSelection: classification.ownership.selection,
        ...(classification.affinity.id ? { affinityGroupId: classification.affinity.id } : {}),
        ...(classification.ownership.id ? { ownershipGroupId: classification.ownership.id } : {}),
        ...(classification.groupClassification ? { groupClassification: classification.groupClassification } : {}),
        lifecycleStatus,
        lifecycleStatusChangedAt: new Date(),
        isActive,
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: ACCOUNT_ENTITY_TYPE,
        entityId: created.id,
        metadata: {
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
        },
        afterData: {
          displayName: created.displayName,
          legalName: created.legalName,
          accountType: created.accountType,
          lifecycleStatus: created.lifecycleStatus,
          isActive: created.isActive,
        },
      }),
    });
    return {
      ...created,
      _count: {
        contacts: 0,
        locations: 0,
      },
    };
  });

  return toAccountSummary(account);
}

export async function updateAccount(
  actor: AuthenticatedActor,
  accountId: string,
  input: UpdateAccountRequest,
): Promise<AccountSummary> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'customer.edit');

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: ACCOUNT_SUMMARY_INCLUDE,
  });

  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  const data: Prisma.AccountUpdateInput = {};

  if (input.displayName !== undefined) {
    const displayName = input.displayName.trim();
    if (!displayName) {
      throw new Error('displayName cannot be empty');
    }
    data.displayName = displayName;
  }

  if (input.legalName !== undefined) {
    data.legalName = normalizeNullableText(input.legalName);
  }

  if (input.accountType !== undefined) {
    data.accountType = normalizeNullableText(input.accountType);
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  const isAffinityInputPresent = input.affinityGroupSelection !== undefined || input.affinityGroupId !== undefined || input.affinityGroupCode !== undefined || input.affinityGroupName !== undefined;
  const isOwnershipInputPresent = input.ownershipGroupSelection !== undefined || input.ownershipGroupId !== undefined || input.ownershipGroupCode !== undefined || input.ownershipGroupName !== undefined;
  const affinityGroupSelection = input.affinityGroupSelection ?? toGroupAxisSelectionKey(account.affinityGroupSelection);
  const ownershipGroupSelection = input.ownershipGroupSelection ?? toGroupAxisSelectionKey(account.ownershipGroupSelection);
  const nextAffinityAllowsGroupRef = affinityGroupSelection === 'group';
  const nextOwnershipAllowsGroupRef = ownershipGroupSelection === 'group';
  const affinityGroupId = nextAffinityAllowsGroupRef
    ? (input.affinityGroupId !== undefined ? input.affinityGroupId : account.affinityGroupId)
    : undefined;
  const affinityGroupCode = nextAffinityAllowsGroupRef ? input.affinityGroupCode ?? account.affinityGroup?.code : undefined;
  const affinityGroupName = nextAffinityAllowsGroupRef ? input.affinityGroupName ?? account.affinityGroup?.name : undefined;
  const ownershipGroupId = nextOwnershipAllowsGroupRef
    ? (input.ownershipGroupId !== undefined ? input.ownershipGroupId : account.ownershipGroupId)
    : undefined;
  const ownershipGroupCode = nextOwnershipAllowsGroupRef ? input.ownershipGroupCode ?? account.ownershipGroup?.code : undefined;
  const ownershipGroupName = nextOwnershipAllowsGroupRef ? input.ownershipGroupName ?? account.ownershipGroup?.name : undefined;
  const classification = isAffinityInputPresent || isOwnershipInputPresent
    ? await resolveAccountClassificationInput(prisma, {
        affinityGroupSelection,
        ...(affinityGroupId !== undefined ? { affinityGroupId } : {}),
        ...(affinityGroupCode ? { affinityGroupCode } : {}),
        ...(affinityGroupName ? { affinityGroupName } : {}),
        ownershipGroupSelection,
        ...(ownershipGroupId !== undefined ? { ownershipGroupId } : {}),
        ...(ownershipGroupCode ? { ownershipGroupCode } : {}),
        ...(ownershipGroupName ? { ownershipGroupName } : {}),
      })
    : null;

  if (isAffinityInputPresent && classification) {
    data.affinityGroupSelection = classification.affinity.selection;
    data.affinityGroup = classification.affinity.id ? { connect: { id: classification.affinity.id } } : { disconnect: true };
  }
  if (isOwnershipInputPresent && classification) {
    data.ownershipGroupSelection = classification.ownership.selection;
    data.ownershipGroup = classification.ownership.id ? { connect: { id: classification.ownership.id } } : { disconnect: true };
  }
  if (classification) {
    data.groupClassification = classification.groupClassification;
  }

  if (Object.keys(data).length === 0) {
    return toAccountSummary(account);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.account.update({
      where: { id: accountId },
      data,
      include: ACCOUNT_SUMMARY_INCLUDE,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: ACCOUNT_ENTITY_TYPE,
        entityId: next.id,
        metadata: {
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
        },
        beforeData: {
          displayName: account.displayName,
          legalName: account.legalName,
          accountType: account.accountType,
          lifecycleStatus: account.lifecycleStatus,
          lifecycleReasonNote: account.lifecycleReasonNote,
          isActive: account.isActive,
        },
        afterData: {
          displayName: next.displayName,
          legalName: next.legalName,
          accountType: next.accountType,
          lifecycleStatus: next.lifecycleStatus,
          lifecycleReasonNote: next.lifecycleReasonNote,
          isActive: next.isActive,
        },
      }),
    });

    return next;
  });

  return toAccountSummary(updated);
}

export async function updateAccountLifecycle(
  actor: AuthenticatedActor,
  accountId: string,
  input: UpdateAccountLifecycleRequest,
): Promise<AccountSummary> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'customer.edit');

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      territory: {
        include: {
          region: true,
        },
      },
      shippingCenter: true,
      assignedTmUser: {
        select: {
          id: true,
          displayName: true,
        },
      },
      assignedRdUser: {
        select: {
          id: true,
          displayName: true,
        },
      },
      _count: {
        select: {
          contacts: true,
          locations: true,
        },
      },
    },
  });

  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  const nextLifecycleStatus = toAccountLifecycleStatusEnum(input.lifecycleStatus);
  validateAccountLifecycleTransition(account.lifecycleStatus, nextLifecycleStatus);

  const lifecycleReasonNote = normalizeNullableText(input.lifecycleReasonNote);
  if (nextLifecycleStatus === AccountLifecycleStatus.CHURNED && !lifecycleReasonNote) {
    throw new Error('A lifecycle note is required before an account can be marked as churned');
  }

  const nextIsActive = nextLifecycleStatus === AccountLifecycleStatus.ACTIVE || nextLifecycleStatus === AccountLifecycleStatus.AT_RISK;

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.account.update({
      where: { id: accountId },
      data: {
        lifecycleStatus: nextLifecycleStatus,
        lifecycleStatusChangedAt: new Date(),
        lifecycleReasonNote,
        isActive: nextIsActive,
      },
      include: {
        territory: {
          include: {
            region: true,
          },
        },
        shippingCenter: true,
        assignedTmUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
        assignedRdUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            contacts: true,
            locations: true,
          },
        },
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: ACCOUNT_ENTITY_TYPE,
        entityId: next.id,
        metadata: {
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
          workflow: 'account_lifecycle',
        },
        beforeData: {
          lifecycleStatus: account.lifecycleStatus,
          lifecycleReasonNote: account.lifecycleReasonNote,
          isActive: account.isActive,
        },
        afterData: {
          lifecycleStatus: next.lifecycleStatus,
          lifecycleReasonNote: next.lifecycleReasonNote,
          isActive: next.isActive,
        },
      }),
    });

    return next;
  });

  return toAccountSummary(updated);
}

export async function getAccountDetail(actor: AuthenticatedActor, accountId: string): Promise<AccountDetail | null> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'customer.view');
  const scopeWhere = buildAccountRecordScope(actor);

  const account = await prisma.account.findFirst({
    where: scopeWhere ? { AND: [scopeWhere, { id: accountId }] } : { id: accountId },
    include: {
      affinityGroup: true,
      ownershipGroup: true,
      territory: {
        include: {
          region: true,
        },
      },
      shippingCenter: true,
      assignedTmUser: {
        select: {
          id: true,
          displayName: true,
        },
      },
      assignedRdUser: {
        select: {
          id: true,
          displayName: true,
        },
      },
      locations: {
        orderBy: [
          { isPrimary: 'desc' },
          { createdAt: 'asc' },
        ],
      },
      contacts: {
        orderBy: [
          { isPrimary: 'desc' },
          { createdAt: 'asc' },
        ],
      },
      _count: {
        select: {
          contacts: true,
          locations: true,
        },
      },
    },
  });

  if (!account) {
    return null;
  }

  const activityReview = await buildAccountActivityReview(account);

  return {
    ...toAccountSummary(account),
    locations: account.locations.map(toAccountLocationSummary),
    contacts: account.contacts.map(toContactSummary),
    readiness: buildAccountReadinessSummary(account),
    activityReview,
  };
}

export async function listAccountPaymentMethods(
  actor: AuthenticatedActor,
  accountId: string,
): Promise<ListAccountPaymentMethodsResponse | null> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'customer.financials_view');

  const account = await findScopedAccount(actor, accountId, { id: true });
  if (!account) {
    return null;
  }

  const items = await prisma.accountPaymentVaultReference.findMany({
    where: { accountId },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  return {
    items: items.map(toAccountPaymentMethodSummary),
  };
}

export async function createAccountPaymentMethod(
  actor: AuthenticatedActor,
  accountId: string,
  input: CreateAccountPaymentMethodRequest,
): Promise<AccountPaymentMethodSummary> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'customer.financials_manage');

  const account = await findScopedAccount(actor, accountId, {
    id: true,
    sourceLeadId: true,
  });
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  const billingZip = optionalTrimmed(input.billingZip);
  const status = optionalTrimmed(input.status);
  const externalPaymentMethodRef = optionalTrimmed(input.externalPaymentMethodRef);
  const sourceCisVaultReferenceId = optionalTrimmed(input.sourceCisVaultReferenceId);
  const authorizationCapturedAt = parseOptionalDate(input.authorizationCapturedAt, 'authorizationCapturedAt');

  const paymentMethod = await prisma.$transaction(async (tx) => {
    if (sourceCisVaultReferenceId) {
      const source = await tx.cisPaymentVaultReference.findUnique({
        where: { id: sourceCisVaultReferenceId },
        include: {
          cisPackage: {
            select: {
              id: true,
              leadId: true,
            },
          },
        },
      });

      if (!source) {
        throw new Error('sourceCisVaultReferenceId was not found');
      }

      if (account.sourceLeadId && source.cisPackage.leadId !== account.sourceLeadId) {
        throw new Error('sourceCisVaultReferenceId does not belong to this account source lead');
      }

      const existing = await tx.accountPaymentVaultReference.findFirst({
        where: {
          accountId,
          sourceCisVaultReferenceId,
        },
      });

      const shouldBeDefault = input.isDefault ?? !existingDefaultExists(await tx.accountPaymentVaultReference.findMany({
        where: { accountId, isActive: true },
        select: { id: true, isDefault: true },
      }));

      if (shouldBeDefault) {
        await clearDefaultAccountPaymentMethods(tx, accountId, existing?.id);
      }

      const next = existing
        ? await tx.accountPaymentVaultReference.update({
            where: { id: existing.id },
            data: {
              provider: source.provider,
              vaultToken: source.vaultToken,
              vaultCustomerRef: source.vaultCustomerRef,
              last4: source.last4,
              brand: source.brand,
              ...(externalPaymentMethodRef !== undefined ? { externalPaymentMethodRef } : {}),
              ...(billingZip !== undefined ? { billingZip } : {}),
              ...(authorizationCapturedAt !== undefined ? { authorizationCapturedAt } : {}),
              ...(input.isDefault !== undefined || shouldBeDefault ? { isDefault: shouldBeDefault } : {}),
              ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
              ...(status !== undefined ? { status } : { status: source.status }),
            },
          })
        : await tx.accountPaymentVaultReference.create({
            data: {
              accountId,
              sourceCisVaultReferenceId,
              provider: source.provider,
              vaultToken: source.vaultToken,
              vaultCustomerRef: source.vaultCustomerRef,
              last4: source.last4,
              brand: source.brand,
              ...(externalPaymentMethodRef !== undefined ? { externalPaymentMethodRef } : {}),
              ...(billingZip !== undefined ? { billingZip } : {}),
              ...(authorizationCapturedAt !== undefined ? { authorizationCapturedAt } : {}),
              isDefault: shouldBeDefault,
              isActive: input.isActive ?? true,
              status: status ?? source.status,
            },
          });

      if ((next.isDefault && !next.isActive) || (existing?.isDefault && input.isDefault === false)) {
        await ensureDefaultActiveAccountPaymentMethod(tx, accountId, next.id);
      }

      await tx.auditEntry.create({
        data: buildAuditEntryData({
          actorUserId: actor.userId,
          action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
          entityType: ACCOUNT_PAYMENT_METHOD_ENTITY_TYPE,
          entityId: next.id,
          metadata: {
            sessionId: actor.sessionId,
            actorRole: actor.role,
            actorType: actor.actorType,
            operation: existing ? 'account.payment_method.promote_update' : 'account.payment_method.promote_create',
            source: 'cis_promoted',
            sourceCisVaultReferenceId,
            provider: toCisPaymentVaultProviderKey(next.provider),
          },
          beforeData: existing ? toAccountPaymentMethodAuditPayload(existing) : undefined,
          afterData: toAccountPaymentMethodAuditPayload(next),
        }),
      });

      return next;
    }

    const provider = toCisPaymentVaultProviderEnum(input.provider);
    const vaultToken = optionalTrimmed(input.vaultToken);
    const vaultCustomerRef = optionalTrimmed(input.vaultCustomerRef);
    const last4 = optionalTrimmed(input.last4);
    const brand = optionalTrimmed(input.brand);
    if (!vaultToken && !vaultCustomerRef && !externalPaymentMethodRef) {
      throw new Error('At least one tokenized payment reference is required');
    }

    const activePaymentMethods = await tx.accountPaymentVaultReference.findMany({
      where: { accountId, isActive: true },
      select: { id: true, isDefault: true },
    });
    const shouldBeDefault = input.isDefault ?? !existingDefaultExists(activePaymentMethods);

    if (shouldBeDefault) {
      await clearDefaultAccountPaymentMethods(tx, accountId);
    }

    const created = await tx.accountPaymentVaultReference.create({
      data: {
        accountId,
        provider,
        ...(vaultToken !== undefined ? { vaultToken } : {}),
        ...(vaultCustomerRef !== undefined ? { vaultCustomerRef } : {}),
        ...(externalPaymentMethodRef !== undefined ? { externalPaymentMethodRef } : {}),
        ...(last4 !== undefined ? { last4 } : {}),
        ...(brand !== undefined ? { brand } : {}),
        ...(billingZip !== undefined ? { billingZip } : {}),
        ...(authorizationCapturedAt !== undefined ? { authorizationCapturedAt } : {}),
        isDefault: shouldBeDefault,
        isActive: input.isActive ?? true,
        status: status ?? 'active',
      },
    });

    if (created.isDefault && !created.isActive) {
      await ensureDefaultActiveAccountPaymentMethod(tx, accountId, created.id);
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: ACCOUNT_PAYMENT_METHOD_ENTITY_TYPE,
        entityId: created.id,
        metadata: {
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
          operation: 'account.payment_method.create',
          source: 'manual',
          provider: toCisPaymentVaultProviderKey(created.provider),
        },
        afterData: toAccountPaymentMethodAuditPayload(created),
      }),
    });

    return created;
  });

  return toAccountPaymentMethodSummary(paymentMethod);
}

export async function updateAccountPaymentMethod(
  actor: AuthenticatedActor,
  accountId: string,
  paymentMethodId: string,
  input: UpdateAccountPaymentMethodRequest,
): Promise<AccountPaymentMethodSummary> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'customer.financials_manage');

  const account = await findScopedAccount(actor, accountId, { id: true });
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  const existing = await prisma.accountPaymentVaultReference.findFirst({
    where: {
      id: paymentMethodId,
      accountId,
    },
  });
  if (!existing) {
    throw new Error(`Account payment method not found: ${paymentMethodId}`);
  }

  const data: Prisma.AccountPaymentVaultReferenceUpdateInput = {};
  if (input.billingZip !== undefined) {
    data.billingZip = normalizeNullableText(input.billingZip);
  }
  if (input.isDefault !== undefined) {
    data.isDefault = input.isDefault;
  }
  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }
  if (input.status !== undefined) {
    const status = input.status.trim();
    if (!status) {
      throw new Error('status cannot be empty');
    }
    data.status = status;
  }

  if (Object.keys(data).length === 0) {
    return toAccountPaymentMethodSummary(existing);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      await clearDefaultAccountPaymentMethods(tx, accountId, paymentMethodId);
    }

    const next = await tx.accountPaymentVaultReference.update({
      where: { id: paymentMethodId },
      data,
    });

    if ((existing.isDefault && next.isActive === false) || (existing.isDefault && input.isDefault === false)) {
      await ensureDefaultActiveAccountPaymentMethod(tx, accountId, paymentMethodId);
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: ACCOUNT_PAYMENT_METHOD_ENTITY_TYPE,
        entityId: next.id,
        metadata: {
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
          operation: 'account.payment_method.update',
          provider: toCisPaymentVaultProviderKey(next.provider),
        },
        beforeData: toAccountPaymentMethodAuditPayload(existing),
        afterData: toAccountPaymentMethodAuditPayload(next),
      }),
    });

    return next;
  });

  return toAccountPaymentMethodSummary(updated);
}

export async function listAccountContacts(actor: AuthenticatedActor, accountId: string): Promise<ContactSummary[] | null> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'contact.view');

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true },
  });

  if (!account) {
    return null;
  }

  const contacts = await prisma.contact.findMany({
    where: {
      accountId,
    },
    orderBy: [
      { isPrimary: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  return contacts.map(toContactSummary);
}

export async function listAccountLocations(actor: AuthenticatedActor, accountId: string): Promise<AccountLocationSummary[] | null> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'location.view');

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true },
  });

  if (!account) {
    return null;
  }

  const locations = await prisma.accountLocation.findMany({
    where: {
      accountId,
    },
    orderBy: [
      { isPrimary: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  return locations.map(toAccountLocationSummary);
}

export async function createAccountLocation(
  actor: AuthenticatedActor,
  accountId: string,
  input: CreateAccountLocationRequest,
): Promise<AccountLocationSummary> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'location.create');

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      _count: {
        select: {
          locations: true,
        },
      },
    },
  });
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  const locationCode = optionalTrimmed(input.locationCode);
  const name = optionalTrimmed(input.name);
  const line1 = optionalTrimmed(input.line1);
  const line2 = optionalTrimmed(input.line2);
  const city = optionalTrimmed(input.city);
  const state = optionalTrimmed(input.state);
  const postalCode = optionalTrimmed(input.postalCode);
  const countryCode = optionalTrimmed(input.countryCode)?.toUpperCase();
  const hasIdentity = Boolean(locationCode || name || line1);
  if (!hasIdentity) {
    throw new Error('locationCode, name, or line1 is required');
  }

  const isPrimary = input.isPrimary ?? account._count.locations === 0;
  const isActive = input.isActive ?? true;

  const location = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.accountLocation.updateMany({
        where: {
          accountId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const created = await tx.accountLocation.create({
      data: {
        accountId,
        ...(locationCode !== undefined ? { locationCode } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(line1 !== undefined ? { line1 } : {}),
        ...(line2 !== undefined ? { line2 } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(state !== undefined ? { state } : {}),
        ...(postalCode !== undefined ? { postalCode } : {}),
        ...(countryCode !== undefined ? { countryCode } : {}),
        isPrimary,
        isActive,
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: LOCATION_ENTITY_TYPE,
        entityId: created.id,
        metadata: {
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
        },
        afterData: {
          accountId: created.accountId,
          locationCode: created.locationCode,
          name: created.name,
          city: created.city,
          state: created.state,
          isPrimary: created.isPrimary,
          isActive: created.isActive,
        },
      }),
    });

    await syncAccountTerritoryAssignment(tx, {
      accountId,
      changedByUserId: actor.userId,
      reasonCode: 'location_create',
      reasonNote: 'Account territory assignment was refreshed after a location was created.',
    });

    return created;
  });

  return toAccountLocationSummary(location);
}

export async function updateAccountLocation(
  actor: AuthenticatedActor,
  accountId: string,
  locationId: string,
  input: UpdateAccountLocationRequest,
): Promise<AccountLocationSummary> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'customer.edit');

  const location = await prisma.accountLocation.findFirst({
    where: {
      id: locationId,
      accountId,
    },
  });
  if (!location) {
    throw new Error(`Location not found: ${locationId}`);
  }

  const data: Prisma.AccountLocationUpdateInput = {};

  if (input.locationCode !== undefined) {
    data.locationCode = normalizeNullableText(input.locationCode);
  }
  if (input.name !== undefined) {
    data.name = normalizeNullableText(input.name);
  }
  if (input.line1 !== undefined) {
    data.line1 = normalizeNullableText(input.line1);
  }
  if (input.line2 !== undefined) {
    data.line2 = normalizeNullableText(input.line2);
  }
  if (input.city !== undefined) {
    data.city = normalizeNullableText(input.city);
  }
  if (input.state !== undefined) {
    data.state = normalizeNullableText(input.state);
  }
  if (input.postalCode !== undefined) {
    data.postalCode = normalizeNullableText(input.postalCode);
  }
  if (input.countryCode !== undefined) {
    const countryCode = normalizeNullableText(input.countryCode)?.toUpperCase();
    data.countryCode = countryCode ?? null;
  }
  if (input.isPrimary !== undefined) {
    data.isPrimary = input.isPrimary;
  }
  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  if (Object.keys(data).length === 0) {
    return toAccountLocationSummary(location);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const shouldBecomePrimary = input.isPrimary === true;
    if (shouldBecomePrimary) {
      await tx.accountLocation.updateMany({
        where: {
          accountId,
          isPrimary: true,
          NOT: { id: locationId },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const next = await tx.accountLocation.update({
      where: { id: locationId },
      data,
    });

    if ((location.isPrimary && next.isActive === false) || (location.isPrimary && input.isPrimary === false)) {
      await ensurePrimaryActiveLocation(tx, accountId, locationId);
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: LOCATION_ENTITY_TYPE,
        entityId: next.id,
        metadata: {
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
        },
        beforeData: {
          name: location.name,
          locationCode: location.locationCode,
          city: location.city,
          state: location.state,
          isPrimary: location.isPrimary,
          isActive: location.isActive,
        },
        afterData: {
          name: next.name,
          locationCode: next.locationCode,
          city: next.city,
          state: next.state,
          isPrimary: next.isPrimary,
          isActive: next.isActive,
        },
      }),
    });

    await syncAccountTerritoryAssignment(tx, {
      accountId,
      changedByUserId: actor.userId,
      reasonCode: 'location_update',
      reasonNote: 'Account territory assignment was refreshed after a location changed.',
    });

    return next;
  });

  return toAccountLocationSummary(updated);
}

export async function createAccountContact(
  actor: AuthenticatedActor,
  accountId: string,
  input: CreateContactRequest,
): Promise<ContactSummary> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'contact.create');

  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  if (!firstName || !lastName) {
    throw new Error('firstName and lastName are required');
  }

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      _count: {
        select: {
          contacts: true,
        },
      },
    },
  });
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  const locationId = optionalTrimmed(input.locationId);
  if (locationId) {
    const location = await prisma.accountLocation.findFirst({
      where: {
        id: locationId,
        accountId,
      },
      select: { id: true },
    });
    if (!location) {
      throw new Error('locationId does not belong to this account');
    }
  }

  const isPrimary = input.isPrimary ?? account._count.contacts === 0;
  const isActive = input.isActive ?? true;
  const title = optionalTrimmed(input.title);
  const email = optionalTrimmed(input.email)?.toLowerCase();
  const phone = optionalTrimmed(input.phone);
  const mobilePhone = optionalTrimmed(input.mobilePhone);
  const roleCode = optionalTrimmed(input.roleCode);

  const contact = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.contact.updateMany({
        where: {
          accountId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const created = await tx.contact.create({
      data: {
        accountId,
        firstName,
        lastName,
        ...(locationId !== undefined ? { locationId } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(mobilePhone !== undefined ? { mobilePhone } : {}),
        ...(roleCode !== undefined ? { roleCode } : {}),
        isPrimary,
        isActive,
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: CONTACT_ENTITY_TYPE,
        entityId: created.id,
        metadata: {
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
        },
        afterData: {
          accountId: created.accountId,
          fullName: `${created.firstName} ${created.lastName}`,
          roleCode: created.roleCode,
          isPrimary: created.isPrimary,
          isActive: created.isActive,
        },
      }),
    });

    return created;
  });

  return toContactSummary(contact);
}

export async function updateAccountContact(
  actor: AuthenticatedActor,
  accountId: string,
  contactId: string,
  input: UpdateContactRequest,
): Promise<ContactSummary> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'customer.edit');

  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      accountId,
    },
  });
  if (!contact) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  if (input.locationId !== undefined && input.locationId !== null) {
    const location = await prisma.accountLocation.findFirst({
      where: {
        id: input.locationId,
        accountId,
      },
      select: { id: true },
    });
    if (!location) {
      throw new Error('locationId does not belong to this account');
    }
  }

  const data: Prisma.ContactUpdateInput = {};

  if (input.firstName !== undefined) {
    const firstName = input.firstName.trim();
    if (!firstName) {
      throw new Error('firstName cannot be empty');
    }
    data.firstName = firstName;
  }
  if (input.lastName !== undefined) {
    const lastName = input.lastName.trim();
    if (!lastName) {
      throw new Error('lastName cannot be empty');
    }
    data.lastName = lastName;
  }
  if (input.title !== undefined) {
    data.title = normalizeNullableText(input.title);
  }
  if (input.email !== undefined) {
    const email = normalizeNullableText(input.email)?.toLowerCase();
    data.email = email ?? null;
  }
  if (input.phone !== undefined) {
    data.phone = normalizeNullableText(input.phone);
  }
  if (input.mobilePhone !== undefined) {
    data.mobilePhone = normalizeNullableText(input.mobilePhone);
  }
  if (input.roleCode !== undefined) {
    data.roleCode = normalizeNullableText(input.roleCode);
  }
  if (input.locationId !== undefined) {
    data.location = input.locationId ? { connect: { id: input.locationId } } : { disconnect: true };
  }
  if (input.isPrimary !== undefined) {
    data.isPrimary = input.isPrimary;
  }
  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  if (Object.keys(data).length === 0) {
    return toContactSummary(contact);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.isPrimary === true) {
      await tx.contact.updateMany({
        where: {
          accountId,
          isPrimary: true,
          NOT: { id: contactId },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const next = await tx.contact.update({
      where: { id: contactId },
      data,
    });

    if ((contact.isPrimary && next.isActive === false) || (contact.isPrimary && input.isPrimary === false)) {
      await ensurePrimaryActiveContact(tx, accountId, contactId);
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: CONTACT_ENTITY_TYPE,
        entityId: next.id,
        metadata: {
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
        },
        beforeData: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          roleCode: contact.roleCode,
          isPrimary: contact.isPrimary,
          isActive: contact.isActive,
        },
        afterData: {
          firstName: next.firstName,
          lastName: next.lastName,
          email: next.email,
          roleCode: next.roleCode,
          isPrimary: next.isPrimary,
          isActive: next.isActive,
        },
      }),
    });

    return next;
  });

  return toContactSummary(updated);
}

async function findScopedAccount<TSelect extends Prisma.AccountSelect>(
  actor: AuthenticatedActor,
  accountId: string,
  select: TSelect,
): Promise<Prisma.AccountGetPayload<{ select: TSelect }> | null> {
  const scopeWhere = buildAccountRecordScope(actor);
  return prisma.account.findFirst({
    where: scopeWhere ? { AND: [scopeWhere, { id: accountId }] } : { id: accountId },
    select,
  });
}

async function clearDefaultAccountPaymentMethods(
  tx: Prisma.TransactionClient,
  accountId: string,
  excludeId?: string,
) {
  await tx.accountPaymentVaultReference.updateMany({
    where: {
      accountId,
      isDefault: true,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    data: {
      isDefault: false,
    },
  });
}

async function ensureDefaultActiveAccountPaymentMethod(
  tx: Prisma.TransactionClient,
  accountId: string,
  excludeId?: string,
) {
  const existingDefault = await tx.accountPaymentVaultReference.findFirst({
    where: {
      accountId,
      isDefault: true,
      isActive: true,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

  if (existingDefault) {
    return;
  }

  const fallback = await tx.accountPaymentVaultReference.findFirst({
    where: {
      accountId,
      isActive: true,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    orderBy: [
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
    select: { id: true },
  });

  if (!fallback) {
    return;
  }

  await tx.accountPaymentVaultReference.update({
    where: { id: fallback.id },
    data: { isDefault: true },
  });
}

function existingDefaultExists(items: Array<{ isDefault: boolean }>) {
  return items.some((item) => item.isDefault);
}

function toCisPaymentVaultProviderEnum(value: CisPaymentVaultProviderKey | undefined) {
  switch (value) {
    case 'ebizcharge':
      return CisPaymentVaultProvider.EBIZCHARGE;
    case 'moneris':
      return CisPaymentVaultProvider.MONERIS;
    case 'unknown':
    case undefined:
      return CisPaymentVaultProvider.UNKNOWN;
  }
}

function toCisPaymentVaultProviderKey(value: CisPaymentVaultProvider): CisPaymentVaultProviderKey {
  switch (value) {
    case CisPaymentVaultProvider.EBIZCHARGE:
      return 'ebizcharge';
    case CisPaymentVaultProvider.MONERIS:
      return 'moneris';
    case CisPaymentVaultProvider.UNKNOWN:
      return 'unknown';
  }
}

function toAccountPaymentMethodSummary(paymentMethod: {
  id: string;
  accountId: string;
  provider: CisPaymentVaultProvider;
  sourceCisVaultReferenceId: string | null;
  externalPaymentMethodRef: string | null;
  last4: string | null;
  brand: string | null;
  billingZip: string | null;
  authorizationCapturedAt: Date | null;
  isDefault: boolean;
  isActive: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): AccountPaymentMethodSummary {
  const summary: AccountPaymentMethodSummary = {
    id: paymentMethod.id,
    accountId: paymentMethod.accountId,
    provider: toCisPaymentVaultProviderKey(paymentMethod.provider),
    source: paymentMethod.sourceCisVaultReferenceId ? 'cis_promoted' : 'manual',
    isDefault: paymentMethod.isDefault,
    isActive: paymentMethod.isActive,
    status: paymentMethod.status,
    createdAt: paymentMethod.createdAt.toISOString(),
    updatedAt: paymentMethod.updatedAt.toISOString(),
  };

  if (paymentMethod.sourceCisVaultReferenceId) {
    summary.sourceCisVaultReferenceId = paymentMethod.sourceCisVaultReferenceId;
  }
  if (paymentMethod.externalPaymentMethodRef) {
    summary.externalPaymentMethodRef = paymentMethod.externalPaymentMethodRef;
  }
  if (paymentMethod.last4) {
    summary.last4 = paymentMethod.last4;
  }
  if (paymentMethod.brand) {
    summary.brand = paymentMethod.brand;
  }
  if (paymentMethod.billingZip) {
    summary.billingZip = paymentMethod.billingZip;
  }
  if (paymentMethod.authorizationCapturedAt) {
    summary.authorizationCapturedAt = paymentMethod.authorizationCapturedAt.toISOString();
  }

  return summary;
}

function toAccountPaymentMethodAuditPayload(paymentMethod: {
  accountId: string;
  provider: CisPaymentVaultProvider;
  sourceCisVaultReferenceId?: string | null;
  externalPaymentMethodRef?: string | null;
  last4?: string | null;
  brand?: string | null;
  billingZip?: string | null;
  authorizationCapturedAt?: Date | null;
  isDefault: boolean;
  isActive: boolean;
  status: string;
}) {
  return {
    accountId: paymentMethod.accountId,
    provider: toCisPaymentVaultProviderKey(paymentMethod.provider),
    ...(paymentMethod.sourceCisVaultReferenceId ? { sourceCisVaultReferenceId: paymentMethod.sourceCisVaultReferenceId } : {}),
    ...(paymentMethod.externalPaymentMethodRef ? { externalPaymentMethodRef: paymentMethod.externalPaymentMethodRef } : {}),
    ...(paymentMethod.last4 ? { last4: paymentMethod.last4 } : {}),
    ...(paymentMethod.brand ? { brand: paymentMethod.brand } : {}),
    ...(paymentMethod.billingZip ? { billingZip: paymentMethod.billingZip } : {}),
    ...(paymentMethod.authorizationCapturedAt ? { authorizationCapturedAt: paymentMethod.authorizationCapturedAt.toISOString() } : {}),
    isDefault: paymentMethod.isDefault,
    isActive: paymentMethod.isActive,
    status: paymentMethod.status,
  };
}

function parseOptionalDate(value: string | undefined, fieldName: string) {
  const trimmed = optionalTrimmed(value);
  if (trimmed === undefined) {
    return undefined;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO date`);
  }

  return parsed;
}

function toAccountSummary(account: {
  id: string;
  accountNumber: string | null;
  sourceLeadId?: string | null;
  displayName: string;
  legalName: string | null;
  accountType: string | null;
  affinityGroupSelection: import('@pulse/db').GroupAxisSelection;
  affinityGroupId?: string | null;
  ownershipGroupSelection: import('@pulse/db').GroupAxisSelection;
  ownershipGroupId?: string | null;
  groupClassification?: import('@pulse/db').GroupClassification | null;
  territoryId?: string | null;
  territoryAssignmentMethod?: TerritoryAssignmentMethod | null;
  territoryAssignedAt?: Date | null;
  shippingCenterId?: string | null;
  assignedTmUserId?: string | null;
  assignedRdUserId?: string | null;
  lifecycleStatus: AccountLifecycleStatus;
  lifecycleStatusChangedAt?: Date | null;
  lifecycleReasonNote?: string | null;
  lastOrderAt?: Date | null;
  lastEngagementAt?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  territory?: {
    id: string;
    code: string;
    name: string;
    region: {
      id: string;
      code: string;
      name: string;
    };
  } | null;
  shippingCenter?: {
    id: string;
    code: string;
    name: string;
  } | null;
  assignedTmUser?: {
    id: string;
    displayName: string;
  } | null;
  assignedRdUser?: {
    id: string;
    displayName: string;
  } | null;
  affinityGroup?: {
    id: string;
    code: string;
    name: string;
  } | null;
  ownershipGroup?: {
    id: string;
    code: string;
    name: string;
  } | null;
  _count: {
    contacts: number;
    locations: number;
    consignmentSites?: number;
  };
}): AccountSummary {
  const summary: AccountSummary = {
    id: account.id,
    displayName: account.displayName,
    affinityGroupSelection: toGroupAxisSelectionKey(account.affinityGroupSelection),
    ownershipGroupSelection: toGroupAxisSelectionKey(account.ownershipGroupSelection),
    lifecycleStatus: toAccountLifecycleStatusKey(account.lifecycleStatus),
    isActive: account.isActive,
    contactCount: account._count.contacts,
    locationCount: account._count.locations,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
  if (account._count.consignmentSites !== undefined) {
    summary.consignment = {
      accountId: account.id,
      participatesInConsignment: account._count.consignmentSites > 0,
      activeSiteCount: 0,
      onboardingSiteCount: account._count.consignmentSites,
      exitedSiteCount: 0,
      sites: [],
    };
  }

  if (account.accountNumber) {
    summary.accountNumber = account.accountNumber;
  }
  if (account.sourceLeadId) {
    summary.sourceLeadId = account.sourceLeadId;
  }
  if (account.legalName) {
    summary.legalName = account.legalName;
  }
  if (account.accountType) {
    summary.accountType = account.accountType;
  }
  if (account.affinityGroup?.id) {
    summary.affinityGroupId = account.affinityGroup.id;
    summary.affinityGroupCode = account.affinityGroup.code;
    summary.affinityGroupName = account.affinityGroup.name;
  } else if (account.affinityGroupId) {
    summary.affinityGroupId = account.affinityGroupId;
  }
  if (account.ownershipGroup?.id) {
    summary.ownershipGroupId = account.ownershipGroup.id;
    summary.ownershipGroupCode = account.ownershipGroup.code;
    summary.ownershipGroupName = account.ownershipGroup.name;
  } else if (account.ownershipGroupId) {
    summary.ownershipGroupId = account.ownershipGroupId;
  }
  if (account.groupClassification) {
    summary.groupClassification = toGroupClassificationKey(account.groupClassification);
  }
  if (account.territory?.id) {
    summary.territoryId = account.territory.id;
    summary.territoryCode = account.territory.code;
    summary.territoryName = account.territory.name;
    summary.regionId = account.territory.region.id;
    summary.regionCode = account.territory.region.code;
    summary.regionName = account.territory.region.name;
  } else if (account.territoryId) {
    summary.territoryId = account.territoryId;
  }
  if (account.shippingCenter?.id) {
    summary.shippingCenterId = account.shippingCenter.id;
    summary.shippingCenterCode = account.shippingCenter.code;
    summary.shippingCenterName = account.shippingCenter.name;
  } else if (account.shippingCenterId) {
    summary.shippingCenterId = account.shippingCenterId;
  }
  if (account.assignedTmUser?.id) {
    summary.assignedTmUserId = account.assignedTmUser.id;
    summary.assignedTmName = account.assignedTmUser.displayName;
  } else if (account.assignedTmUserId) {
    summary.assignedTmUserId = account.assignedTmUserId;
  }
  if (account.assignedRdUser?.id) {
    summary.assignedRdUserId = account.assignedRdUser.id;
    summary.assignedRdName = account.assignedRdUser.displayName;
  } else if (account.assignedRdUserId) {
    summary.assignedRdUserId = account.assignedRdUserId;
  }
  if (account.territoryAssignmentMethod) {
    summary.territoryAssignmentMethod = toTerritoryAssignmentMethodKey(account.territoryAssignmentMethod);
  }
  if (account.territoryAssignedAt) {
    summary.territoryAssignedAt = account.territoryAssignedAt.toISOString();
  }
  if (account.lifecycleStatusChangedAt) {
    summary.lifecycleStatusChangedAt = account.lifecycleStatusChangedAt.toISOString();
  }
  if (account.lifecycleReasonNote) {
    summary.lifecycleReasonNote = account.lifecycleReasonNote;
  }
  if (account.lastOrderAt) {
    summary.lastOrderAt = account.lastOrderAt.toISOString();
  }
  if (account.lastEngagementAt) {
    summary.lastEngagementAt = account.lastEngagementAt.toISOString();
  }

  return summary;
}

function buildAccountReadinessSummary(account: {
  sourceLeadId?: string | null;
  displayName: string;
  legalName: string | null;
  accountType: string | null;
  affinityGroupSelection: import('@pulse/db').GroupAxisSelection;
  ownershipGroupSelection: import('@pulse/db').GroupAxisSelection;
  groupClassification?: import('@pulse/db').GroupClassification | null;
  territoryId?: string | null;
  shippingCenterId?: string | null;
  assignedTmUserId?: string | null;
  assignedRdUserId?: string | null;
  lastOrderAt?: Date | null;
  lastEngagementAt?: Date | null;
  contacts: Array<{ isPrimary: boolean; isActive: boolean; email: string | null; phone: string | null; mobilePhone: string | null }>;
  locations: Array<{ isPrimary: boolean; isActive: boolean; city: string | null; state: string | null; countryCode: string | null }>;
}): AccountReadinessSummary {
  const activeContacts = account.contacts.filter((contact) => contact.isActive);
  const primaryContact = activeContacts.find((contact) => contact.isPrimary) ?? activeContacts[0];
  const activeLocations = account.locations.filter((location) => location.isActive);
  const primaryLocation = activeLocations.find((location) => location.isPrimary) ?? activeLocations[0];
  const hasKnownMembership = account.affinityGroupSelection !== 'UNKNOWN'
    && account.ownershipGroupSelection !== 'UNKNOWN'
    && Boolean(account.groupClassification);

  const checks: AccountReadinessCheck[] = [
    {
      key: 'profile',
      label: 'Profile',
      status: account.displayName && account.legalName && account.accountType ? 'ready' : 'needs_attention',
      message: account.displayName && account.legalName && account.accountType
        ? 'Core account name, legal name, and type are recorded.'
        : 'Add legal name and account type before treating this as a complete account profile.',
    },
    {
      key: 'contact',
      label: 'Primary contact',
      status: primaryContact && (primaryContact.email || primaryContact.phone || primaryContact.mobilePhone) ? 'ready' : 'needs_attention',
      message: primaryContact && (primaryContact.email || primaryContact.phone || primaryContact.mobilePhone)
        ? 'A reachable primary contact is available.'
        : 'Add a primary contact with email or phone so the field and support teams know who to reach.',
    },
    {
      key: 'location',
      label: 'Primary location',
      status: primaryLocation && primaryLocation.city && primaryLocation.state && primaryLocation.countryCode ? 'ready' : 'needs_attention',
      message: primaryLocation && primaryLocation.city && primaryLocation.state && primaryLocation.countryCode
        ? 'A primary location is available for territory, route, and training context.'
        : 'Add a primary city, state, and country before relying on route or territory context.',
    },
    {
      key: 'territory',
      label: 'Territory ownership',
      status: account.territoryId && account.shippingCenterId && account.assignedTmUserId && account.assignedRdUserId ? 'ready' : 'needs_attention',
      message: account.territoryId && account.shippingCenterId && account.assignedTmUserId && account.assignedRdUserId
        ? 'Territory, shipping center, TM, and RD ownership are assigned.'
        : 'Confirm territory, shipping center, TM, and RD ownership before field handoff.',
    },
    {
      key: 'dealer_membership',
      label: 'Dealer membership',
      status: hasKnownMembership ? 'ready' : 'needs_attention',
      message: hasKnownMembership
        ? `Dealer membership resolves as ${formatReadinessClassification(account.groupClassification)}.`
        : 'Confirm affinity and ownership/PE status so catalog visibility rules stay predictable.',
    },
    {
      key: 'source_lineage',
      label: 'Source lineage',
      status: account.sourceLeadId ? 'ready' : 'needs_attention',
      message: account.sourceLeadId
        ? 'The source lead is linked for audit and handoff traceability.'
        : 'No source lead is linked; this should usually be limited to bootstrap or migration records.',
    },
    {
      key: 'erp_activity',
      label: 'ERP activity',
      status: account.lastOrderAt || account.lastEngagementAt ? 'ready' : 'parked',
      message: account.lastOrderAt || account.lastEngagementAt
        ? 'Recent order or engagement signal is present.'
        : 'Order and revenue recency remain parked until Acumatica activity is available.',
    },
  ];

  const readyCount = checks.filter((check) => check.status === 'ready').length;
  const score = Math.round((readyCount / checks.length) * 100);
  return {
    score,
    status: score >= 80 ? 'ready' : score >= 50 ? 'needs_attention' : 'parked',
    checks,
  };
}

async function buildAccountActivityReview(account: {
  id: string;
  sourceLeadId?: string | null;
  lastOrderAt?: Date | null;
  lastEngagementAt?: Date | null;
  contacts: Array<{ id: string; isPrimary: boolean; isActive: boolean; email: string | null; phone: string | null; mobilePhone: string | null }>;
  locations: Array<{ id: string; isPrimary: boolean; isActive: boolean; city: string | null; state: string | null; countryCode: string | null }>;
}): Promise<AccountActivityReviewSummary> {
  const contactIds = account.contacts.map((contact) => contact.id);
  const locationIds = account.locations.map((location) => location.id);
  const paymentMethodIds = await prisma.accountPaymentVaultReference.findMany({
    where: { accountId: account.id },
    select: { id: true },
  });
  const entityScopes = [
    { entityType: ACCOUNT_ENTITY_TYPE, entityId: account.id },
    ...contactIds.map((entityId) => ({ entityType: CONTACT_ENTITY_TYPE, entityId })),
    ...locationIds.map((entityId) => ({ entityType: LOCATION_ENTITY_TYPE, entityId })),
    ...paymentMethodIds.map((method) => ({ entityType: ACCOUNT_PAYMENT_METHOD_ENTITY_TYPE, entityId: method.id })),
  ];

  const auditEntries = entityScopes.length
    ? await prisma.auditEntry.findMany({
        where: { OR: entityScopes },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          actor: {
            select: {
              displayName: true,
              email: true,
            },
          },
        },
      })
    : [];

  const recentEvents: AccountActivityReviewEvent[] = auditEntries.map((entry) => ({
    id: entry.id,
    occurredAt: entry.createdAt.toISOString(),
    action: entry.action,
    entityType: entry.entityType,
    label: formatAccountActivityLabel(entry.action, entry.entityType),
    detail: formatAccountActivityDetail(entry.entityType, entry.afterData, entry.beforeData),
    source: entry.entityType === ACCOUNT_PAYMENT_METHOD_ENTITY_TYPE ? 'payment_boundary' : 'pulse_crm',
    ...(entry.actor ? { actorName: entry.actor.displayName || entry.actor.email } : {}),
  }));

  if (account.sourceLeadId) {
    recentEvents.push({
      id: `source-lead-${account.sourceLeadId}`,
      occurredAt: account.lastEngagementAt?.toISOString() ?? new Date(0).toISOString(),
      action: 'LINK',
      entityType: 'LEAD',
      label: 'Source lead linked',
      detail: 'Original lead is available for intake, duplicate, routing, and handoff traceability.',
      source: 'source_lead',
    });
  }

  recentEvents.sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());

  const activeContacts = account.contacts.filter((contact) => contact.isActive);
  const activeLocations = account.locations.filter((location) => location.isActive);
  const documentBoundaries: AccountDocumentBoundary[] = [
    {
      key: 'source_lead',
      label: 'Source lead',
      status: account.sourceLeadId ? 'available' : 'needs_attention',
      detail: account.sourceLeadId
        ? 'Lead intake and conversion lineage are linked from this account.'
        : 'No source lead is linked; use this only for bootstrap or migration records.',
      ...(account.sourceLeadId ? { href: `/leads/${account.sourceLeadId}` } : {}),
    },
    {
      key: 'contacts_locations',
      label: 'Contacts and locations',
      status: activeContacts.length && activeLocations.length ? 'available' : 'needs_attention',
      detail: `${activeContacts.length} active contact${activeContacts.length === 1 ? '' : 's'} and ${activeLocations.length} active location${activeLocations.length === 1 ? '' : 's'} are saved in Pulse.`,
    },
    {
      key: 'dealer_portal',
      label: 'Dealer portal',
      status: 'available',
      detail: 'Portal access, catalog preview, and dealer-safe file visibility are managed in Pulse for dependency-free UAT.',
      href: `/customers/${account.id}?tab=portal`,
    },
    {
      key: 'payment_boundary',
      label: 'Payment method boundary',
      status: paymentMethodIds.length ? 'available' : 'parked',
      detail: paymentMethodIds.length
        ? `${paymentMethodIds.length} tokenized payment reference${paymentMethodIds.length === 1 ? '' : 's'} are available without exposing raw card data.`
        : 'No tokenized payment reference is saved yet; raw payment capture remains outside the account review timeline.',
      href: `/customers/${account.id}?tab=payment-methods`,
    },
    {
      key: 'erp_documents',
      label: 'ERP orders, invoices, and shipments',
      status: account.lastOrderAt ? 'available' : 'parked',
      detail: account.lastOrderAt
        ? 'ERP recency is present on this account.'
        : 'Orders, invoices, shipments, revenue, and pricing documents remain parked until Acumatica access and mappings are certified.',
    },
  ];

  return {
    recentEvents: recentEvents.slice(0, 8),
    documentBoundaries,
    parkedDependencies: documentBoundaries.filter((boundary) => boundary.status === 'parked').map((boundary) => boundary.detail),
  };
}

function formatAccountActivityLabel(action: AuditAction, entityType: string) {
  const entityLabel = entityType
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  if (action === AuditAction.CREATE) return `${entityLabel} created`;
  if (action === AuditAction.UPDATE) return `${entityLabel} updated`;
  if (action === AuditAction.DELETE) return `${entityLabel} removed`;
  return `${entityLabel} ${action.toLowerCase()}`;
}

function formatAccountActivityDetail(entityType: string, afterData: Prisma.JsonValue | null, beforeData: Prisma.JsonValue | null) {
  const after = isJsonRecord(afterData) ? afterData : {};
  const before = isJsonRecord(beforeData) ? beforeData : {};
  if (entityType === CONTACT_ENTITY_TYPE) {
    return [after.fullName, after.roleCode, formatPrimaryActive(after)].filter(Boolean).join(' · ') || 'Contact record changed.';
  }
  if (entityType === LOCATION_ENTITY_TYPE) {
    return [after.name, after.city, after.state, formatPrimaryActive(after)].filter(Boolean).join(' · ') || 'Location record changed.';
  }
  if (entityType === ACCOUNT_PAYMENT_METHOD_ENTITY_TYPE) {
    return 'Tokenized payment reference changed; raw payment details are not stored in Pulse.';
  }
  if (entityType === ACCOUNT_ENTITY_TYPE) {
    const displayName = typeof after.displayName === 'string' ? after.displayName : undefined;
    const lifecycleStatus = typeof after.lifecycleStatus === 'string' ? after.lifecycleStatus : undefined;
    const previousStatus = typeof before.lifecycleStatus === 'string' ? before.lifecycleStatus : undefined;
    return [displayName, lifecycleStatus && previousStatus && lifecycleStatus !== previousStatus ? `${previousStatus} -> ${lifecycleStatus}` : lifecycleStatus]
      .filter(Boolean)
      .join(' · ') || 'Account profile changed.';
  }
  return 'Pulse CRM activity was recorded for this account.';
}

function formatPrimaryActive(value: Record<string, unknown>) {
  const flags = [];
  if (value.isPrimary === true) flags.push('Primary');
  if (value.isActive === false) flags.push('Inactive');
  return flags.join(' · ');
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatReadinessClassification(classification: import('@pulse/db').GroupClassification | null | undefined) {
  if (!classification) return 'unknown';
  return classification.toLowerCase().replaceAll('_', ' ');
}

function toAccountLifecycleStatusEnum(value: AccountLifecycleStatusKey) {
  switch (value) {
    case 'active':
      return AccountLifecycleStatus.ACTIVE;
    case 'at_risk':
      return AccountLifecycleStatus.AT_RISK;
    case 'inactive':
      return AccountLifecycleStatus.INACTIVE;
    case 'churned':
      return AccountLifecycleStatus.CHURNED;
  }
}

function toAccountLifecycleStatusKey(value: AccountLifecycleStatus) {
  switch (value) {
    case AccountLifecycleStatus.ACTIVE:
      return 'active';
    case AccountLifecycleStatus.AT_RISK:
      return 'at_risk';
    case AccountLifecycleStatus.INACTIVE:
      return 'inactive';
    case AccountLifecycleStatus.CHURNED:
      return 'churned';
  }
}

function validateAccountLifecycleTransition(current: AccountLifecycleStatus, next: AccountLifecycleStatus) {
  if (current === next) {
    return;
  }

  const allowedTransitions: Record<AccountLifecycleStatus, AccountLifecycleStatus[]> = {
    [AccountLifecycleStatus.ACTIVE]: [AccountLifecycleStatus.AT_RISK, AccountLifecycleStatus.INACTIVE],
    [AccountLifecycleStatus.AT_RISK]: [AccountLifecycleStatus.ACTIVE, AccountLifecycleStatus.INACTIVE],
    [AccountLifecycleStatus.INACTIVE]: [AccountLifecycleStatus.ACTIVE, AccountLifecycleStatus.CHURNED],
    [AccountLifecycleStatus.CHURNED]: [AccountLifecycleStatus.ACTIVE],
  };

  if (!allowedTransitions[current].includes(next)) {
    throw new Error(`Lifecycle transition is not allowed: ${toAccountLifecycleStatusKey(current)} -> ${toAccountLifecycleStatusKey(next)}`);
  }
}

function toTerritoryAssignmentMethodKey(value: TerritoryAssignmentMethod) {
  switch (value) {
    case TerritoryAssignmentMethod.DEFAULT_STATE:
      return 'default_state';
    case TerritoryAssignmentMethod.MANUAL_OVERRIDE:
      return 'manual_override';
    case TerritoryAssignmentMethod.SYSTEM:
      return 'system';
  }
}

function toContactSummary(contact: {
  id: string;
  accountId: string;
  locationId: string | null;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  roleCode: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ContactSummary {
  const summary: ContactSummary = {
    id: contact.id,
    accountId: contact.accountId,
    firstName: contact.firstName,
    lastName: contact.lastName,
    isPrimary: contact.isPrimary,
    isActive: contact.isActive,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };

  if (contact.locationId) {
    summary.locationId = contact.locationId;
  }
  if (contact.title) {
    summary.title = contact.title;
  }
  if (contact.email) {
    summary.email = contact.email;
  }
  if (contact.phone) {
    summary.phone = contact.phone;
  }
  if (contact.mobilePhone) {
    summary.mobilePhone = contact.mobilePhone;
  }
  if (contact.roleCode) {
    summary.roleCode = contact.roleCode;
  }

  return summary;
}

function toAccountLocationSummary(location: {
  id: string;
  locationCode: string | null;
  name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  countryCode: string | null;
  isPrimary: boolean;
  isActive: boolean;
}): AccountLocationSummary {
  const summary = {
    id: location.id,
    isPrimary: location.isPrimary,
    isActive: location.isActive,
  };

  return {
    ...summary,
    ...(location.locationCode ? { locationCode: location.locationCode } : {}),
    ...(location.name ? { name: location.name } : {}),
    ...(location.line1 ? { line1: location.line1 } : {}),
    ...(location.line2 ? { line2: location.line2 } : {}),
    ...(location.city ? { city: location.city } : {}),
    ...(location.state ? { state: location.state } : {}),
    ...(location.postalCode ? { postalCode: location.postalCode } : {}),
    ...(location.countryCode ? { countryCode: location.countryCode } : {}),
  };
}

async function resolveAccountClassificationInput(
  tx: Prisma.TransactionClient,
  input: {
    affinityGroupSelection?: string;
    affinityGroupId?: string | null;
    affinityGroupCode?: string;
    affinityGroupName?: string;
    ownershipGroupSelection?: string;
    ownershipGroupId?: string | null;
    ownershipGroupCode?: string;
    ownershipGroupName?: string;
  },
) {
  const affinity = await resolveAffinityGroupAxis({
    tx,
    kind: 'affinity',
    selection: input.affinityGroupSelection as import('@pulse/contracts').GroupAxisSelectionKey | undefined,
    id: input.affinityGroupId ?? undefined,
    code: input.affinityGroupCode,
    name: input.affinityGroupName,
    requireExplicitSelection: false,
  });
  const ownership = await resolveOwnershipGroupAxis({
    tx,
    kind: 'ownership',
    selection: input.ownershipGroupSelection as import('@pulse/contracts').GroupAxisSelectionKey | undefined,
    id: input.ownershipGroupId ?? undefined,
    code: input.ownershipGroupCode,
    name: input.ownershipGroupName,
    requireExplicitSelection: false,
  });

  return {
    affinity,
    ownership,
    groupClassification: deriveGroupClassification(affinity.selection, ownership.selection),
  };
}

function normalizeLimit(limit: number | undefined) {
  if (limit === undefined) {
    return 25;
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('limit must be a positive integer');
  }

  return Math.min(limit, 100);
}

function optionalTrimmed(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeNullableText(value: string | null | undefined) {
  if (value === null) {
    return null;
  }

  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function ensurePrimaryActiveLocation(
  tx: Prisma.TransactionClient,
  accountId: string,
  excludedLocationId: string,
) {
  const fallback = await tx.accountLocation.findFirst({
    where: {
      accountId,
      isActive: true,
      NOT: { id: excludedLocationId },
    },
    orderBy: [
      { createdAt: 'asc' },
    ],
    select: { id: true },
  });

  if (!fallback) {
    return;
  }

  await tx.accountLocation.update({
    where: { id: fallback.id },
    data: {
      isPrimary: true,
    },
  });
}

async function ensurePrimaryActiveContact(
  tx: Prisma.TransactionClient,
  accountId: string,
  excludedContactId: string,
) {
  const fallback = await tx.contact.findFirst({
    where: {
      accountId,
      isActive: true,
      NOT: { id: excludedContactId },
    },
    orderBy: [
      { createdAt: 'asc' },
    ],
    select: { id: true },
  });

  if (!fallback) {
    return;
  }

  await tx.contact.update({
    where: { id: fallback.id },
    data: {
      isPrimary: true,
    },
  });
}
