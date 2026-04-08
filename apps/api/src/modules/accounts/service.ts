import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import { AuditAction, Prisma, prisma } from '@pulse/db';
import type {
  AccountDetail,
  AccountLocationSummary,
  AccountSummary,
  ContactSummary,
  CreateAccountRequest,
  CreateContactRequest,
  ListAccountsRequest,
  ListAccountsResponse,
} from '@pulse/contracts';
import type { AuthenticatedActor } from '../auth/types.js';
import { buildAuditEntryData } from '../../utils/audit.js';

const ACCOUNT_ENTITY_TYPE = 'ACCOUNT';
const CONTACT_ENTITY_TYPE = 'CONTACT';

export async function listAccounts(actor: AuthenticatedActor, query: ListAccountsRequest = {}): Promise<ListAccountsResponse> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'customer.view');

  const limit = normalizeLimit(query.limit);
  const search = query.search?.trim();
  const includeInactive = query.includeInactive ?? false;

  const where: Prisma.AccountWhereInput = {};
  if (!includeInactive) {
    where.isActive = true;
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
      where,
      orderBy: [
        { displayName: 'asc' },
        { createdAt: 'asc' },
      ],
      take: limit,
      include: {
        _count: {
          select: {
            contacts: true,
            locations: true,
          },
        },
      },
    }),
    prisma.account.count({ where }),
  ]);

  return {
    items: items.map((account) => toAccountSummary(account)),
    total,
  };
}

export async function createAccount(actor: AuthenticatedActor, input: CreateAccountRequest): Promise<AccountSummary> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'customer.create');

  const displayName = input.displayName?.trim();
  if (!displayName) {
    throw new Error('displayName is required');
  }

  const legalName = optionalTrimmed(input.legalName);
  const accountType = optionalTrimmed(input.accountType);
  const isActive = input.isActive ?? true;

  const account = await prisma.$transaction(async (tx) => {
    const created = await tx.account.create({
      data: {
        displayName,
        ...(legalName !== undefined ? { legalName } : {}),
        ...(accountType !== undefined ? { accountType } : {}),
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

export async function getAccountDetail(actor: AuthenticatedActor, accountId: string): Promise<AccountDetail | null> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'customer.view');

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
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

  return {
    ...toAccountSummary(account),
    locations: account.locations.map(toAccountLocationSummary),
    contacts: account.contacts.map(toContactSummary),
  };
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
    select: { id: true },
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

  const isPrimary = input.isPrimary ?? false;
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

function toAccountSummary(account: {
  id: string;
  accountNumber: string | null;
  displayName: string;
  legalName: string | null;
  accountType: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    contacts: number;
    locations: number;
  };
}): AccountSummary {
  const summary: AccountSummary = {
    id: account.id,
    displayName: account.displayName,
    isActive: account.isActive,
    contactCount: account._count.contacts,
    locationCount: account._count.locations,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };

  if (account.accountNumber) {
    summary.accountNumber = account.accountNumber;
  }
  if (account.legalName) {
    summary.legalName = account.legalName;
  }
  if (account.accountType) {
    summary.accountType = account.accountType;
  }

  return summary;
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
    ...(location.city ? { city: location.city } : {}),
    ...(location.state ? { state: location.state } : {}),
    ...(location.postalCode ? { postalCode: location.postalCode } : {}),
    ...(location.countryCode ? { countryCode: location.countryCode } : {}),
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
