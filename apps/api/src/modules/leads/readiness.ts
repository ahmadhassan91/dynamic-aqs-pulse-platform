import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import {
  AuditAction,
  CisFinanceDecisionStatus,
  LeadContactRole,
  LeadContactSource,
  LeadConversionPreparationStatus,
  LeadReadinessStatus,
  LeadStage,
  OnboardingChecklistItemStatus,
  OnboardingChecklistStatus,
  PortalEligibilityStatus,
  Prisma,
  SegmentAssignmentSource,
  prisma,
} from '@pulse/db';
import type {
  ConvertLeadOnFirstOrderRequest,
  ConvertLeadOnFirstOrderResponse,
  CreateLeadContactRequest,
  LeadAddressSnapshot,
  LeadContactRoleKey,
  LeadContactSourceKey,
  LeadContactSummary,
  LeadConversionPreparationRecord,
  LeadConversionValidationResponse,
  LeadReadinessBlockersResponse,
  LeadReadinessDetail,
  LeadReadinessItemSummary,
  LeadReadinessSummary,
  UpdateLeadContactRequest,
  UpdateLeadConversionPreparationRequest,
  UpdateLeadReadinessItemRequest,
} from '@pulse/contracts';
import type { AuthenticatedActor } from '../auth/types.js';
import { resolveLeadRecordScope } from '../auth/visibility.js';
import { buildAuditEntryData } from '../../utils/audit.js';

const LEAD_ENTITY_TYPE = 'LEAD';
const LEAD_CONTACT_ENTITY_TYPE = 'LEAD_CONTACT';
const LEAD_READINESS_ENTITY_TYPE = 'LEAD_READINESS';
const LEAD_CONVERSION_PREP_ENTITY_TYPE = 'LEAD_CONVERSION_PREPARATION';
const ONBOARDING_CHECKLIST_ENTITY_TYPE = 'ONBOARDING_CHECKLIST';

type ReadinessContext = Prisma.LeadGetPayload<{
  include: {
    readinessState: true;
    onboardingChecklist: {
      include: {
        items: {
          orderBy: {
            sortOrder: 'asc';
          };
        };
      };
    };
    leadContacts: {
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' },
      ];
    };
    conversionPreparation: true;
    cisPackages: {
      orderBy: {
        createdAt: 'desc';
      };
      take: 1;
      include: {
        formData: true;
        financeDecision: true;
      };
    };
    convertedAccount: true;
  };
}>;

type AddressSnapshotInput = {
  name?: string | undefined;
  line1?: string | undefined;
  line2?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  postalCode?: string | undefined;
  countryCode?: string | undefined;
};

type LeadContactUpsertInput = {
  displayName: string;
  title?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  mobilePhone?: string | undefined;
  isPrimary?: boolean | undefined;
};

type ChecklistTemplateItem = {
  code: string;
  label: string;
  ownerRoleCode?: string;
  required?: boolean;
  sortOrder: number;
};

const CHECKLIST_TEMPLATE: readonly ChecklistTemplateItem[] = [
  { code: 'finance_approved', label: 'Finance approval confirmed', ownerRoleCode: 'FINANCE', sortOrder: 10 },
  { code: 'lead_contacts_mapped', label: 'Lead contacts mapped from intake and CIS', ownerRoleCode: 'SALES_BD_REP', sortOrder: 20 },
  { code: 'affinity_group_validated', label: 'Affinity group validated', ownerRoleCode: 'ADMIN_CSR_OPS', sortOrder: 30 },
  { code: 'ownership_group_validated', label: 'Ownership group validated', ownerRoleCode: 'ADMIN_CSR_OPS', sortOrder: 40 },
  { code: 'price_class_assigned', label: 'Price class assigned', ownerRoleCode: 'FINANCE', sortOrder: 50 },
  { code: 'portal_access_granted', label: 'Portal access granted', ownerRoleCode: 'ADMIN_CSR_OPS', sortOrder: 60 },
  { code: 'welcome_email_sent', label: 'Welcome email sent', ownerRoleCode: 'ADMIN_CSR_OPS', sortOrder: 70 },
  { code: 'training_session_1_scheduled', label: 'Training session 1 completed', ownerRoleCode: 'TRAINING_OPS', sortOrder: 80 },
  { code: 'training_session_2_completed', label: 'Training session 2 completed', ownerRoleCode: 'TRAINING_OPS', sortOrder: 90 },
  { code: 'training_session_3_completed', label: 'Training session 3 completed', ownerRoleCode: 'TRAINING_OPS', sortOrder: 100 },
  { code: 'account_readiness_verified', label: 'Account readiness verified', ownerRoleCode: 'ADMIN_CSR_OPS', sortOrder: 110 },
  { code: 'consignment_interest_captured', label: 'Consignment interest captured', ownerRoleCode: 'SALES_BD_REP', required: false, sortOrder: 120 },
] as const;

// Scoped roles (TM/RD) may only touch leads inside their book; global-visibility roles match all.
// Returns false when the lead exists but is outside the actor's record scope, so per-lead readers
// can 404 instead of leaking another territory's contacts, addresses, and CIS/finance state.
async function isLeadVisibleToActor(actor: AuthenticatedActor, leadId: string): Promise<boolean> {
  const scopeWhere = await resolveLeadRecordScope(actor);
  if (!scopeWhere) {
    return true;
  }
  const visible = await prisma.lead.findFirst({
    where: { AND: [scopeWhere, { id: leadId }] },
    select: { id: true },
  });
  return visible !== null;
}

export async function getLeadReadiness(actor: AuthenticatedActor, leadId: string): Promise<LeadReadinessDetail | null> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.view');

  if (!(await isLeadVisibleToActor(actor, leadId))) {
    return null;
  }

  const lead = await loadReadinessContext(prisma, leadId);
  if (!lead) {
    return null;
  }

  return toLeadReadinessDetail(lead);
}

export async function getLeadReadinessBlockers(
  actor: AuthenticatedActor,
  leadId: string,
): Promise<LeadReadinessBlockersResponse | null> {
  const readiness = await getLeadReadiness(actor, leadId);
  if (!readiness) {
    return null;
  }

  return {
    leadId,
    blockers: readiness.blockers,
  };
}

export async function generateLeadReadinessChecklist(
  actor: AuthenticatedActor,
  leadId: string,
): Promise<LeadReadinessDetail> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  await prisma.$transaction(async (tx) => {
    const lead = await loadReadinessContext(tx, leadId);
    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    const latestCisPackage = lead.cisPackages[0];
    const financeStatus = latestCisPackage?.financeDecision?.status;
    if (!latestCisPackage || (financeStatus !== CisFinanceDecisionStatus.APPROVED && financeStatus !== CisFinanceDecisionStatus.CONDITIONAL)) {
      throw new Error('Readiness checklist can only be generated after finance approval or conditional approval');
    }

    await upsertLeadContactsFromLeadAndCis(tx, lead);
    await ensureLeadConversionPreparation(tx, lead);

    const checklist = await tx.onboardingChecklist.upsert({
      where: { leadId },
      update: {
        status: OnboardingChecklistStatus.IN_PROGRESS,
        blockedReason: null,
      },
      create: {
        leadId,
        status: OnboardingChecklistStatus.IN_PROGRESS,
      },
    });

    for (const template of CHECKLIST_TEMPLATE) {
      await tx.onboardingChecklistItem.upsert({
        where: {
          checklistId_code: {
            checklistId: checklist.id,
            code: template.code,
          },
        },
        update: {
          label: template.label,
          ownerRoleCode: template.ownerRoleCode ?? null,
          required: template.required ?? true,
          sortOrder: template.sortOrder,
        },
        create: {
          checklistId: checklist.id,
          code: template.code,
          label: template.label,
          ownerRoleCode: template.ownerRoleCode ?? null,
          required: template.required ?? true,
          sortOrder: template.sortOrder,
        },
      });
    }

    await refreshLeadReadinessState(tx, leadId, {
      actorUserId: actor.userId,
      sessionId: actor.sessionId,
      actorRole: actor.role,
      actorType: actor.actorType,
      markChecklistGenerated: true,
    });
  });

  return (await getLeadReadiness(actor, leadId)) as LeadReadinessDetail;
}

export async function updateLeadReadinessItem(
  actor: AuthenticatedActor,
  leadId: string,
  itemId: string,
  input: UpdateLeadReadinessItemRequest,
): Promise<LeadReadinessDetail> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  await prisma.$transaction(async (tx) => {
    const checklistItem = await tx.onboardingChecklistItem.findUnique({
      where: { id: itemId },
      include: {
        checklist: true,
      },
    });
    if (!checklistItem || checklistItem.checklist.leadId !== leadId) {
      throw new Error(`Readiness checklist item not found for lead: ${leadId}`);
    }

    const currentStatus = checklistItem.status;
    const nextStatus = input.status ? toChecklistItemStatusEnum(input.status) : checklistItem.status;
    const dueAt = parseOptionalDate(input.dueAt, 'dueAt');
    const notes = optionalTrimmed(input.notes);
    const ownerRoleCode = optionalTrimmed(input.ownerRoleCode);
    const ownerUserId = optionalTrimmed(input.ownerUserId);
    const completedAt = nextStatus === OnboardingChecklistItemStatus.COMPLETED
      ? checklistItem.completedAt ?? new Date()
      : null;
    const completedByUserId = nextStatus === OnboardingChecklistItemStatus.COMPLETED ? actor.userId : null;

    const updateData: Prisma.OnboardingChecklistItemUncheckedUpdateInput = {
      status: nextStatus,
      completedAt,
      completedByUserId,
    };
    if (input.ownerRoleCode !== undefined) {
      updateData.ownerRoleCode = ownerRoleCode ?? null;
    }
    if (input.ownerUserId !== undefined) {
      updateData.ownerUserId = ownerUserId ?? null;
    }
    if (input.dueAt !== undefined) {
      updateData.dueAt = dueAt ?? null;
    }
    if (input.notes !== undefined) {
      updateData.notes = notes ?? null;
    }

    await tx.onboardingChecklistItem.update({
      where: { id: itemId },
      data: updateData,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: ONBOARDING_CHECKLIST_ENTITY_TYPE,
        entityId: itemId,
        beforeData: {
          status: toChecklistItemStatusKey(currentStatus),
        },
        afterData: {
          status: toChecklistItemStatusKey(nextStatus),
          ownerRoleCode: ownerRoleCode ?? checklistItem.ownerRoleCode ?? null,
          ownerUserId: ownerUserId ?? checklistItem.ownerUserId ?? null,
          dueAt: dueAt?.toISOString() ?? checklistItem.dueAt?.toISOString() ?? null,
          notes: notes ?? checklistItem.notes ?? null,
        },
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
          leadId,
        },
      }),
    });

    await refreshLeadReadinessState(tx, leadId, {
      actorUserId: actor.userId,
      sessionId: actor.sessionId,
      actorRole: actor.role,
      actorType: actor.actorType,
    });
  });

  return (await getLeadReadiness(actor, leadId)) as LeadReadinessDetail;
}

export async function listLeadContacts(actor: AuthenticatedActor, leadId: string): Promise<LeadContactSummary[] | null> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.view');

  if (!(await isLeadVisibleToActor(actor, leadId))) {
    return null;
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true },
  });
  if (!lead) {
    return null;
  }

  const contacts = await prisma.leadContact.findMany({
    where: { leadId },
    orderBy: [
      { isPrimary: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  return contacts.map(toLeadContactSummary);
}

export async function createLeadContact(
  actor: AuthenticatedActor,
  leadId: string,
  input: CreateLeadContactRequest,
): Promise<LeadContactSummary> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const displayName = optionalTrimmed(input.displayName);
  if (!displayName) {
    throw new Error('displayName is required');
  }

  const role = toLeadContactRoleEnum(input.role);
  const source = input.source ? toLeadContactSourceEnum(input.source) : null;
  const email = optionalTrimmed(input.email)?.toLowerCase();
  const phone = optionalTrimmed(input.phone);
  const mobilePhone = optionalTrimmed(input.mobilePhone);
  const title = optionalTrimmed(input.title);
  const notes = optionalTrimmed(input.notes);
  const firstName = optionalTrimmed(input.firstName);
  const lastName = optionalTrimmed(input.lastName);
  const isPrimary = input.isPrimary ?? role === LeadContactRole.PRIMARY;
  const isActive = input.isActive ?? true;

  const contact = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      select: { id: true },
    });
    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    if (isPrimary) {
      await tx.leadContact.updateMany({
        where: {
          leadId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const created = await tx.leadContact.create({
      data: {
        leadId,
        role,
        ...(source ? { source } : {}),
        displayName,
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(mobilePhone !== undefined ? { mobilePhone } : {}),
        isPrimary,
        isActive,
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: LEAD_CONTACT_ENTITY_TYPE,
        entityId: created.id,
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
          leadId,
        },
        afterData: {
          role: toLeadContactRoleKey(created.role),
          displayName: created.displayName,
          email: created.email ?? null,
          isPrimary: created.isPrimary,
        },
      }),
    });

    await refreshLeadReadinessState(tx, leadId, {
      actorUserId: actor.userId,
      sessionId: actor.sessionId,
      actorRole: actor.role,
      actorType: actor.actorType,
    });

    return created;
  });

  return toLeadContactSummary(contact);
}

export async function updateLeadContact(
  actor: AuthenticatedActor,
  leadId: string,
  contactId: string,
  input: UpdateLeadContactRequest,
): Promise<LeadContactSummary> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.leadContact.findUnique({
      where: { id: contactId },
    });
    if (!existing || existing.leadId !== leadId) {
      throw new Error(`Lead contact not found for lead: ${leadId}`);
    }

    const data: Prisma.LeadContactUpdateInput = {};
    if (input.role !== undefined) {
      data.role = toLeadContactRoleEnum(input.role);
    }
    if (input.source !== undefined) {
      data.source = input.source ? toLeadContactSourceEnum(input.source) : null;
    }
    if (input.displayName !== undefined) {
      const displayName = optionalTrimmed(input.displayName);
      if (!displayName) {
        throw new Error('displayName cannot be empty');
      }
      data.displayName = displayName;
    }
    if (input.firstName !== undefined) {
      data.firstName = optionalTrimmed(input.firstName) ?? null;
    }
    if (input.lastName !== undefined) {
      data.lastName = optionalTrimmed(input.lastName) ?? null;
    }
    if (input.title !== undefined) {
      data.title = optionalTrimmed(input.title) ?? null;
    }
    if (input.email !== undefined) {
      data.email = optionalTrimmed(input.email)?.toLowerCase() ?? null;
    }
    if (input.phone !== undefined) {
      data.phone = optionalTrimmed(input.phone) ?? null;
    }
    if (input.mobilePhone !== undefined) {
      data.mobilePhone = optionalTrimmed(input.mobilePhone) ?? null;
    }
    if (input.notes !== undefined) {
      data.notes = optionalTrimmed(input.notes) ?? null;
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }
    if (input.isPrimary !== undefined) {
      if (input.isPrimary) {
        await tx.leadContact.updateMany({
          where: {
            leadId,
            isPrimary: true,
            id: {
              not: contactId,
            },
          },
          data: {
            isPrimary: false,
          },
        });
      }
      data.isPrimary = input.isPrimary;
    }

    const next = await tx.leadContact.update({
      where: { id: contactId },
      data,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: LEAD_CONTACT_ENTITY_TYPE,
        entityId: next.id,
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
          leadId,
        },
        beforeData: {
          role: toLeadContactRoleKey(existing.role),
          displayName: existing.displayName,
          email: existing.email ?? null,
          isPrimary: existing.isPrimary,
        },
        afterData: {
          role: toLeadContactRoleKey(next.role),
          displayName: next.displayName,
          email: next.email ?? null,
          isPrimary: next.isPrimary,
        },
      }),
    });

    await refreshLeadReadinessState(tx, leadId, {
      actorUserId: actor.userId,
      sessionId: actor.sessionId,
      actorRole: actor.role,
      actorType: actor.actorType,
    });

    return next;
  });

  return toLeadContactSummary(updated);
}

export async function importLeadContactsFromCis(actor: AuthenticatedActor, leadId: string): Promise<LeadContactSummary[]> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const contacts = await prisma.$transaction(async (tx) => {
    const lead = await loadReadinessContext(tx, leadId);
    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    await upsertLeadContactsFromLeadAndCis(tx, lead);
    await refreshLeadReadinessState(tx, leadId, {
      actorUserId: actor.userId,
      sessionId: actor.sessionId,
      actorRole: actor.role,
      actorType: actor.actorType,
    });

    return tx.leadContact.findMany({
      where: { leadId },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  });

  return contacts.map(toLeadContactSummary);
}

export async function getLeadConversionPreparation(
  actor: AuthenticatedActor,
  leadId: string,
): Promise<LeadConversionPreparationRecord | null> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.view');

  if (!(await isLeadVisibleToActor(actor, leadId))) {
    return null;
  }

  const record = await prisma.$transaction(async (tx) => {
    const lead = await loadReadinessContext(tx, leadId);
    if (!lead) {
      return null;
    }

    return ensureLeadConversionPreparation(tx, lead);
  });

  return record ? toLeadConversionPreparationRecord(record) : null;
}

export async function updateLeadConversionPreparation(
  actor: AuthenticatedActor,
  leadId: string,
  input: UpdateLeadConversionPreparationRequest,
): Promise<LeadConversionPreparationRecord> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const record = await prisma.$transaction(async (tx) => {
    const lead = await loadReadinessContext(tx, leadId);
    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    const existing = await ensureLeadConversionPreparation(tx, lead);
    const targetAccountName = input.targetAccountName !== undefined ? optionalTrimmed(input.targetAccountName) : existing.targetAccountName;
    const legalCompanyName = input.legalCompanyName !== undefined ? optionalTrimmed(input.legalCompanyName) : existing.legalCompanyName;
    const accountType = input.accountType !== undefined ? optionalTrimmed(input.accountType) : existing.accountType;
    const financeAuthorityMode = input.financeAuthorityMode !== undefined ? optionalTrimmed(input.financeAuthorityMode) : existing.financeAuthorityMode;
    const priceClassCode = input.priceClassCode !== undefined ? optionalTrimmed(input.priceClassCode) : existing.priceClassCode;
    const notes = input.notes !== undefined ? optionalTrimmed(input.notes) : existing.notes;
    const portalEligibilityStatus = input.portalEligibilityStatus
      ? toPortalEligibilityStatusEnum(input.portalEligibilityStatus)
      : existing.portalEligibilityStatus;
    const shippingAddressSnapshot = input.shippingAddressSnapshot !== undefined
      ? sanitizeAddressSnapshot(input.shippingAddressSnapshot)
      : toAddressSnapshotInput(existing.shippingAddressSnapshot);
    const billingAddressSnapshot = input.billingAddressSnapshot !== undefined
      ? sanitizeAddressSnapshot(input.billingAddressSnapshot)
      : toAddressSnapshotInput(existing.billingAddressSnapshot);

    const next = await tx.leadConversionPreparation.update({
      where: { leadId },
      data: {
        targetAccountName: targetAccountName ?? null,
        legalCompanyName: legalCompanyName ?? null,
        accountType: accountType ?? null,
        financeAuthorityMode: financeAuthorityMode ?? null,
        priceClassCode: priceClassCode ?? null,
        portalEligibilityStatus,
        shippingAddressSnapshot: shippingAddressSnapshot ? toJsonValue(shippingAddressSnapshot) : Prisma.JsonNull,
        billingAddressSnapshot: billingAddressSnapshot ? toJsonValue(billingAddressSnapshot) : Prisma.JsonNull,
        notes: notes ?? null,
        reviewedAt: new Date(),
        reviewedByUserId: actor.userId,
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: LEAD_CONVERSION_PREP_ENTITY_TYPE,
        entityId: leadId,
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
          leadId,
        },
        afterData: {
          targetAccountName: next.targetAccountName ?? null,
          legalCompanyName: next.legalCompanyName ?? null,
          priceClassCode: next.priceClassCode ?? null,
          portalEligibilityStatus: toPortalEligibilityStatusKey(next.portalEligibilityStatus),
        },
      }),
    });

    await refreshLeadReadinessState(tx, leadId, {
      actorUserId: actor.userId,
      sessionId: actor.sessionId,
      actorRole: actor.role,
      actorType: actor.actorType,
    });

    return next;
  });

  return toLeadConversionPreparationRecord(record);
}

export async function validateLeadConversionPreparation(
  actor: AuthenticatedActor,
  leadId: string,
): Promise<LeadConversionValidationResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.view');

  if (!(await isLeadVisibleToActor(actor, leadId))) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const lead = await loadReadinessContext(tx, leadId);
    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    await ensureLeadConversionPreparation(tx, lead);
    const refreshed = await refreshLeadReadinessState(tx, leadId, {
      actorUserId: actor.userId,
      sessionId: actor.sessionId,
      actorRole: actor.role,
      actorType: actor.actorType,
    });

    return refreshed;
  });

  return {
    preparation: toLeadConversionPreparationRecord(result.conversionPreparation),
    blockers: result.blockers,
    ready: result.summary.status === 'ready',
  };
}

export async function convertLeadOnFirstOrder(
  actor: AuthenticatedActor,
  leadId: string,
  input: ConvertLeadOnFirstOrderRequest = {},
  options: { autoFirstOrderSignal?: boolean } = {},
): Promise<ConvertLeadOnFirstOrderResponse> {
  assertModuleAccess(actor.role, 'customers');
  assertActionAccess(actor.role, 'customer.create');

  // customer.create is held by TERRITORY_MANAGER (a scoped role), so a TM could otherwise convert
  // any ready lead in the system. Gate the conversion on the actor's lead scope.
  if (!(await isLeadVisibleToActor(actor, leadId))) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const converted = await prisma.$transaction(async (tx) => {
    const lead = await loadReadinessContext(tx, leadId);
    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }
    if (lead.convertedAccount) {
      throw new Error('Lead has already been converted into an account');
    }

    const readiness = await refreshLeadReadinessState(tx, leadId, {
      actorUserId: actor.userId,
      sessionId: actor.sessionId,
      actorRole: actor.role,
      actorType: actor.actorType,
    });
    if (readiness.summary.status !== 'ready') {
      throw new Error(`Lead is not ready for conversion: ${readiness.blockers.join('; ')}`);
    }

    let firstOrderAt = input.firstOrderConfirmedAt
      ? parseRequiredDate(input.firstOrderConfirmedAt, 'firstOrderConfirmedAt')
      : lead.firstOrderAt ?? null;
    // ORD-P5 (flag-gated, default OFF): treat the conversion moment as the first-order
    // signal so the office isn't forced to hand-key a date. This stays a CRM intent, not
    // an ERP confirmation — when the Acumatica order boundary is wired, a real order event
    // would supply this timestamp instead.
    let firstOrderAutoDerived = false;
    if (!firstOrderAt && options.autoFirstOrderSignal) {
      firstOrderAt = new Date();
      firstOrderAutoDerived = true;
    }
    if (!firstOrderAt) {
      throw new Error('firstOrderConfirmedAt is required until the Acumatica order boundary is wired');
    }

    const preparation = lead.conversionPreparation ?? (await ensureLeadConversionPreparation(tx, lead));
    const contacts = lead.leadContacts.length > 0 ? lead.leadContacts : await fallbackLeadContacts(tx, lead);
    const shippingAddress = toAddressSnapshotInput(preparation.shippingAddressSnapshot);
    const billingAddress = toAddressSnapshotInput(preparation.billingAddressSnapshot);

    const account = await tx.account.create({
      data: {
        sourceLeadId: lead.id,
        displayName: preparation.targetAccountName ?? lead.companyName,
        legalName: preparation.legalCompanyName ?? preparation.targetAccountName ?? lead.companyName,
        accountType: preparation.accountType ?? null,
        financeAuthorityMode: preparation.financeAuthorityMode ?? null,
        businessSegmentId: lead.businessSegmentId,
        businessSegmentSource: SegmentAssignmentSource.CRM,
        affinityGroupSelection: lead.affinityGroupSelection,
        affinityGroupId: lead.affinityGroupId ?? null,
        ownershipGroupSelection: lead.ownershipGroupSelection,
        ownershipGroupId: lead.ownershipGroupId ?? null,
        groupClassification: lead.groupClassification ?? null,
        territoryId: lead.territoryId ?? null,
        territoryAssignmentMethod: lead.territoryAssignmentMethod ?? null,
        territoryAssignedAt: lead.territoryAssignedAt ?? null,
        shippingCenterId: lead.shippingCenterId ?? null,
        assignedTmUserId: lead.assignedTmUserId ?? null,
        assignedRdUserId: lead.assignedRdUserId ?? null,
        lifecycleStatus: 'ACTIVE',
        lifecycleStatusChangedAt: firstOrderAt,
        lastOrderAt: firstOrderAt,
        isActive: true,
      },
    });

    const createdLocationIds: string[] = [];
    const primaryLocation = shippingAddress && hasMeaningfulAddress(shippingAddress)
      ? await tx.accountLocation.create({
          data: {
            accountId: account.id,
            name: shippingAddress.name ?? 'Primary',
            line1: shippingAddress.line1 ?? null,
            line2: shippingAddress.line2 ?? null,
            city: shippingAddress.city ?? null,
            state: shippingAddress.state ?? null,
            postalCode: shippingAddress.postalCode ?? null,
            countryCode: shippingAddress.countryCode ?? 'US',
            isPrimary: true,
          },
        })
      : null;
    if (primaryLocation) {
      createdLocationIds.push(primaryLocation.id);
    }

    if (billingAddress && hasMeaningfulAddress(billingAddress) && !addressesEqual(shippingAddress, billingAddress)) {
      const billingLocation = await tx.accountLocation.create({
        data: {
          accountId: account.id,
          name: billingAddress.name ?? 'Billing',
          line1: billingAddress.line1 ?? null,
          line2: billingAddress.line2 ?? null,
          city: billingAddress.city ?? null,
          state: billingAddress.state ?? null,
          postalCode: billingAddress.postalCode ?? null,
          countryCode: billingAddress.countryCode ?? 'US',
          isPrimary: primaryLocation ? false : true,
        },
      });
      createdLocationIds.push(billingLocation.id);
    }

    const createdContacts = [];
    for (const contact of contacts) {
      const { firstName, lastName } = ensureNameParts(contact.firstName, contact.lastName, contact.displayName);
      const createdContact = await tx.contact.create({
        data: {
          accountId: account.id,
          locationId: primaryLocation?.id ?? null,
          firstName,
          lastName,
          title: contact.title ?? null,
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          mobilePhone: contact.mobilePhone ?? null,
          roleCode: toLeadContactRoleKey(contact.role),
          isPrimary: contact.isPrimary,
          isActive: contact.isActive,
        },
      });
      createdContacts.push(createdContact);
    }

    await tx.lead.update({
      where: { id: lead.id },
      data: {
        stage: LeadStage.CUSTOMER_ACTIVE,
        firstOrderAt,
      },
    });

    await tx.onboardingChecklist.updateMany({
      where: { leadId: lead.id },
      data: {
        status: OnboardingChecklistStatus.COMPLETED,
        completedAt: new Date(),
        blockedReason: null,
      },
    });

    await tx.leadConversionPreparation.update({
      where: { leadId: lead.id },
      data: {
        status: LeadConversionPreparationStatus.CONVERTED,
        conversionReady: true,
        conversionBlockedReason: null,
        validatedAt: new Date(),
        reviewedAt: new Date(),
        reviewedByUserId: actor.userId,
      },
    });

    await tx.leadReadinessState.upsert({
      where: { leadId: lead.id },
      update: {
        status: LeadReadinessStatus.CONVERTED,
        firstOrderReadyAt: lead.readinessState?.firstOrderReadyAt ?? new Date(),
        convertedAt: new Date(),
        blockedReason: null,
      },
      create: {
        leadId: lead.id,
        status: LeadReadinessStatus.CONVERTED,
        firstOrderReadyAt: new Date(),
        convertedAt: new Date(),
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: LEAD_ENTITY_TYPE,
        entityId: lead.id,
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
          note: optionalTrimmed(input.note),
          accountId: account.id,
          firstOrderAutoDerived,
        },
        afterData: {
          accountId: account.id,
          stage: 'customer_active',
          firstOrderAt: firstOrderAt.toISOString(),
          createdContactIds: createdContacts.map((contact) => contact.id),
          createdLocationIds,
          territoryId: account.territoryId ?? null,
          shippingCenterId: account.shippingCenterId ?? null,
          assignedTmUserId: account.assignedTmUserId ?? null,
          assignedRdUserId: account.assignedRdUserId ?? null,
        },
      }),
    });

    return {
      leadId: lead.id,
      accountId: account.id,
      contactIds: createdContacts.map((contact) => contact.id),
      locationIds: createdLocationIds,
      convertedAt: new Date(),
    };
  });

  return {
    leadId: converted.leadId,
    accountId: converted.accountId,
    contactIds: converted.contactIds,
    locationIds: converted.locationIds,
    convertedAt: converted.convertedAt.toISOString(),
  };
}

type RefreshReadinessInput = {
  actorUserId?: string;
  sessionId?: string;
  actorRole?: string;
  actorType: string;
  markChecklistGenerated?: boolean;
};

async function refreshLeadReadinessState(
  tx: Prisma.TransactionClient,
  leadId: string,
  actor: RefreshReadinessInput,
): Promise<LeadReadinessDetail & { conversionPreparation: Prisma.LeadConversionPreparationGetPayload<Record<string, never>> }> {
  const lead = await loadReadinessContext(tx, leadId);
  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const conversionPreparation = await ensureLeadConversionPreparation(tx, lead);
  const checklist = lead.onboardingChecklist;
  const financeStatus: CisFinanceDecisionStatus | undefined = lead.cisPackages[0]?.financeDecision?.status;

  if (checklist) {
    await syncAutomaticChecklistItems(tx, {
      lead,
      conversionPreparation,
      financeStatus,
      checklistId: checklist.id,
    });
  }

  const refreshed = await loadReadinessContext(tx, leadId);
  if (!refreshed) {
    throw new Error(`Lead not found after readiness refresh: ${leadId}`);
  }

  const detail = toLeadReadinessDetail(refreshed);
  const nextReadinessStatus = toLeadReadinessStatusEnum(detail.summary.status);
  const nextChecklistStatus = toChecklistStatusEnum(detail.summary.checklistStatus);
  const readinessNotes = detail.blockers.length > 0 ? detail.blockers.join(' | ') : null;
  const priceClassResolvedAt = refreshed.conversionPreparation?.priceClassCode
    ? refreshed.readinessState?.priceClassResolvedAt ?? new Date()
    : null;
  const portalAccessGrantedAt = refreshed.conversionPreparation?.portalEligibilityStatus === PortalEligibilityStatus.PROVISIONED
    ? refreshed.readinessState?.portalAccessGrantedAt ?? new Date()
    : null;
  const financeApprovedAt = financeStatus === CisFinanceDecisionStatus.APPROVED
    ? refreshed.readinessState?.financeApprovedAt ?? new Date()
    : null;
  const firstOrderReadyAt = detail.summary.status === 'ready'
    ? refreshed.readinessState?.firstOrderReadyAt ?? new Date()
    : null;

  const readinessStateUpdateData: Prisma.LeadReadinessStateUncheckedUpdateInput = {
    status: nextReadinessStatus,
    financeApprovedAt,
    priceClassResolvedAt,
    portalAccessGrantedAt,
    firstOrderReadyAt,
    blockedReason: detail.blockers[0] ?? null,
    notes: readinessNotes,
    sourceCisPackageId: refreshed.cisPackages[0]?.id ?? refreshed.readinessState?.sourceCisPackageId ?? null,
  };
  if (actor.markChecklistGenerated) {
    readinessStateUpdateData.checklistGeneratedAt = refreshed.readinessState?.checklistGeneratedAt ?? new Date();
  }

  const readinessStateCreateData: Prisma.LeadReadinessStateCreateInput = {
    lead: {
      connect: { id: leadId },
    },
    status: nextReadinessStatus,
    ...(actor.markChecklistGenerated ? { checklistGeneratedAt: new Date() } : {}),
    ...(financeApprovedAt ? { financeApprovedAt } : {}),
    ...(priceClassResolvedAt ? { priceClassResolvedAt } : {}),
    ...(portalAccessGrantedAt ? { portalAccessGrantedAt } : {}),
    ...(firstOrderReadyAt ? { firstOrderReadyAt } : {}),
    ...(detail.blockers[0] ? { blockedReason: detail.blockers[0] } : {}),
    ...(readinessNotes ? { notes: readinessNotes } : {}),
    ...(refreshed.cisPackages[0]?.id
      ? {
          sourceCisPackage: {
            connect: {
              id: refreshed.cisPackages[0].id,
            },
          },
        }
      : {}),
  };

  await tx.leadReadinessState.upsert({
    where: { leadId },
    update: readinessStateUpdateData,
    create: readinessStateCreateData,
  });

  if (refreshed.onboardingChecklist) {
    await tx.onboardingChecklist.update({
      where: { leadId },
      data: {
        status: nextChecklistStatus,
        blockedReason: detail.blockers[0] ?? null,
        completedAt: nextChecklistStatus === OnboardingChecklistStatus.COMPLETED
          ? refreshed.onboardingChecklist.completedAt ?? new Date()
          : null,
      },
    });
  }

  const finalLead = await loadReadinessContext(tx, leadId);
  if (!finalLead || !finalLead.conversionPreparation) {
    throw new Error(`Lead readiness refresh failed for lead: ${leadId}`);
  }

  const finalDetail = toLeadReadinessDetail(finalLead);

  await tx.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.actorUserId,
      action: AuditAction.UPDATE,
      entityType: LEAD_READINESS_ENTITY_TYPE,
      entityId: leadId,
      metadata: {
        actorRole: actor.actorRole,
        actorType: actor.actorType,
        sessionId: actor.sessionId,
      },
      afterData: {
        status: finalDetail.summary.status,
        checklistStatus: finalDetail.summary.checklistStatus,
        blockers: finalDetail.blockers,
      },
    }),
  });

  return {
    ...finalDetail,
    conversionPreparation: finalLead.conversionPreparation,
  };
}

async function loadReadinessContext(tx: Prisma.TransactionClient | typeof prisma, leadId: string) {
  return tx.lead.findUnique({
    where: { id: leadId },
    include: {
      readinessState: true,
      onboardingChecklist: {
        include: {
          items: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
        },
      },
      leadContacts: {
        orderBy: [
          { isPrimary: 'desc' },
          { createdAt: 'asc' },
        ],
      },
      conversionPreparation: true,
      cisPackages: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
        include: {
          formData: true,
          financeDecision: true,
        },
      },
      convertedAccount: true,
    },
  });
}

async function ensureLeadConversionPreparation(
  tx: Prisma.TransactionClient,
  lead: ReadinessContext,
) {
  if (lead.conversionPreparation) {
    return lead.conversionPreparation;
  }

  const latestCis = lead.cisPackages[0];
  const defaultShippingAddress = latestCis?.formData
      ? buildAddressSnapshot({
        name: lead.companyName,
        line1: latestCis.formData.physicalAddress ?? undefined,
        city: latestCis.formData.physicalCity ?? undefined,
        state: latestCis.formData.physicalState ?? undefined,
        postalCode: latestCis.formData.physicalZip ?? undefined,
        countryCode: latestCis.formData.physicalCountryCode ?? undefined,
      })
    : null;
  const defaultBillingAddress = latestCis?.formData
      ? buildAddressSnapshot({
        name: 'Billing',
        line1: latestCis.formData.billingAddress ?? undefined,
        city: latestCis.formData.billingCity ?? undefined,
        state: latestCis.formData.billingState ?? undefined,
        postalCode: latestCis.formData.billingZip ?? undefined,
        countryCode: latestCis.formData.billingCountryCode ?? undefined,
      })
    : null;

  return tx.leadConversionPreparation.create({
    data: {
      leadId: lead.id,
      targetAccountName: latestCis?.formData?.legalCompanyName ?? lead.companyName,
      legalCompanyName: latestCis?.formData?.legalCompanyName ?? lead.companyName,
      accountType: latestCis?.formData?.typeOfBusiness ?? null,
      shippingAddressSnapshot: defaultShippingAddress ? toJsonValue(defaultShippingAddress) : Prisma.JsonNull,
      billingAddressSnapshot: defaultBillingAddress ? toJsonValue(defaultBillingAddress) : Prisma.JsonNull,
      portalEligibilityStatus: PortalEligibilityStatus.UNASSESSED,
    },
  });
}

async function upsertLeadContactsFromLeadAndCis(
  tx: Prisma.TransactionClient,
  lead: ReadinessContext,
) {
  const latestCis = lead.cisPackages[0];
  const upserts: Array<() => Promise<unknown>> = [];

  if (lead.contactDisplayName || lead.email || lead.phone) {
    upserts.push(
      () => upsertLeadContactForRole(tx, lead.id, LeadContactRole.PRIMARY, LeadContactSource.LEAD_CAPTURE, {
        displayName: lead.contactDisplayName || lead.companyName,
        email: lead.email ?? undefined,
        phone: lead.phone ?? undefined,
        isPrimary: true,
      }),
    );
  }

  if (latestCis?.formData) {
    const form = latestCis.formData;
    if (form.primaryContactName || form.primaryContactEmail || form.primaryContactCellPhone) {
      upserts.push(
        () => upsertLeadContactForRole(tx, lead.id, LeadContactRole.PRIMARY, LeadContactSource.CIS_PRIMARY, {
          displayName: form.primaryContactName || lead.contactDisplayName || lead.companyName,
          title: form.primaryContactTitle ?? undefined,
          email: form.primaryContactEmail ?? undefined,
          mobilePhone: form.primaryContactCellPhone ?? undefined,
          isPrimary: true,
        }),
      );
    }

    if (form.ownerManagerName || form.ownerManagerEmail || form.ownerManagerCellPhone) {
      upserts.push(
        () => upsertLeadContactForRole(tx, lead.id, LeadContactRole.OWNER_MANAGER, LeadContactSource.CIS_OWNER_MANAGER, {
          displayName: form.ownerManagerName || lead.companyName,
          title: form.ownerManagerTitle ?? undefined,
          email: form.ownerManagerEmail ?? undefined,
          mobilePhone: form.ownerManagerCellPhone ?? undefined,
        }),
      );
    }

    if (form.orderingContactName || form.orderingContactEmail || form.orderingContactCellPhone) {
      upserts.push(
        () => upsertLeadContactForRole(tx, lead.id, LeadContactRole.ORDERING, LeadContactSource.CIS_ORDERING, {
          displayName: form.orderingContactName || lead.companyName,
          email: form.orderingContactEmail ?? undefined,
          mobilePhone: form.orderingContactCellPhone ?? undefined,
        }),
      );
    }

    if (form.apContactName || form.apEmail || form.apDirectPhone) {
      upserts.push(
        () => upsertLeadContactForRole(tx, lead.id, LeadContactRole.ACCOUNTS_PAYABLE, LeadContactSource.CIS_ACCOUNTS_PAYABLE, {
          displayName: form.apContactName || lead.companyName,
          email: form.apEmail ?? undefined,
          phone: form.apDirectPhone ?? undefined,
        }),
      );
    }
  }

  for (const runUpsert of upserts) {
    await runUpsert();
  }
}

async function upsertLeadContactForRole(
  tx: Prisma.TransactionClient,
  leadId: string,
  role: LeadContactRole,
  source: LeadContactSource,
  input: LeadContactUpsertInput,
) {
  const existing = await tx.leadContact.findFirst({
    where: {
      leadId,
      role,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const { firstName, lastName } = splitDisplayName(input.displayName);

  if (input.isPrimary) {
    await tx.leadContact.updateMany({
      where: {
        leadId,
        isPrimary: true,
        ...(existing ? { id: { not: existing.id } } : {}),
      },
      data: {
        isPrimary: false,
      },
    });
  }

  if (existing) {
    return tx.leadContact.update({
      where: { id: existing.id },
      data: {
        source,
        displayName: input.displayName,
        firstName: firstName ?? null,
        lastName,
        title: input.title ?? existing.title,
        email: input.email?.toLowerCase() ?? existing.email,
        phone: input.phone ?? existing.phone,
        mobilePhone: input.mobilePhone ?? existing.mobilePhone,
        isPrimary: input.isPrimary ?? existing.isPrimary,
      },
    });
  }

  return tx.leadContact.create({
    data: {
      leadId,
      role,
      source,
      displayName: input.displayName,
      firstName: firstName ?? null,
      lastName,
      ...(input.title ? { title: input.title } : {}),
      ...(input.email ? { email: input.email.toLowerCase() } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.mobilePhone ? { mobilePhone: input.mobilePhone } : {}),
      isPrimary: input.isPrimary ?? role === LeadContactRole.PRIMARY,
    },
  });
}

async function syncAutomaticChecklistItems(
  tx: Prisma.TransactionClient,
  input: {
    lead: ReadinessContext;
    checklistId: string;
    financeStatus: CisFinanceDecisionStatus | undefined;
    conversionPreparation: Prisma.LeadConversionPreparationGetPayload<Record<string, never>>;
  },
) {
  const contactsMapped = input.lead.leadContacts.length > 0;
  const consignmentCaptured = Boolean(input.lead.consignmentInterestStatus);
  const priceClassAssigned = Boolean(input.conversionPreparation.priceClassCode);
  const portalGranted = input.conversionPreparation.portalEligibilityStatus === PortalEligibilityStatus.PROVISIONED;

  for (const template of CHECKLIST_TEMPLATE) {
    let status: OnboardingChecklistItemStatus | undefined;
    switch (template.code) {
      case 'finance_approved':
        status = input.financeStatus === CisFinanceDecisionStatus.APPROVED
          ? OnboardingChecklistItemStatus.COMPLETED
          : input.financeStatus === CisFinanceDecisionStatus.CONDITIONAL
            ? OnboardingChecklistItemStatus.BLOCKED
            : OnboardingChecklistItemStatus.PENDING;
        break;
      case 'lead_contacts_mapped':
        status = contactsMapped ? OnboardingChecklistItemStatus.COMPLETED : OnboardingChecklistItemStatus.PENDING;
        break;
      case 'price_class_assigned':
        status = priceClassAssigned ? OnboardingChecklistItemStatus.COMPLETED : OnboardingChecklistItemStatus.PENDING;
        break;
      case 'portal_access_granted':
        status = portalGranted ? OnboardingChecklistItemStatus.COMPLETED : OnboardingChecklistItemStatus.PENDING;
        break;
      case 'consignment_interest_captured':
        status = consignmentCaptured ? OnboardingChecklistItemStatus.COMPLETED : OnboardingChecklistItemStatus.NOT_REQUIRED;
        break;
      default:
        status = undefined;
    }

    if (!status) {
      continue;
    }

    await tx.onboardingChecklistItem.updateMany({
      where: {
        checklistId: input.checklistId,
        code: template.code,
      },
      data: {
        status,
        completedAt: status === OnboardingChecklistItemStatus.COMPLETED ? new Date() : null,
        completedByUserId: null,
        ...(status === OnboardingChecklistItemStatus.BLOCKED
          ? { notes: 'Requires manual follow-through before onboarding can proceed.' }
          : {}),
      },
    });
  }
}

function toLeadReadinessDetail(lead: ReadinessContext): LeadReadinessDetail {
  const items = (lead.onboardingChecklist?.items ?? []).map(toLeadReadinessItemSummary);
  const blockers = buildReadinessBlockers(lead, items);
  const requiredItemCount = items.filter((item) => item.required).length;
  const completedRequiredItemCount = items.filter((item) => item.required && item.status === 'completed').length;
  const blockingItemCount = items.filter((item) => item.required && item.status !== 'completed' && item.status !== 'not_required').length;
  const readinessStatus = resolveLeadReadinessStatus(lead, items, blockers);
  const checklistStatus = resolveChecklistStatus(items);

  return {
    summary: {
      leadId: lead.id,
      status: readinessStatus,
      checklistStatus,
      ...(lead.readinessState?.checklistGeneratedAt ? { checklistGeneratedAt: lead.readinessState.checklistGeneratedAt.toISOString() } : {}),
      ...(lead.readinessState?.financeApprovedAt ? { financeApprovedAt: lead.readinessState.financeApprovedAt.toISOString() } : {}),
      ...(lead.readinessState?.priceClassResolvedAt ? { priceClassResolvedAt: lead.readinessState.priceClassResolvedAt.toISOString() } : {}),
      ...(lead.readinessState?.portalAccessGrantedAt ? { portalAccessGrantedAt: lead.readinessState.portalAccessGrantedAt.toISOString() } : {}),
      ...(lead.readinessState?.firstOrderReadyAt ? { firstOrderReadyAt: lead.readinessState.firstOrderReadyAt.toISOString() } : {}),
      ...(lead.readinessState?.convertedAt ? { convertedAt: lead.readinessState.convertedAt.toISOString() } : {}),
      ...(lead.readinessState?.blockedReason ? { blockedReason: lead.readinessState.blockedReason } : {}),
      ...(lead.readinessState?.notes ? { notes: lead.readinessState.notes } : {}),
      ...(lead.readinessState?.sourceCisPackageId ? { sourceCisPackageId: lead.readinessState.sourceCisPackageId } : {}),
      requiredItemCount,
      completedRequiredItemCount,
      blockingItemCount,
    },
    items,
    blockers,
  };
}

function buildReadinessBlockers(
  lead: ReadinessContext,
  items: LeadReadinessItemSummary[],
) {
  const blockers: string[] = [];
  const financeStatus = lead.cisPackages[0]?.financeDecision?.status;
  const prep = lead.conversionPreparation;
  const incompleteRequiredItems = items.filter((item) => item.required && item.status !== 'completed');

  if (!lead.onboardingChecklist) {
    blockers.push('Readiness checklist has not been generated yet.');
  }

  if (financeStatus === CisFinanceDecisionStatus.CONDITIONAL) {
    blockers.push('Finance approval is conditional and still requires follow-through.');
  }
  if (financeStatus !== CisFinanceDecisionStatus.APPROVED && financeStatus !== CisFinanceDecisionStatus.CONDITIONAL) {
    blockers.push('Finance approval is not complete.');
  }

  for (const item of incompleteRequiredItems) {
    const statusLabel = item.status === 'blocked' ? 'blocked' : 'pending';
    blockers.push(`${item.label} is ${statusLabel}.`);
  }

  if (!prep?.targetAccountName) {
    blockers.push('Target account name is not set.');
  }
  if (!prep?.legalCompanyName) {
    blockers.push('Legal company name is not set.');
  }
  if (!prep?.priceClassCode) {
    blockers.push('Price class is not assigned.');
  }
  if (!prep?.shippingAddressSnapshot || !hasMeaningfulAddress(prep.shippingAddressSnapshot)) {
    blockers.push('Primary shipping/service address is incomplete.');
  }
  if (prep?.portalEligibilityStatus === PortalEligibilityStatus.BLOCKED) {
    blockers.push('Portal eligibility is blocked.');
  }
  if (!lead.leadContacts.length) {
    blockers.push('Lead contacts have not been mapped yet.');
  }

  return [...new Set(blockers)];
}

function resolveLeadReadinessStatus(
  lead: ReadinessContext,
  items: LeadReadinessItemSummary[],
  blockers: string[],
): LeadReadinessSummary['status'] {
  if (lead.convertedAccount || lead.readinessState?.status === LeadReadinessStatus.CONVERTED) {
    return 'converted';
  }
  if (!lead.onboardingChecklist) {
    return 'not_started';
  }
  if (items.length === 0) {
    return 'not_started';
  }
  if (blockers.length > 0 && items.some((item) => item.status === 'blocked')) {
    return 'blocked';
  }
  if (items.every((item) => !item.required || item.status === 'completed' || item.status === 'not_required') && blockers.length === 0) {
    return 'ready';
  }

  return 'in_progress';
}

function resolveChecklistStatus(items: LeadReadinessItemSummary[]): LeadReadinessSummary['checklistStatus'] {
  if (items.length === 0) {
    return 'not_started';
  }
  if (items.some((item) => item.required && item.status === 'blocked')) {
    return 'blocked';
  }
  if (items.every((item) => !item.required || item.status === 'completed' || item.status === 'not_required')) {
    return 'completed';
  }

  return 'in_progress';
}

function toLeadReadinessItemSummary(
  item: Prisma.OnboardingChecklistItemGetPayload<Record<string, never>>,
): LeadReadinessItemSummary {
  return {
    id: item.id,
    code: item.code,
    label: item.label,
    ...(item.ownerRoleCode ? { ownerRoleCode: item.ownerRoleCode } : {}),
    ...(item.ownerUserId ? { ownerUserId: item.ownerUserId } : {}),
    status: toChecklistItemStatusKey(item.status),
    required: item.required,
    sortOrder: item.sortOrder,
    ...(item.dueAt ? { dueAt: item.dueAt.toISOString() } : {}),
    ...(item.completedAt ? { completedAt: item.completedAt.toISOString() } : {}),
    ...(item.completedByUserId ? { completedByUserId: item.completedByUserId } : {}),
    ...(item.notes ? { notes: item.notes } : {}),
  };
}

function toLeadConversionPreparationRecord(
  record: Prisma.LeadConversionPreparationGetPayload<Record<string, never>>,
): LeadConversionPreparationRecord {
  const shippingAddressSnapshot = toAddressSnapshotInput(record.shippingAddressSnapshot);
  const billingAddressSnapshot = toAddressSnapshotInput(record.billingAddressSnapshot);

  return {
    leadId: record.leadId,
    status: toLeadConversionPreparationStatusKey(record.status),
    ...(record.targetAccountName ? { targetAccountName: record.targetAccountName } : {}),
    ...(record.legalCompanyName ? { legalCompanyName: record.legalCompanyName } : {}),
    ...(record.accountType ? { accountType: record.accountType } : {}),
    ...(record.financeAuthorityMode ? { financeAuthorityMode: record.financeAuthorityMode } : {}),
    ...(record.priceClassCode ? { priceClassCode: record.priceClassCode } : {}),
    portalEligibilityStatus: toPortalEligibilityStatusKey(record.portalEligibilityStatus),
    ...(shippingAddressSnapshot ? { shippingAddressSnapshot } : {}),
    ...(billingAddressSnapshot ? { billingAddressSnapshot } : {}),
    conversionReady: record.conversionReady,
    ...(record.conversionBlockedReason ? { conversionBlockedReason: record.conversionBlockedReason } : {}),
    ...(record.notes ? { notes: record.notes } : {}),
    ...(record.validatedAt ? { validatedAt: record.validatedAt.toISOString() } : {}),
    ...(record.reviewedAt ? { reviewedAt: record.reviewedAt.toISOString() } : {}),
    ...(record.reviewedByUserId ? { reviewedByUserId: record.reviewedByUserId } : {}),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toLeadContactSummary(
  contact: Prisma.LeadContactGetPayload<Record<string, never>>,
): LeadContactSummary {
  return {
    id: contact.id,
    leadId: contact.leadId,
    role: toLeadContactRoleKey(contact.role),
    ...(contact.source ? { source: toLeadContactSourceKey(contact.source) } : {}),
    displayName: contact.displayName,
    ...(contact.firstName ? { firstName: contact.firstName } : {}),
    ...(contact.lastName ? { lastName: contact.lastName } : {}),
    ...(contact.title ? { title: contact.title } : {}),
    ...(contact.email ? { email: contact.email } : {}),
    ...(contact.phone ? { phone: contact.phone } : {}),
    ...(contact.mobilePhone ? { mobilePhone: contact.mobilePhone } : {}),
    isPrimary: contact.isPrimary,
    isActive: contact.isActive,
    ...(contact.notes ? { notes: contact.notes } : {}),
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

async function fallbackLeadContacts(tx: Prisma.TransactionClient, lead: ReadinessContext) {
  const fallbackDisplayName = lead.contactDisplayName || lead.companyName;
  const existing = await tx.leadContact.findMany({
    where: { leadId: lead.id },
  });
  if (existing.length > 0) {
    return existing;
  }

  const { firstName, lastName } = splitDisplayName(fallbackDisplayName);
  const created = await tx.leadContact.create({
    data: {
      leadId: lead.id,
      role: LeadContactRole.PRIMARY,
      source: LeadContactSource.LEAD_CAPTURE,
      displayName: fallbackDisplayName,
      firstName,
      lastName,
      ...(lead.email ? { email: lead.email } : {}),
      ...(lead.phone ? { phone: lead.phone } : {}),
      isPrimary: true,
    },
  });

  return [created];
}

function buildAddressSnapshot(input: AddressSnapshotInput): LeadAddressSnapshot | null {
  const snapshot = sanitizeAddressSnapshot(input);
  return snapshot && hasMeaningfulAddress(snapshot) ? snapshot : null;
}

function sanitizeAddressSnapshot(input: AddressSnapshotInput): LeadAddressSnapshot | null {
  const line1 = optionalTrimmed(input.line1);
  const line2 = optionalTrimmed(input.line2);
  const city = optionalTrimmed(input.city);
  const state = optionalTrimmed(input.state);
  const postalCode = optionalTrimmed(input.postalCode);
  const countryCode = optionalTrimmed(input.countryCode)?.toUpperCase();
  const name = optionalTrimmed(input.name);

  if (!name && !line1 && !line2 && !city && !state && !postalCode && !countryCode) {
    return null;
  }

  return {
    ...(name ? { name } : {}),
    ...(line1 ? { line1 } : {}),
    ...(line2 ? { line2 } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(postalCode ? { postalCode } : {}),
    ...(countryCode ? { countryCode } : {}),
  };
}

function toAddressSnapshotInput(value: Prisma.JsonValue | null | undefined): LeadAddressSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return sanitizeAddressSnapshot({
    name: typeof record.name === 'string' ? record.name : undefined,
    line1: typeof record.line1 === 'string' ? record.line1 : undefined,
    line2: typeof record.line2 === 'string' ? record.line2 : undefined,
    city: typeof record.city === 'string' ? record.city : undefined,
    state: typeof record.state === 'string' ? record.state : undefined,
    postalCode: typeof record.postalCode === 'string' ? record.postalCode : undefined,
    countryCode: typeof record.countryCode === 'string' ? record.countryCode : undefined,
  });
}

function hasMeaningfulAddress(address: LeadAddressSnapshot | Prisma.JsonValue | null | undefined) {
  const normalized = isAddressSnapshot(address) ? address : toAddressSnapshotInput(address);
  return Boolean(normalized?.line1 || normalized?.city || normalized?.state || normalized?.postalCode);
}

function addressesEqual(left: LeadAddressSnapshot | null, right: LeadAddressSnapshot | null) {
  if (!left || !right) {
    return false;
  }

  return (
    (left.line1 ?? '') === (right.line1 ?? '')
    && (left.line2 ?? '') === (right.line2 ?? '')
    && (left.city ?? '') === (right.city ?? '')
    && (left.state ?? '') === (right.state ?? '')
    && (left.postalCode ?? '') === (right.postalCode ?? '')
    && (left.countryCode ?? 'US') === (right.countryCode ?? 'US')
  );
}

function isAddressSnapshot(value: unknown): value is LeadAddressSnapshot {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function ensureNameParts(firstName: string | null | undefined, lastName: string | null | undefined, displayName: string): {
  firstName: string;
  lastName: string;
} {
  const normalizedFirstName = optionalTrimmed(firstName ?? undefined);
  const normalizedLastName = optionalTrimmed(lastName ?? undefined);

  if (normalizedFirstName && normalizedLastName) {
    return {
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
    };
  }

  const split = splitDisplayName(displayName);
  return {
    firstName: normalizedFirstName ?? split.firstName,
    lastName: normalizedLastName ?? split.lastName,
  };
}

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const normalized = displayName.trim();
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: 'Unknown', lastName: 'Contact' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0] ?? 'Unknown', lastName: 'Contact' };
  }

  return {
    firstName: parts[0] ?? 'Unknown',
    lastName: parts.slice(1).join(' ') || 'Contact',
  };
}

function parseOptionalDate(value: string | undefined, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }
  if (!value) {
    return null;
  }

  return parseRequiredDate(value, fieldName);
}

function parseRequiredDate(value: string, fieldName: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO timestamp`);
  }

  return parsed;
}

function optionalTrimmed(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toLeadReadinessStatusEnum(status: LeadReadinessSummary['status']) {
  switch (status) {
    case 'not_started':
      return LeadReadinessStatus.NOT_STARTED;
    case 'in_progress':
      return LeadReadinessStatus.IN_PROGRESS;
    case 'blocked':
      return LeadReadinessStatus.BLOCKED;
    case 'ready':
      return LeadReadinessStatus.READY;
    case 'converted':
      return LeadReadinessStatus.CONVERTED;
    default:
      return assertNever(status);
  }
}

function toChecklistStatusEnum(status: LeadReadinessSummary['checklistStatus']) {
  switch (status) {
    case 'not_started':
      return OnboardingChecklistStatus.NOT_STARTED;
    case 'in_progress':
      return OnboardingChecklistStatus.IN_PROGRESS;
    case 'blocked':
      return OnboardingChecklistStatus.BLOCKED;
    case 'completed':
      return OnboardingChecklistStatus.COMPLETED;
    default:
      return assertNever(status);
  }
}

function toChecklistItemStatusEnum(status: NonNullable<UpdateLeadReadinessItemRequest['status']>) {
  switch (status) {
    case 'pending':
      return OnboardingChecklistItemStatus.PENDING;
    case 'in_progress':
      return OnboardingChecklistItemStatus.IN_PROGRESS;
    case 'blocked':
      return OnboardingChecklistItemStatus.BLOCKED;
    case 'completed':
      return OnboardingChecklistItemStatus.COMPLETED;
    case 'not_required':
      return OnboardingChecklistItemStatus.NOT_REQUIRED;
    default:
      return assertNever(status);
  }
}

function toChecklistItemStatusKey(status: OnboardingChecklistItemStatus): LeadReadinessItemSummary['status'] {
  switch (status) {
    case OnboardingChecklistItemStatus.PENDING:
      return 'pending';
    case OnboardingChecklistItemStatus.IN_PROGRESS:
      return 'in_progress';
    case OnboardingChecklistItemStatus.BLOCKED:
      return 'blocked';
    case OnboardingChecklistItemStatus.COMPLETED:
      return 'completed';
    case OnboardingChecklistItemStatus.NOT_REQUIRED:
      return 'not_required';
    default:
      return assertNever(status);
  }
}

function toLeadContactRoleEnum(role: LeadContactRoleKey) {
  switch (role) {
    case 'primary':
      return LeadContactRole.PRIMARY;
    case 'owner_manager':
      return LeadContactRole.OWNER_MANAGER;
    case 'ordering':
      return LeadContactRole.ORDERING;
    case 'accounts_payable':
      return LeadContactRole.ACCOUNTS_PAYABLE;
    case 'technical':
      return LeadContactRole.TECHNICAL;
    case 'other':
      return LeadContactRole.OTHER;
    default:
      return assertNever(role);
  }
}

function toLeadContactRoleKey(role: LeadContactRole): LeadContactRoleKey {
  switch (role) {
    case LeadContactRole.PRIMARY:
      return 'primary';
    case LeadContactRole.OWNER_MANAGER:
      return 'owner_manager';
    case LeadContactRole.ORDERING:
      return 'ordering';
    case LeadContactRole.ACCOUNTS_PAYABLE:
      return 'accounts_payable';
    case LeadContactRole.TECHNICAL:
      return 'technical';
    case LeadContactRole.OTHER:
      return 'other';
    default:
      return assertNever(role);
  }
}

function toLeadContactSourceEnum(source: LeadContactSourceKey) {
  switch (source) {
    case 'lead_capture':
      return LeadContactSource.LEAD_CAPTURE;
    case 'cis_primary':
      return LeadContactSource.CIS_PRIMARY;
    case 'cis_owner_manager':
      return LeadContactSource.CIS_OWNER_MANAGER;
    case 'cis_ordering':
      return LeadContactSource.CIS_ORDERING;
    case 'cis_accounts_payable':
      return LeadContactSource.CIS_ACCOUNTS_PAYABLE;
    case 'manual':
      return LeadContactSource.MANUAL;
    default:
      return assertNever(source);
  }
}

function toLeadContactSourceKey(source: LeadContactSource): LeadContactSourceKey {
  switch (source) {
    case LeadContactSource.LEAD_CAPTURE:
      return 'lead_capture';
    case LeadContactSource.CIS_PRIMARY:
      return 'cis_primary';
    case LeadContactSource.CIS_OWNER_MANAGER:
      return 'cis_owner_manager';
    case LeadContactSource.CIS_ORDERING:
      return 'cis_ordering';
    case LeadContactSource.CIS_ACCOUNTS_PAYABLE:
      return 'cis_accounts_payable';
    case LeadContactSource.MANUAL:
      return 'manual';
    default:
      return assertNever(source);
  }
}

function toPortalEligibilityStatusEnum(
  status: NonNullable<UpdateLeadConversionPreparationRequest['portalEligibilityStatus']>,
) {
  switch (status) {
    case 'unassessed':
      return PortalEligibilityStatus.UNASSESSED;
    case 'blocked':
      return PortalEligibilityStatus.BLOCKED;
    case 'ready':
      return PortalEligibilityStatus.READY;
    case 'provisioned':
      return PortalEligibilityStatus.PROVISIONED;
    default:
      return assertNever(status);
  }
}

function toPortalEligibilityStatusKey(status: PortalEligibilityStatus): LeadConversionPreparationRecord['portalEligibilityStatus'] {
  switch (status) {
    case PortalEligibilityStatus.UNASSESSED:
      return 'unassessed';
    case PortalEligibilityStatus.BLOCKED:
      return 'blocked';
    case PortalEligibilityStatus.READY:
      return 'ready';
    case PortalEligibilityStatus.PROVISIONED:
      return 'provisioned';
    default:
      return assertNever(status);
  }
}

function toLeadConversionPreparationStatusKey(
  status: LeadConversionPreparationStatus,
): LeadConversionPreparationRecord['status'] {
  switch (status) {
    case LeadConversionPreparationStatus.DRAFT:
      return 'draft';
    case LeadConversionPreparationStatus.VALIDATED:
      return 'validated';
    case LeadConversionPreparationStatus.BLOCKED:
      return 'blocked';
    case LeadConversionPreparationStatus.CONVERTED:
      return 'converted';
    default:
      return assertNever(status);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
