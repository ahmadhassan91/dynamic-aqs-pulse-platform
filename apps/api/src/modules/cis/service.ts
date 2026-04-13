import crypto from 'node:crypto';
import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import {
  AuditAction,
  CisEntryMethod,
  CisEsignStatus,
  CisFinanceDecisionStatus,
  CisPackageStatus,
  CisPaymentMethod,
  CisPaymentTerms,
  CisPaymentStatus,
  LeadStage,
  Prisma,
  prisma,
} from '@pulse/db';
import type {
  CisFinanceDecisionRecord,
  CisFinanceDecisionRequest,
  CisFormDataRecord,
  CisFormDraftInput,
  CisInternalReviewRecord,
  CisLinkIssueRequest,
  CisLinkIssueResponse,
  CisPackageDetail,
  CisPackageEventSummary,
  CisPackageSummary,
  CisPublicPackage,
  CisReviewSignoffRequest,
  CisSubmitToFinanceRequest,
  FinanceQueueItem,
  ListFinanceQueueRequest,
  ListFinanceQueueResponse,
  SavePublicCisDraftRequest,
  SubmitPublicCisRequest,
} from '@pulse/contracts';
import type { AppConfig } from '../../config.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import type { AuthenticatedActor } from '../auth/types.js';

const CIS_PACKAGE_ENTITY_TYPE = 'CIS_PACKAGE';
const DEFAULT_LINK_EXPIRY_DAYS = 30;

const ACTIVE_EDITABLE_CIS_STATUSES = new Set<CisPackageStatus>([
  CisPackageStatus.NOT_SENT,
  CisPackageStatus.LINK_SENT,
  CisPackageStatus.DRAFT_IN_PROGRESS,
]);

type CisPackageWithRelations = Prisma.CisPackageGetPayload<{
  include: {
    lead: true;
    formData: true;
    internalReview: true;
    financeDecision: true;
    events: {
      orderBy: {
        occurredAt: 'desc';
      };
    };
  };
}>;

type MutableCisFormSnapshot = {
  companyWebsite?: string;
  numOfTechs?: number;
  numOfInstallTechs?: number;
  numOfSalespeopleAdvisors?: number;
  affinityGroupOrFranchise?: string;
  isPrivateEquity?: boolean;
  parentCompanyName?: string;
  primaryContactName?: string;
  primaryContactTitle?: string;
  primaryContactEmail?: string;
  primaryContactCellPhone?: string;
  ownerManagerName?: string;
  ownerManagerTitle?: string;
  ownerManagerEmail?: string;
  ownerManagerCellPhone?: string;
  legalCompanyName?: string;
  physicalAddress?: string;
  physicalCity?: string;
  physicalState?: string;
  physicalZip?: string;
  physicalCountryCode?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  billingCountryCode?: string;
  companyPhone?: string;
  typeOfBusiness?: string;
  yearsInBusiness?: number;
  monthsInBusiness?: number;
  orderingContactName?: string;
  orderingContactCellPhone?: string;
  orderingContactEmail?: string;
  apContactName?: string;
  apDirectPhone?: string;
  apEmail?: string;
  paymentMethod?: CisPaymentMethod;
  achAuthorized?: boolean;
  cardOnFileAuthorized?: boolean;
  resaleCertificateAttached?: boolean;
  hasSignature?: boolean;
  signatureCapturedAt?: Date;
  submittedByProspectAt?: Date;
  lastSavedAt?: Date;
};

export async function issueCisLink(
  actor: AuthenticatedActor,
  leadId: string,
  input: CisLinkIssueRequest,
  config: AppConfig,
): Promise<CisLinkIssueResponse> {
  assertModuleAccess(actor.role, 'cis');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const recipientEmail = optionalTrimmed(input.recipientEmail);
  const note = optionalTrimmed(input.note);
  const token = createPublicToken();
  const tokenHash = hashPublicToken(token);
  const now = new Date();
  const expiresAt = addDays(now, DEFAULT_LINK_EXPIRY_DAYS);

  const cisPackage: CisPackageWithRelations = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
    });
    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    const existing = await tx.cisPackage.findFirst({
      where: {
        leadId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        lead: true,
        formData: true,
        internalReview: true,
        financeDecision: true,
        events: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
    });

    const formPrefill = existing?.formData ? null : buildLeadPrefill(lead);
    const shouldReuse =
      existing
      && existing.entryMethod === CisEntryMethod.DIGITAL_LINK
      && ACTIVE_EDITABLE_CIS_STATUSES.has(existing.status);

    const packageRecord = shouldReuse
      ? await tx.cisPackage.update({
          where: { id: existing.id },
          data: {
            status: CisPackageStatus.LINK_SENT,
            externalLinkTokenHash: tokenHash,
            externalLinkExpiresAt: expiresAt,
            externalLinkLastSentAt: now,
            externalLinkSentCount: {
              increment: 1,
            },
            ...(note !== undefined ? { notes: note } : {}),
          },
          include: {
            lead: true,
            formData: true,
            internalReview: true,
            financeDecision: true,
            events: {
              orderBy: {
                occurredAt: 'desc',
              },
            },
          },
        })
      : await tx.cisPackage.create({
          data: {
            leadId,
            entryMethod: CisEntryMethod.DIGITAL_LINK,
            status: CisPackageStatus.LINK_SENT,
            externalLinkTokenHash: tokenHash,
            externalLinkExpiresAt: expiresAt,
            externalLinkLastSentAt: now,
            externalLinkSentCount: 1,
            ...(note !== undefined ? { notes: note } : {}),
            formData: {
              create: formPrefill ?? buildLeadPrefill(lead),
            },
          },
          include: {
            lead: true,
            formData: true,
            internalReview: true,
            financeDecision: true,
            events: {
              orderBy: {
                occurredAt: 'desc',
              },
            },
          },
        });

    await tx.cisPackageEvent.create({
      data: {
        cisPackageId: packageRecord.id,
        eventType: shouldReuse ? 'link_resent' : 'link_sent',
        fromStatus: shouldReuse ? existing?.status : null,
        toStatus: CisPackageStatus.LINK_SENT,
        actorUserId: actor.userId,
        actorType: actor.actorType,
        note: note ?? null,
        metadata: toJsonValue({
          recipientEmail: recipientEmail ?? lead.email ?? null,
          deliveryMode: 'manual_copy',
        }),
      },
    });

    const leadUpdateData: Prisma.LeadUpdateInput = {};
    const shouldAdvanceLeadStage =
      lead.stage !== LeadStage.CIS_SENT
      && lead.stage !== LeadStage.CIS_SIGNED
      && lead.stage !== LeadStage.ONBOARDING_COMPLETED
      && lead.stage !== LeadStage.CUSTOMER_ACTIVE;
    if (shouldAdvanceLeadStage) {
      leadUpdateData.stage = LeadStage.CIS_SENT;
    }
    if (!lead.cisSentAt) {
      leadUpdateData.cisSentAt = now;
    }

    if (Object.keys(leadUpdateData).length > 0) {
      await tx.lead.update({
        where: { id: lead.id },
        data: leadUpdateData,
      });

      if (shouldAdvanceLeadStage) {
        await tx.leadStageEvent.create({
          data: {
            leadId: lead.id,
            actorUserId: actor.userId,
            fromStage: lead.stage,
            toStage: LeadStage.CIS_SENT,
            note: shouldReuse ? 'CIS link resent' : 'CIS link issued',
            metadata: toJsonValue({
              cisPackageId: packageRecord.id,
            }),
          },
        });
      }
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: shouldReuse ? AuditAction.UPDATE : AuditAction.CREATE,
        entityType: CIS_PACKAGE_ENTITY_TYPE,
        entityId: packageRecord.id,
        metadata: {
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
          leadId: packageRecord.leadId,
          deliveryMode: 'manual_copy',
          recipientEmail: recipientEmail ?? packageRecord.lead.email ?? null,
        },
        afterData: {
          status: packageRecord.status,
          externalLinkExpiresAt: packageRecord.externalLinkExpiresAt?.toISOString() ?? null,
          externalLinkSentCount: packageRecord.externalLinkSentCount,
        },
      }),
    });

    return packageRecord;
  });

  return {
    cisPackage: toCisPackageSummary(cisPackage),
    publicUrl: buildPublicCisUrl(config, token),
    expiresAt: expiresAt.toISOString(),
    deliveryMode: 'manual_copy',
    ...(recipientEmail !== undefined ? { recipientEmail } : {}),
  };
}

export async function getLeadCisPackage(actor: AuthenticatedActor, leadId: string): Promise<CisPackageDetail | null> {
  assertModuleAccess(actor.role, 'cis');
  assertActionAccess(actor.role, 'lead.view');

  const cisPackage = await prisma.cisPackage.findFirst({
    where: {
      leadId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      lead: true,
      formData: true,
      internalReview: true,
      financeDecision: true,
      events: {
        orderBy: {
          occurredAt: 'desc',
        },
      },
    },
  });

  return cisPackage ? toCisPackageDetail(cisPackage) : null;
}

export async function getCisPackageDetail(actor: AuthenticatedActor, cisPackageId: string): Promise<CisPackageDetail | null> {
  assertModuleAccess(actor.role, 'cis');
  assertActionAccess(actor.role, 'lead.view');

  const cisPackage = await prisma.cisPackage.findUnique({
    where: { id: cisPackageId },
    include: {
      lead: true,
      formData: true,
      internalReview: true,
      financeDecision: true,
      events: {
        orderBy: {
          occurredAt: 'desc',
        },
      },
    },
  });

  return cisPackage ? toCisPackageDetail(cisPackage) : null;
}

export async function reviewAndSignOffCis(
  actor: AuthenticatedActor,
  cisPackageId: string,
  input: CisReviewSignoffRequest,
): Promise<CisPackageDetail> {
  assertModuleAccess(actor.role, 'cis');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const salesReviewNotes = optionalTrimmed(input.salesReviewNotes);
  const financeCoverNotes = optionalTrimmed(input.financeCoverNotes);

  const cisPackage = await prisma.$transaction(async (tx) => {
    const existing = await tx.cisPackage.findUnique({
      where: { id: cisPackageId },
      include: {
        lead: true,
        formData: true,
        internalReview: true,
        financeDecision: true,
        events: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
    });
    if (!existing) {
      throw new Error(`CIS package not found: ${cisPackageId}`);
    }
    if (existing.status !== CisPackageStatus.SUBMITTED && existing.status !== CisPackageStatus.REVIEW_IN_PROGRESS && existing.status !== CisPackageStatus.SALES_SIGNED_OFF) {
      throw new Error('CIS package is not ready for Sales/BD sign-off');
    }

    const now = new Date();
    const updated = await tx.cisPackage.update({
      where: { id: existing.id },
      data: {
        status: CisPackageStatus.SALES_SIGNED_OFF,
        reviewStartedAt: existing.reviewStartedAt ?? now,
        salesSignedOffAt: now,
        internalReview: {
          upsert: {
            create: {
              reviewStartedByUserId: actor.userId,
              salesReviewNotes: salesReviewNotes ?? null,
              salesSignedOffByUserId: actor.userId,
              salesSignedOffAt: now,
              financeCoverNotes: financeCoverNotes ?? null,
            },
            update: {
              reviewStartedByUserId: existing.internalReview?.reviewStartedByUserId ?? actor.userId,
              ...(salesReviewNotes !== undefined ? { salesReviewNotes } : {}),
              salesSignedOffByUserId: actor.userId,
              salesSignedOffAt: now,
              ...(financeCoverNotes !== undefined ? { financeCoverNotes } : {}),
            },
          },
        },
      },
      include: {
        lead: true,
        formData: true,
        internalReview: true,
        financeDecision: true,
        events: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
    });

    await tx.cisPackageEvent.create({
      data: {
        cisPackageId: updated.id,
        eventType: 'sales_signed_off',
        fromStatus: existing.status,
        toStatus: CisPackageStatus.SALES_SIGNED_OFF,
        actorUserId: actor.userId,
        actorType: actor.actorType,
        note: salesReviewNotes ?? financeCoverNotes ?? null,
      },
    });

    if (updated.lead.stage === LeadStage.CIS_SENT) {
      await tx.lead.update({
        where: { id: updated.leadId },
        data: {
          stage: LeadStage.CIS_SIGNED,
          cisSignedAt: now,
        },
      });

      await tx.leadStageEvent.create({
        data: {
          leadId: updated.leadId,
          actorUserId: actor.userId,
          fromStage: LeadStage.CIS_SENT,
          toStage: LeadStage.CIS_SIGNED,
          note: 'Sales/BD reviewed and signed off the CIS package',
          metadata: toJsonValue({
            cisPackageId: updated.id,
          }),
        },
      });
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.APPROVE,
        entityType: CIS_PACKAGE_ENTITY_TYPE,
        entityId: updated.id,
        metadata: {
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
          leadId: updated.leadId,
        },
        afterData: {
          status: updated.status,
          salesSignedOffAt: updated.salesSignedOffAt?.toISOString() ?? null,
          salesReviewNotes: salesReviewNotes ?? existing.internalReview?.salesReviewNotes ?? null,
          financeCoverNotes: financeCoverNotes ?? existing.internalReview?.financeCoverNotes ?? null,
        },
      }),
    });

    return updated;
  });

  return toCisPackageDetail(cisPackage);
}

export async function submitCisToFinance(
  actor: AuthenticatedActor,
  cisPackageId: string,
  input: CisSubmitToFinanceRequest,
): Promise<CisPackageDetail> {
  assertModuleAccess(actor.role, 'cis');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const submissionNotes = optionalTrimmed(input.submissionNotes);

  const cisPackage = await prisma.$transaction(async (tx) => {
    const existing = await tx.cisPackage.findUnique({
      where: { id: cisPackageId },
      include: {
        lead: true,
        formData: true,
        internalReview: true,
        financeDecision: true,
        events: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
    });
    if (!existing) {
      throw new Error(`CIS package not found: ${cisPackageId}`);
    }
    if (existing.status !== CisPackageStatus.SALES_SIGNED_OFF && existing.status !== CisPackageStatus.FINANCE_PENDING) {
      throw new Error('CIS package must be Sales/BD signed off before finance submission');
    }
    if (!existing.formData?.cardOnFileAuthorized) {
      throw new Error('Card-on-file authorization is required before finance submission');
    }

    const now = new Date();
    const updated = await tx.cisPackage.update({
      where: { id: existing.id },
      data: {
        status: CisPackageStatus.FINANCE_PENDING,
        financeSubmittedAt: existing.financeSubmittedAt ?? now,
        financeDecision: {
          upsert: {
            create: {
              status: CisFinanceDecisionStatus.PENDING,
              submittedByUserId: actor.userId,
              submittedAt: now,
              submissionNotes: submissionNotes ?? null,
            },
            update: {
              status: CisFinanceDecisionStatus.PENDING,
              submittedByUserId: actor.userId,
              submittedAt: now,
              ...(submissionNotes !== undefined ? { submissionNotes } : {}),
              requestedInfoNotes: null,
            },
          },
        },
      },
      include: {
        lead: true,
        formData: true,
        internalReview: true,
        financeDecision: true,
        events: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
    });

    await tx.cisPackageEvent.create({
      data: {
        cisPackageId: updated.id,
        eventType: 'finance_submitted',
        fromStatus: existing.status,
        toStatus: CisPackageStatus.FINANCE_PENDING,
        actorUserId: actor.userId,
        actorType: actor.actorType,
        note: submissionNotes ?? null,
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: CIS_PACKAGE_ENTITY_TYPE,
        entityId: updated.id,
        metadata: {
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
          leadId: updated.leadId,
        },
        afterData: {
          status: updated.status,
          financeSubmittedAt: updated.financeSubmittedAt?.toISOString() ?? null,
          submissionNotes: submissionNotes ?? existing.financeDecision?.submissionNotes ?? null,
        },
      }),
    });

    return updated;
  });

  return toCisPackageDetail(cisPackage);
}

export async function listFinanceQueue(
  actor: AuthenticatedActor,
  query: ListFinanceQueueRequest = {},
): Promise<ListFinanceQueueResponse> {
  assertModuleAccess(actor.role, 'cis');
  assertActionAccess(actor.role, 'lead.finance_queue_view');

  const decisionStatus = query.decisionStatus;
  const where: Prisma.CisPackageWhereInput = {};

  if (decisionStatus === 'awaiting_submission') {
    where.status = CisPackageStatus.SALES_SIGNED_OFF;
  } else if (decisionStatus === 'approved') {
    where.status = CisPackageStatus.FINANCE_APPROVED;
  } else if (decisionStatus === 'declined') {
    where.status = CisPackageStatus.FINANCE_DECLINED;
  } else if (decisionStatus === 'pending' || decisionStatus === 'info_requested' || decisionStatus === 'conditional') {
    where.status = CisPackageStatus.FINANCE_PENDING;
  } else {
    where.status = {
      in: [
        CisPackageStatus.SALES_SIGNED_OFF,
        CisPackageStatus.FINANCE_PENDING,
        CisPackageStatus.FINANCE_APPROVED,
        CisPackageStatus.FINANCE_DECLINED,
      ],
    };
  }

  const packages = await prisma.cisPackage.findMany({
    where,
    include: {
      lead: true,
      formData: true,
      internalReview: true,
      financeDecision: true,
      events: {
        orderBy: {
          occurredAt: 'desc',
        },
      },
    },
    orderBy: [
      { financeSubmittedAt: 'asc' },
      { salesSignedOffAt: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  const filtered = packages
    .map(toFinanceQueueItem)
    .filter((item) => {
      if (!decisionStatus) {
        return true;
      }
      return item.financeDecisionStatus === decisionStatus;
    });

  return {
    items: filtered,
    total: filtered.length,
  };
}

export async function recordFinanceDecision(
  actor: AuthenticatedActor,
  cisPackageId: string,
  input: CisFinanceDecisionRequest,
): Promise<CisPackageDetail> {
  assertModuleAccess(actor.role, 'cis');
  assertActionAccess(actor.role, 'lead.finance_decide');

  const cisPackage = await prisma.$transaction(async (tx) => {
    const existing = await tx.cisPackage.findUnique({
      where: { id: cisPackageId },
      include: {
        lead: true,
        formData: true,
        internalReview: true,
        financeDecision: true,
        events: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
    });
    if (!existing) {
      throw new Error(`CIS package not found: ${cisPackageId}`);
    }
    if (existing.status !== CisPackageStatus.FINANCE_PENDING && existing.status !== CisPackageStatus.FINANCE_APPROVED && existing.status !== CisPackageStatus.FINANCE_DECLINED) {
      throw new Error('CIS package is not in a finance-review state');
    }

    validateFinanceDecisionInput(existing, input);
    const now = new Date();
    const { packageStatus, decisionStatus, eventType } = mapFinanceDecisionState(input.decision);
    const creditLineAmountCents = normalizeCreditLineAmount(input.creditLineAmount);
    const paymentTerms = input.paymentTerms ? toCisPaymentTermsEnum(input.paymentTerms) : undefined;
    const decisionNotes = optionalTrimmed(input.decisionNotes);
    const requestedInfoNotes = optionalTrimmed(input.requestedInfoNotes);

    const updated = await tx.cisPackage.update({
      where: { id: existing.id },
      data: {
        status: packageStatus,
        ...(packageStatus === CisPackageStatus.FINANCE_APPROVED || packageStatus === CisPackageStatus.FINANCE_DECLINED
          ? { financeDecidedAt: now }
          : {}),
        financeDecision: {
          upsert: {
            create: {
              status: decisionStatus,
              submittedByUserId: existing.financeDecision?.submittedByUserId ?? null,
              submittedAt: existing.financeDecision?.submittedAt ?? existing.financeSubmittedAt ?? now,
              ...(creditLineAmountCents !== undefined ? { creditLineAmountCents } : {}),
              ...(paymentTerms !== undefined ? { paymentTerms } : {}),
              ...(existing.financeDecision?.submissionNotes ? { submissionNotes: existing.financeDecision.submissionNotes } : {}),
              ...(requestedInfoNotes !== undefined ? { requestedInfoNotes } : {}),
              ...(decisionNotes !== undefined ? { decisionNotes } : {}),
              decidedByUserId: actor.userId,
              decidedAt: now,
            },
            update: {
              status: decisionStatus,
              ...(creditLineAmountCents !== undefined ? { creditLineAmountCents } : {}),
              ...(paymentTerms !== undefined ? { paymentTerms } : {}),
              ...(requestedInfoNotes !== undefined ? { requestedInfoNotes } : {}),
              ...(decisionNotes !== undefined ? { decisionNotes } : {}),
              decidedByUserId: actor.userId,
              decidedAt: now,
            },
          },
        },
      },
      include: {
        lead: true,
        formData: true,
        internalReview: true,
        financeDecision: true,
        events: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
    });

    await tx.cisPackageEvent.create({
      data: {
        cisPackageId: updated.id,
        eventType,
        fromStatus: existing.status,
        toStatus: packageStatus,
        actorUserId: actor.userId,
        actorType: actor.actorType,
        note: decisionNotes ?? requestedInfoNotes ?? null,
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: input.decision === 'approved' ? AuditAction.APPROVE : input.decision === 'declined' ? AuditAction.REJECT : AuditAction.UPDATE,
        entityType: CIS_PACKAGE_ENTITY_TYPE,
        entityId: updated.id,
        metadata: {
          sessionId: actor.sessionId,
          actorRole: actor.role,
          actorType: actor.actorType,
          leadId: updated.leadId,
          financeDecisionStatus: decisionStatus,
        },
        afterData: {
          status: updated.status,
          financeDecisionStatus: decisionStatus,
          creditLineAmountCents: creditLineAmountCents ?? existing.financeDecision?.creditLineAmountCents ?? null,
          paymentTerms: paymentTerms ?? existing.financeDecision?.paymentTerms ?? null,
        },
      }),
    });

    return updated as CisPackageWithRelations;
  });

  return toCisPackageDetail(cisPackage);
}

export async function getPublicCisPackage(token: string): Promise<CisPublicPackage | null> {
  const cisPackage = await findPublicCisPackage(token);
  return cisPackage ? toPublicCisPackage(cisPackage) : null;
}

export async function savePublicCisDraft(token: string, input: SavePublicCisDraftRequest): Promise<CisPublicPackage> {
  const cisPackage = await prisma.$transaction(async (tx) => {
    const existing = await findPublicCisPackageInTransaction(tx, token);
    if (!existing) {
      throw new Error('CIS link not found or expired');
    }
    if (!ACTIVE_EDITABLE_CIS_STATUSES.has(existing.status)) {
      throw new Error('CIS package can no longer be edited');
    }

    const mergedForm = mergeFormData(existing.formData, input.formData, false);
    const now = new Date();

    const updated = await tx.cisPackage.update({
      where: { id: existing.id },
      data: {
        status: CisPackageStatus.DRAFT_IN_PROGRESS,
        formData: {
          upsert: {
            create: toCisFormCreateInput(mergedForm, now),
            update: toCisFormUpdateInput(mergedForm, now),
          },
        },
      },
      include: {
        lead: true,
        formData: true,
        internalReview: true,
        financeDecision: true,
        events: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
    });

    await tx.cisPackageEvent.create({
      data: {
        cisPackageId: updated.id,
        eventType: 'draft_saved',
        fromStatus: existing.status,
        toStatus: CisPackageStatus.DRAFT_IN_PROGRESS,
        actorType: 'prospect',
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        action: AuditAction.UPDATE,
        entityType: CIS_PACKAGE_ENTITY_TYPE,
        entityId: updated.id,
        metadata: {
          actorType: 'prospect',
          leadId: updated.leadId,
        },
        afterData: {
          status: updated.status,
          lastSavedAt: mergedForm.lastSavedAt?.toISOString() ?? null,
        },
      }),
    });

    return updated;
  });

  return toPublicCisPackage(cisPackage);
}

export async function submitPublicCis(token: string, input: SubmitPublicCisRequest): Promise<CisPublicPackage> {
  const cisPackage = await prisma.$transaction(async (tx) => {
    const existing = await findPublicCisPackageInTransaction(tx, token);
    if (!existing) {
      throw new Error('CIS link not found or expired');
    }
    if (!ACTIVE_EDITABLE_CIS_STATUSES.has(existing.status)) {
      throw new Error('CIS package can no longer be submitted');
    }

    const mergedForm = mergeFormData(existing.formData, input.formData, true);
    validateSubmissionForm(mergedForm);
    const now = new Date();

    const updated = await tx.cisPackage.update({
      where: { id: existing.id },
      data: {
        status: CisPackageStatus.SUBMITTED,
        submittedAt: now,
        esignStatus: CisEsignStatus.SIGNED,
        paymentStatus: mergedForm.cardOnFileAuthorized ? CisPaymentStatus.VAULT_PENDING : CisPaymentStatus.NOT_STARTED,
        formData: {
          upsert: {
            create: toCisFormCreateInput({
              ...mergedForm,
              signatureCapturedAt: mergedForm.signatureCapturedAt ?? now,
              submittedByProspectAt: now,
            }, now),
            update: toCisFormUpdateInput({
              ...mergedForm,
              signatureCapturedAt: mergedForm.signatureCapturedAt ?? now,
              submittedByProspectAt: now,
            }, now),
          },
        },
      },
      include: {
        lead: true,
        formData: true,
        internalReview: true,
        financeDecision: true,
        events: {
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
    });

    await tx.cisPackageEvent.create({
      data: {
        cisPackageId: updated.id,
        eventType: 'submitted',
        fromStatus: existing.status,
        toStatus: CisPackageStatus.SUBMITTED,
        actorType: 'prospect',
      },
    });

    const leadUpdateData: Prisma.LeadUpdateInput = {
      cisSubmittedAt: now,
      ...(updated.lead.cisSentAt ? {} : { cisSentAt: now }),
    };

    if (Object.keys(leadUpdateData).length > 0) {
      await tx.lead.update({
        where: { id: updated.leadId },
        data: leadUpdateData,
      });
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        action: AuditAction.UPDATE,
        entityType: CIS_PACKAGE_ENTITY_TYPE,
        entityId: updated.id,
        metadata: {
          actorType: 'prospect',
          leadId: updated.leadId,
        },
        afterData: {
          status: updated.status,
          submittedAt: updated.submittedAt?.toISOString() ?? null,
          paymentStatus: updated.paymentStatus,
          esignStatus: updated.esignStatus,
        },
      }),
    });

    return updated;
  });

  return toPublicCisPackage(cisPackage);
}

function buildLeadPrefill(lead: {
  companyName: string;
  contactDisplayName: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  countryCode: string | null;
  serviceTechCount: number;
  installTechCount: number | null;
  salesPersonCount: number | null;
  affinityGroupName: string | null;
  ownershipGroupName: string | null;
}) {
  return {
    numOfTechs: lead.serviceTechCount,
    ...(lead.installTechCount !== null ? { numOfInstallTechs: lead.installTechCount } : {}),
    ...(lead.salesPersonCount !== null ? { numOfSalespeopleAdvisors: lead.salesPersonCount } : {}),
    ...(lead.affinityGroupName ? { affinityGroupOrFranchise: lead.affinityGroupName } : {}),
    ...(lead.ownershipGroupName ? { parentCompanyName: lead.ownershipGroupName } : {}),
    primaryContactName: lead.contactDisplayName,
    ...(lead.email ? { primaryContactEmail: lead.email } : {}),
    ...(lead.phone ? { primaryContactCellPhone: lead.phone } : {}),
    ownerManagerName: lead.contactDisplayName,
    ...(lead.email ? { ownerManagerEmail: lead.email } : {}),
    ...(lead.phone ? { ownerManagerCellPhone: lead.phone } : {}),
    legalCompanyName: lead.companyName,
    ...(lead.state ? { physicalState: lead.state, billingState: lead.state } : {}),
    ...(lead.countryCode ? { physicalCountryCode: lead.countryCode, billingCountryCode: lead.countryCode } : {}),
    orderingContactName: lead.contactDisplayName,
    ...(lead.email ? { orderingContactEmail: lead.email } : {}),
    ...(lead.phone ? { orderingContactCellPhone: lead.phone } : {}),
    apContactName: lead.contactDisplayName,
    ...(lead.email ? { apEmail: lead.email } : {}),
    ...(lead.phone ? { apDirectPhone: lead.phone } : {}),
  };
}

async function findPublicCisPackage(token: string) {
  return prisma.cisPackage.findFirst({
    where: buildPublicTokenWhere(token),
    include: {
      lead: true,
      formData: true,
      internalReview: true,
      financeDecision: true,
      events: {
        orderBy: {
          occurredAt: 'desc',
        },
      },
    },
  });
}

async function findPublicCisPackageInTransaction(tx: Prisma.TransactionClient, token: string) {
  return tx.cisPackage.findFirst({
    where: buildPublicTokenWhere(token),
    include: {
      lead: true,
      formData: true,
      internalReview: true,
      financeDecision: true,
      events: {
        orderBy: {
          occurredAt: 'desc',
        },
      },
    },
  });
}

function buildPublicTokenWhere(token: string): Prisma.CisPackageWhereInput {
  const tokenHash = hashPublicToken(token);
  return {
    externalLinkTokenHash: tokenHash,
    OR: [
      { externalLinkExpiresAt: null },
      { externalLinkExpiresAt: { gt: new Date() } },
    ],
  };
}

function mergeFormData(
  current: Prisma.CisFormDataGetPayload<Record<string, never>> | null,
  input: CisFormDraftInput | undefined,
  submitting: boolean,
): MutableCisFormSnapshot {
  const next: MutableCisFormSnapshot = current ? buildMutableSnapshotFromFormData(current) : {};

  const source = input ?? {};
  assignOptionalString(next, 'companyWebsite', source.companyWebsite);
  assignOptionalInteger(next, 'numOfTechs', source.numOfTechs);
  assignOptionalInteger(next, 'numOfInstallTechs', source.numOfInstallTechs);
  assignOptionalInteger(next, 'numOfSalespeopleAdvisors', source.numOfSalespeopleAdvisors);
  assignOptionalString(next, 'affinityGroupOrFranchise', source.affinityGroupOrFranchise);
  assignOptionalBoolean(next, 'isPrivateEquity', source.isPrivateEquity);
  assignOptionalString(next, 'parentCompanyName', source.parentCompanyName);
  assignOptionalString(next, 'primaryContactName', source.primaryContactName);
  assignOptionalString(next, 'primaryContactTitle', source.primaryContactTitle);
  assignOptionalString(next, 'primaryContactEmail', source.primaryContactEmail);
  assignOptionalString(next, 'primaryContactCellPhone', source.primaryContactCellPhone);
  assignOptionalString(next, 'ownerManagerName', source.ownerManagerName);
  assignOptionalString(next, 'ownerManagerTitle', source.ownerManagerTitle);
  assignOptionalString(next, 'ownerManagerEmail', source.ownerManagerEmail);
  assignOptionalString(next, 'ownerManagerCellPhone', source.ownerManagerCellPhone);
  assignOptionalString(next, 'legalCompanyName', source.legalCompanyName);
  assignOptionalString(next, 'physicalAddress', source.physicalAddress);
  assignOptionalString(next, 'physicalCity', source.physicalCity);
  assignOptionalString(next, 'physicalState', source.physicalState);
  assignOptionalString(next, 'physicalZip', source.physicalZip);
  assignOptionalString(next, 'physicalCountryCode', source.physicalCountryCode, { uppercase: true });
  assignOptionalString(next, 'billingAddress', source.billingAddress);
  assignOptionalString(next, 'billingCity', source.billingCity);
  assignOptionalString(next, 'billingState', source.billingState);
  assignOptionalString(next, 'billingZip', source.billingZip);
  assignOptionalString(next, 'billingCountryCode', source.billingCountryCode, { uppercase: true });
  assignOptionalString(next, 'companyPhone', source.companyPhone);
  assignOptionalString(next, 'typeOfBusiness', source.typeOfBusiness);
  assignOptionalInteger(next, 'yearsInBusiness', source.yearsInBusiness);
  assignOptionalInteger(next, 'monthsInBusiness', source.monthsInBusiness);
  assignOptionalString(next, 'orderingContactName', source.orderingContactName);
  assignOptionalString(next, 'orderingContactCellPhone', source.orderingContactCellPhone);
  assignOptionalString(next, 'orderingContactEmail', source.orderingContactEmail);
  assignOptionalString(next, 'apContactName', source.apContactName);
  assignOptionalString(next, 'apDirectPhone', source.apDirectPhone);
  assignOptionalString(next, 'apEmail', source.apEmail);
  assignOptionalPaymentMethod(next, source.paymentMethod);
  assignOptionalBoolean(next, 'achAuthorized', source.achAuthorized);
  assignOptionalBoolean(next, 'cardOnFileAuthorized', source.cardOnFileAuthorized);
  assignOptionalBoolean(next, 'resaleCertificateAttached', source.resaleCertificateAttached);

  if (source.hasSignature === true) {
    next.signatureCapturedAt = next.signatureCapturedAt ?? new Date();
  }

  next.lastSavedAt = new Date();
  if (submitting) {
    next.submittedByProspectAt = new Date();
  }

  return next;
}

function validateSubmissionForm(form: MutableCisFormSnapshot) {
  const requiredStrings: Array<[value: string | undefined, label: string]> = [
    [form.primaryContactName, 'primaryContactName'],
    [form.primaryContactEmail, 'primaryContactEmail'],
    [form.primaryContactCellPhone, 'primaryContactCellPhone'],
    [form.legalCompanyName, 'legalCompanyName'],
    [form.physicalAddress, 'physicalAddress'],
    [form.physicalCity, 'physicalCity'],
    [form.physicalState, 'physicalState'],
    [form.physicalZip, 'physicalZip'],
    [form.companyPhone, 'companyPhone'],
    [form.typeOfBusiness, 'typeOfBusiness'],
  ];

  for (const [value, label] of requiredStrings) {
    if (!value) {
      throw new Error(`${label} is required`);
    }
  }

  if (form.paymentMethod === undefined) {
    throw new Error('paymentMethod is required');
  }
  if (form.cardOnFileAuthorized !== true) {
    throw new Error('cardOnFileAuthorized is required');
  }
  if (!form.signatureCapturedAt) {
    throw new Error('Signature is required');
  }

  if (form.primaryContactEmail && !looksLikeEmail(form.primaryContactEmail)) {
    throw new Error('primaryContactEmail must be a valid email');
  }
  if (form.ownerManagerEmail && !looksLikeEmail(form.ownerManagerEmail)) {
    throw new Error('ownerManagerEmail must be a valid email');
  }
  if (form.orderingContactEmail && !looksLikeEmail(form.orderingContactEmail)) {
    throw new Error('orderingContactEmail must be a valid email');
  }
  if (form.apEmail && !looksLikeEmail(form.apEmail)) {
    throw new Error('apEmail must be a valid email');
  }

  if (form.numOfTechs !== undefined && form.numOfTechs < 0) {
    throw new Error('numOfTechs must be zero or greater');
  }
  if (form.monthsInBusiness !== undefined && (form.monthsInBusiness < 0 || form.monthsInBusiness > 11)) {
    throw new Error('monthsInBusiness must be between 0 and 11');
  }
}

function toCisFormCreateInput(form: MutableCisFormSnapshot, now: Date): Prisma.CisFormDataCreateWithoutCisPackageInput {
  return {
    companyWebsite: form.companyWebsite ?? null,
    numOfTechs: form.numOfTechs ?? null,
    numOfInstallTechs: form.numOfInstallTechs ?? null,
    numOfSalespeopleAdvisors: form.numOfSalespeopleAdvisors ?? null,
    affinityGroupOrFranchise: form.affinityGroupOrFranchise ?? null,
    isPrivateEquity: form.isPrivateEquity ?? false,
    parentCompanyName: form.parentCompanyName ?? null,
    primaryContactName: form.primaryContactName ?? null,
    primaryContactTitle: form.primaryContactTitle ?? null,
    primaryContactEmail: form.primaryContactEmail ?? null,
    primaryContactCellPhone: form.primaryContactCellPhone ?? null,
    ownerManagerName: form.ownerManagerName ?? null,
    ownerManagerTitle: form.ownerManagerTitle ?? null,
    ownerManagerEmail: form.ownerManagerEmail ?? null,
    ownerManagerCellPhone: form.ownerManagerCellPhone ?? null,
    legalCompanyName: form.legalCompanyName ?? null,
    physicalAddress: form.physicalAddress ?? null,
    physicalCity: form.physicalCity ?? null,
    physicalState: form.physicalState ?? null,
    physicalZip: form.physicalZip ?? null,
    physicalCountryCode: form.physicalCountryCode ?? null,
    billingAddress: form.billingAddress ?? null,
    billingCity: form.billingCity ?? null,
    billingState: form.billingState ?? null,
    billingZip: form.billingZip ?? null,
    billingCountryCode: form.billingCountryCode ?? null,
    companyPhone: form.companyPhone ?? null,
    typeOfBusiness: form.typeOfBusiness ?? null,
    yearsInBusiness: form.yearsInBusiness ?? null,
    monthsInBusiness: form.monthsInBusiness ?? null,
    orderingContactName: form.orderingContactName ?? null,
    orderingContactCellPhone: form.orderingContactCellPhone ?? null,
    orderingContactEmail: form.orderingContactEmail ?? null,
    apContactName: form.apContactName ?? null,
    apDirectPhone: form.apDirectPhone ?? null,
    apEmail: form.apEmail ?? null,
    paymentMethod: form.paymentMethod ?? null,
    achAuthorized: form.achAuthorized ?? false,
    cardOnFileAuthorized: form.cardOnFileAuthorized ?? false,
    resaleCertificateAttached: form.resaleCertificateAttached ?? false,
    signatureCapturedAt: form.signatureCapturedAt ?? null,
    submittedByProspectAt: form.submittedByProspectAt ?? null,
    lastSavedAt: form.lastSavedAt ?? now,
  };
}

function toCisFormUpdateInput(form: MutableCisFormSnapshot, now: Date): Prisma.CisFormDataUpdateWithoutCisPackageInput {
  return {
    companyWebsite: setNullable(form.companyWebsite),
    numOfTechs: setNullable(form.numOfTechs),
    numOfInstallTechs: setNullable(form.numOfInstallTechs),
    numOfSalespeopleAdvisors: setNullable(form.numOfSalespeopleAdvisors),
    affinityGroupOrFranchise: setNullable(form.affinityGroupOrFranchise),
    isPrivateEquity: form.isPrivateEquity ?? false,
    parentCompanyName: setNullable(form.parentCompanyName),
    primaryContactName: setNullable(form.primaryContactName),
    primaryContactTitle: setNullable(form.primaryContactTitle),
    primaryContactEmail: setNullable(form.primaryContactEmail),
    primaryContactCellPhone: setNullable(form.primaryContactCellPhone),
    ownerManagerName: setNullable(form.ownerManagerName),
    ownerManagerTitle: setNullable(form.ownerManagerTitle),
    ownerManagerEmail: setNullable(form.ownerManagerEmail),
    ownerManagerCellPhone: setNullable(form.ownerManagerCellPhone),
    legalCompanyName: setNullable(form.legalCompanyName),
    physicalAddress: setNullable(form.physicalAddress),
    physicalCity: setNullable(form.physicalCity),
    physicalState: setNullable(form.physicalState),
    physicalZip: setNullable(form.physicalZip),
    physicalCountryCode: setNullable(form.physicalCountryCode),
    billingAddress: setNullable(form.billingAddress),
    billingCity: setNullable(form.billingCity),
    billingState: setNullable(form.billingState),
    billingZip: setNullable(form.billingZip),
    billingCountryCode: setNullable(form.billingCountryCode),
    companyPhone: setNullable(form.companyPhone),
    typeOfBusiness: setNullable(form.typeOfBusiness),
    yearsInBusiness: setNullable(form.yearsInBusiness),
    monthsInBusiness: setNullable(form.monthsInBusiness),
    orderingContactName: setNullable(form.orderingContactName),
    orderingContactCellPhone: setNullable(form.orderingContactCellPhone),
    orderingContactEmail: setNullable(form.orderingContactEmail),
    apContactName: setNullable(form.apContactName),
    apDirectPhone: setNullable(form.apDirectPhone),
    apEmail: setNullable(form.apEmail),
    paymentMethod: setNullable(form.paymentMethod),
    achAuthorized: form.achAuthorized ?? false,
    cardOnFileAuthorized: form.cardOnFileAuthorized ?? false,
    resaleCertificateAttached: form.resaleCertificateAttached ?? false,
    signatureCapturedAt: setNullable(form.signatureCapturedAt),
    submittedByProspectAt: setNullable(form.submittedByProspectAt),
    lastSavedAt: form.lastSavedAt ?? now,
  };
}

function toCisPackageDetail(cisPackage: CisPackageWithRelations): CisPackageDetail {
  return {
    ...toCisPackageSummary(cisPackage),
    formData: toCisFormRecord(cisPackage.formData),
    ...(cisPackage.internalReview ? { internalReview: toCisInternalReviewRecord(cisPackage.internalReview) } : {}),
    ...(cisPackage.financeDecision ? { financeDecision: toCisFinanceDecisionRecord(cisPackage.financeDecision) } : {}),
    events: cisPackage.events.map(toCisPackageEventSummary),
  };
}

function toPublicCisPackage(cisPackage: CisPackageWithRelations): CisPublicPackage {
  return {
    cisPackageId: cisPackage.id,
    leadId: cisPackage.leadId,
    leadCompanyName: cisPackage.lead.companyName,
    leadContactDisplayName: cisPackage.lead.contactDisplayName,
    status: toCisPackageStatusKey(cisPackage.status),
    entryMethod: toCisEntryMethodKey(cisPackage.entryMethod),
    ...(cisPackage.externalLinkExpiresAt ? { externalLinkExpiresAt: cisPackage.externalLinkExpiresAt.toISOString() } : {}),
    paymentStatus: toCisPaymentStatusKey(cisPackage.paymentStatus),
    esignStatus: toCisEsignStatusKey(cisPackage.esignStatus),
    cardOnFileRequired: true,
    formData: toCisFormRecord(cisPackage.formData),
  };
}

function toCisPackageSummary(cisPackage: CisPackageWithRelations): CisPackageSummary {
  return {
    id: cisPackage.id,
    leadId: cisPackage.leadId,
    leadCompanyName: cisPackage.lead.companyName,
    leadContactDisplayName: cisPackage.lead.contactDisplayName,
    status: toCisPackageStatusKey(cisPackage.status),
    entryMethod: toCisEntryMethodKey(cisPackage.entryMethod),
    ...(cisPackage.externalLinkExpiresAt ? { externalLinkExpiresAt: cisPackage.externalLinkExpiresAt.toISOString() } : {}),
    ...(cisPackage.externalLinkLastSentAt ? { externalLinkLastSentAt: cisPackage.externalLinkLastSentAt.toISOString() } : {}),
    externalLinkSentCount: cisPackage.externalLinkSentCount,
    paymentStatus: toCisPaymentStatusKey(cisPackage.paymentStatus),
    esignStatus: toCisEsignStatusKey(cisPackage.esignStatus),
    ...(cisPackage.submittedAt ? { submittedAt: cisPackage.submittedAt.toISOString() } : {}),
    ...(cisPackage.reviewStartedAt ? { reviewStartedAt: cisPackage.reviewStartedAt.toISOString() } : {}),
    ...(cisPackage.salesSignedOffAt ? { salesSignedOffAt: cisPackage.salesSignedOffAt.toISOString() } : {}),
    ...(cisPackage.financeSubmittedAt ? { financeSubmittedAt: cisPackage.financeSubmittedAt.toISOString() } : {}),
    ...(cisPackage.financeDecidedAt ? { financeDecidedAt: cisPackage.financeDecidedAt.toISOString() } : {}),
    ...(cisPackage.completedAt ? { completedAt: cisPackage.completedAt.toISOString() } : {}),
    ...(cisPackage.notes ? { notes: cisPackage.notes } : {}),
    createdAt: cisPackage.createdAt.toISOString(),
    updatedAt: cisPackage.updatedAt.toISOString(),
  };
}

function toCisPackageEventSummary(event: Prisma.CisPackageEventGetPayload<Record<string, never>>): CisPackageEventSummary {
  return {
    id: event.id,
    eventType: event.eventType,
    ...(event.fromStatus ? { fromStatus: toCisPackageStatusKey(event.fromStatus) } : {}),
    ...(event.toStatus ? { toStatus: toCisPackageStatusKey(event.toStatus) } : {}),
    ...(event.actorUserId ? { actorUserId: event.actorUserId } : {}),
    actorType: event.actorType,
    ...(event.note ? { note: event.note } : {}),
    occurredAt: event.occurredAt.toISOString(),
  };
}

function toCisInternalReviewRecord(
  internalReview: Prisma.CisInternalReviewGetPayload<Record<string, never>>,
): CisInternalReviewRecord {
  return {
    ...(internalReview.reviewStartedByUserId ? { reviewStartedByUserId: internalReview.reviewStartedByUserId } : {}),
    ...(internalReview.salesReviewNotes ? { salesReviewNotes: internalReview.salesReviewNotes } : {}),
    ...(internalReview.salesSignedOffByUserId ? { salesSignedOffByUserId: internalReview.salesSignedOffByUserId } : {}),
    ...(internalReview.salesSignedOffAt ? { salesSignedOffAt: internalReview.salesSignedOffAt.toISOString() } : {}),
    ...(internalReview.financeCoverNotes ? { financeCoverNotes: internalReview.financeCoverNotes } : {}),
  };
}

function toCisFinanceDecisionRecord(
  financeDecision: Prisma.CisFinanceDecisionGetPayload<Record<string, never>>,
): CisFinanceDecisionRecord {
  return {
    status: toCisFinanceDecisionStatusKey(financeDecision.status),
    ...(financeDecision.submittedByUserId ? { submittedByUserId: financeDecision.submittedByUserId } : {}),
    ...(financeDecision.submittedAt ? { submittedAt: financeDecision.submittedAt.toISOString() } : {}),
    ...(financeDecision.creditLineAmountCents !== null ? { creditLineAmount: financeDecision.creditLineAmountCents / 100 } : {}),
    ...(financeDecision.paymentTerms ? { paymentTerms: toCisPaymentTermsKey(financeDecision.paymentTerms) } : {}),
    ...(financeDecision.submissionNotes ? { submissionNotes: financeDecision.submissionNotes } : {}),
    ...(financeDecision.requestedInfoNotes ? { requestedInfoNotes: financeDecision.requestedInfoNotes } : {}),
    ...(financeDecision.decisionNotes ? { decisionNotes: financeDecision.decisionNotes } : {}),
    ...(financeDecision.decidedByUserId ? { decidedByUserId: financeDecision.decidedByUserId } : {}),
    ...(financeDecision.decidedAt ? { decidedAt: financeDecision.decidedAt.toISOString() } : {}),
  };
}

function toFinanceQueueItem(cisPackage: CisPackageWithRelations): FinanceQueueItem {
  const financeDecision = cisPackage.financeDecision ? toCisFinanceDecisionRecord(cisPackage.financeDecision) : undefined;
  const internalReview = cisPackage.internalReview ? toCisInternalReviewRecord(cisPackage.internalReview) : undefined;
  const financeDecisionStatus = financeDecision?.status
    ?? (cisPackage.status === CisPackageStatus.SALES_SIGNED_OFF ? 'awaiting_submission' : 'not_submitted');
  const submittedToFinanceAt = financeDecision?.submittedAt ?? cisPackage.financeSubmittedAt?.toISOString();
  const financeDecidedAt = financeDecision?.decidedAt ?? cisPackage.financeDecidedAt?.toISOString();
  const slaHoursOpen = submittedToFinanceAt && (financeDecisionStatus === 'pending' || financeDecisionStatus === 'info_requested' || financeDecisionStatus === 'conditional')
    ? calculateHoursOpen(submittedToFinanceAt)
    : undefined;

  return {
    cisPackageId: cisPackage.id,
    leadId: cisPackage.leadId,
    companyName: cisPackage.lead.companyName,
    contactDisplayName: cisPackage.lead.contactDisplayName,
    cisStatus: toCisPackageStatusKey(cisPackage.status),
    financeDecisionStatus,
    ...(submittedToFinanceAt ? { submittedToFinanceAt } : {}),
    ...(financeDecidedAt ? { financeDecidedAt } : {}),
    ...(financeDecision?.submittedByUserId ? { submittedByUserId: financeDecision.submittedByUserId } : {}),
    ...(financeDecision?.decidedByUserId ? { decidedByUserId: financeDecision.decidedByUserId } : {}),
    cardOnFileAuthorized: Boolean(cisPackage.formData?.cardOnFileAuthorized),
    ...(cisPackage.formData?.paymentMethod ? { paymentMethod: cisPackage.formData.paymentMethod } : {}),
    ...(financeDecision?.creditLineAmount !== undefined ? { creditLineAmount: financeDecision.creditLineAmount } : {}),
    ...(financeDecision?.paymentTerms ? { paymentTerms: financeDecision.paymentTerms } : {}),
    ...(slaHoursOpen !== undefined ? { slaHoursOpen } : {}),
    ...(internalReview?.salesSignedOffAt ? { salesSignedOffAt: internalReview.salesSignedOffAt } : {}),
    ...(internalReview?.salesReviewNotes ? { salesReviewNotes: internalReview.salesReviewNotes } : {}),
    ...(internalReview?.financeCoverNotes ? { financeCoverNotes: internalReview.financeCoverNotes } : {}),
    ...(financeDecision?.decisionNotes ? { decisionNotes: financeDecision.decisionNotes } : {}),
  };
}

function toCisFormRecord(formData: Prisma.CisFormDataGetPayload<Record<string, never>> | null): CisFormDataRecord {
  if (!formData) {
    return {};
  }

  return {
    ...(formData.companyWebsite ? { companyWebsite: formData.companyWebsite } : {}),
    ...(formData.numOfTechs !== null ? { numOfTechs: formData.numOfTechs } : {}),
    ...(formData.numOfInstallTechs !== null ? { numOfInstallTechs: formData.numOfInstallTechs } : {}),
    ...(formData.numOfSalespeopleAdvisors !== null ? { numOfSalespeopleAdvisors: formData.numOfSalespeopleAdvisors } : {}),
    ...(formData.affinityGroupOrFranchise ? { affinityGroupOrFranchise: formData.affinityGroupOrFranchise } : {}),
    ...(formData.isPrivateEquity ? { isPrivateEquity: formData.isPrivateEquity } : {}),
    ...(formData.parentCompanyName ? { parentCompanyName: formData.parentCompanyName } : {}),
    ...(formData.primaryContactName ? { primaryContactName: formData.primaryContactName } : {}),
    ...(formData.primaryContactTitle ? { primaryContactTitle: formData.primaryContactTitle } : {}),
    ...(formData.primaryContactEmail ? { primaryContactEmail: formData.primaryContactEmail } : {}),
    ...(formData.primaryContactCellPhone ? { primaryContactCellPhone: formData.primaryContactCellPhone } : {}),
    ...(formData.ownerManagerName ? { ownerManagerName: formData.ownerManagerName } : {}),
    ...(formData.ownerManagerTitle ? { ownerManagerTitle: formData.ownerManagerTitle } : {}),
    ...(formData.ownerManagerEmail ? { ownerManagerEmail: formData.ownerManagerEmail } : {}),
    ...(formData.ownerManagerCellPhone ? { ownerManagerCellPhone: formData.ownerManagerCellPhone } : {}),
    ...(formData.legalCompanyName ? { legalCompanyName: formData.legalCompanyName } : {}),
    ...(formData.physicalAddress ? { physicalAddress: formData.physicalAddress } : {}),
    ...(formData.physicalCity ? { physicalCity: formData.physicalCity } : {}),
    ...(formData.physicalState ? { physicalState: formData.physicalState } : {}),
    ...(formData.physicalZip ? { physicalZip: formData.physicalZip } : {}),
    ...(formData.physicalCountryCode ? { physicalCountryCode: formData.physicalCountryCode } : {}),
    ...(formData.billingAddress ? { billingAddress: formData.billingAddress } : {}),
    ...(formData.billingCity ? { billingCity: formData.billingCity } : {}),
    ...(formData.billingState ? { billingState: formData.billingState } : {}),
    ...(formData.billingZip ? { billingZip: formData.billingZip } : {}),
    ...(formData.billingCountryCode ? { billingCountryCode: formData.billingCountryCode } : {}),
    ...(formData.companyPhone ? { companyPhone: formData.companyPhone } : {}),
    ...(formData.typeOfBusiness ? { typeOfBusiness: formData.typeOfBusiness } : {}),
    ...(formData.yearsInBusiness !== null ? { yearsInBusiness: formData.yearsInBusiness } : {}),
    ...(formData.monthsInBusiness !== null ? { monthsInBusiness: formData.monthsInBusiness } : {}),
    ...(formData.orderingContactName ? { orderingContactName: formData.orderingContactName } : {}),
    ...(formData.orderingContactCellPhone ? { orderingContactCellPhone: formData.orderingContactCellPhone } : {}),
    ...(formData.orderingContactEmail ? { orderingContactEmail: formData.orderingContactEmail } : {}),
    ...(formData.apContactName ? { apContactName: formData.apContactName } : {}),
    ...(formData.apDirectPhone ? { apDirectPhone: formData.apDirectPhone } : {}),
    ...(formData.apEmail ? { apEmail: formData.apEmail } : {}),
    ...(formData.paymentMethod ? { paymentMethod: formData.paymentMethod } : {}),
    ...(formData.achAuthorized ? { achAuthorized: formData.achAuthorized } : {}),
    ...(formData.cardOnFileAuthorized ? { cardOnFileAuthorized: formData.cardOnFileAuthorized } : {}),
    ...(formData.resaleCertificateAttached ? { resaleCertificateAttached: formData.resaleCertificateAttached } : {}),
    ...(formData.signatureCapturedAt ? { signatureCapturedAt: formData.signatureCapturedAt.toISOString() } : {}),
    ...(formData.submittedByProspectAt ? { submittedByProspectAt: formData.submittedByProspectAt.toISOString() } : {}),
    ...(formData.lastSavedAt ? { lastSavedAt: formData.lastSavedAt.toISOString() } : {}),
  };
}

function assignOptionalString(
  target: MutableCisFormSnapshot,
  key: keyof MutableCisFormSnapshot,
  value: unknown,
  options?: {
    uppercase?: boolean;
  },
) {
  const record = target as Record<string, unknown>;
  if (value === undefined) {
    return;
  }
  if (value === null) {
    delete record[key];
    return;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    delete record[key];
    return;
  }
  record[key] = options?.uppercase ? trimmed.toUpperCase() : trimmed;
}

function assignOptionalInteger(target: MutableCisFormSnapshot, key: keyof MutableCisFormSnapshot, value: unknown) {
  const record = target as Record<string, unknown>;
  if (value === undefined) {
    return;
  }
  if (value === null || value === '') {
    delete record[key];
    return;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${String(key)} must be an integer zero or greater`);
  }
  record[key] = parsed;
}

function assignOptionalBoolean(target: MutableCisFormSnapshot, key: keyof MutableCisFormSnapshot, value: unknown) {
  const record = target as Record<string, unknown>;
  if (value === undefined) {
    return;
  }
  if (value === null) {
    delete record[key];
    return;
  }
  record[key] = Boolean(value);
}

function assignOptionalPaymentMethod(target: MutableCisFormSnapshot, value: unknown) {
  const record = target as Record<string, unknown>;
  if (value === undefined) {
    return;
  }
  if (value === null || value === '') {
    delete record.paymentMethod;
    return;
  }
  if (value !== 'NET_30' && value !== 'ACH' && value !== 'CREDIT_CARD') {
    throw new Error('paymentMethod must be NET_30, ACH, or CREDIT_CARD');
  }
  record.paymentMethod = value;
}

function toCisPackageStatusKey(value: CisPackageStatus): CisPackageSummary['status'] {
  return value.toLowerCase() as CisPackageSummary['status'];
}

function toCisEntryMethodKey(value: CisEntryMethod): CisPackageSummary['entryMethod'] {
  return value.toLowerCase() as CisPackageSummary['entryMethod'];
}

function toCisPaymentStatusKey(value: CisPaymentStatus): CisPackageSummary['paymentStatus'] {
  return value.toLowerCase() as CisPackageSummary['paymentStatus'];
}

function toCisEsignStatusKey(value: CisEsignStatus): CisPackageSummary['esignStatus'] {
  return value.toLowerCase() as CisPackageSummary['esignStatus'];
}

function toCisFinanceDecisionStatusKey(value: CisFinanceDecisionStatus): CisFinanceDecisionRecord['status'] {
  return value.toLowerCase() as CisFinanceDecisionRecord['status'];
}

function toCisPaymentTermsKey(value: CisPaymentTerms): NonNullable<CisFinanceDecisionRecord['paymentTerms']> {
  return value;
}

function buildPublicCisUrl(config: AppConfig, token: string) {
  return `${config.web.publicBaseUrl.replace(/\/+$/, '')}/public/cis/${token}`;
}

function createPublicToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashPublicToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function optionalTrimmed(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toJsonValue(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function setNullable<T>(value: T | undefined) {
  return value ?? null;
}

function buildMutableSnapshotFromFormData(formData: NonNullable<CisPackageWithRelations['formData']>): MutableCisFormSnapshot {
  return {
    ...(formData.companyWebsite !== null ? { companyWebsite: formData.companyWebsite } : {}),
    ...(formData.numOfTechs !== null ? { numOfTechs: formData.numOfTechs } : {}),
    ...(formData.numOfInstallTechs !== null ? { numOfInstallTechs: formData.numOfInstallTechs } : {}),
    ...(formData.numOfSalespeopleAdvisors !== null ? { numOfSalespeopleAdvisors: formData.numOfSalespeopleAdvisors } : {}),
    ...(formData.affinityGroupOrFranchise !== null ? { affinityGroupOrFranchise: formData.affinityGroupOrFranchise } : {}),
    ...(formData.isPrivateEquity ? { isPrivateEquity: formData.isPrivateEquity } : {}),
    ...(formData.parentCompanyName !== null ? { parentCompanyName: formData.parentCompanyName } : {}),
    ...(formData.primaryContactName !== null ? { primaryContactName: formData.primaryContactName } : {}),
    ...(formData.primaryContactTitle !== null ? { primaryContactTitle: formData.primaryContactTitle } : {}),
    ...(formData.primaryContactEmail !== null ? { primaryContactEmail: formData.primaryContactEmail } : {}),
    ...(formData.primaryContactCellPhone !== null ? { primaryContactCellPhone: formData.primaryContactCellPhone } : {}),
    ...(formData.ownerManagerName !== null ? { ownerManagerName: formData.ownerManagerName } : {}),
    ...(formData.ownerManagerTitle !== null ? { ownerManagerTitle: formData.ownerManagerTitle } : {}),
    ...(formData.ownerManagerEmail !== null ? { ownerManagerEmail: formData.ownerManagerEmail } : {}),
    ...(formData.ownerManagerCellPhone !== null ? { ownerManagerCellPhone: formData.ownerManagerCellPhone } : {}),
    ...(formData.legalCompanyName !== null ? { legalCompanyName: formData.legalCompanyName } : {}),
    ...(formData.physicalAddress !== null ? { physicalAddress: formData.physicalAddress } : {}),
    ...(formData.physicalCity !== null ? { physicalCity: formData.physicalCity } : {}),
    ...(formData.physicalState !== null ? { physicalState: formData.physicalState } : {}),
    ...(formData.physicalZip !== null ? { physicalZip: formData.physicalZip } : {}),
    ...(formData.physicalCountryCode !== null ? { physicalCountryCode: formData.physicalCountryCode } : {}),
    ...(formData.billingAddress !== null ? { billingAddress: formData.billingAddress } : {}),
    ...(formData.billingCity !== null ? { billingCity: formData.billingCity } : {}),
    ...(formData.billingState !== null ? { billingState: formData.billingState } : {}),
    ...(formData.billingZip !== null ? { billingZip: formData.billingZip } : {}),
    ...(formData.billingCountryCode !== null ? { billingCountryCode: formData.billingCountryCode } : {}),
    ...(formData.companyPhone !== null ? { companyPhone: formData.companyPhone } : {}),
    ...(formData.typeOfBusiness !== null ? { typeOfBusiness: formData.typeOfBusiness } : {}),
    ...(formData.yearsInBusiness !== null ? { yearsInBusiness: formData.yearsInBusiness } : {}),
    ...(formData.monthsInBusiness !== null ? { monthsInBusiness: formData.monthsInBusiness } : {}),
    ...(formData.orderingContactName !== null ? { orderingContactName: formData.orderingContactName } : {}),
    ...(formData.orderingContactCellPhone !== null ? { orderingContactCellPhone: formData.orderingContactCellPhone } : {}),
    ...(formData.orderingContactEmail !== null ? { orderingContactEmail: formData.orderingContactEmail } : {}),
    ...(formData.apContactName !== null ? { apContactName: formData.apContactName } : {}),
    ...(formData.apDirectPhone !== null ? { apDirectPhone: formData.apDirectPhone } : {}),
    ...(formData.apEmail !== null ? { apEmail: formData.apEmail } : {}),
    ...(formData.paymentMethod !== null ? { paymentMethod: formData.paymentMethod } : {}),
    ...(formData.achAuthorized ? { achAuthorized: formData.achAuthorized } : {}),
    ...(formData.cardOnFileAuthorized ? { cardOnFileAuthorized: formData.cardOnFileAuthorized } : {}),
    ...(formData.resaleCertificateAttached ? { resaleCertificateAttached: formData.resaleCertificateAttached } : {}),
    ...(formData.signatureCapturedAt !== null ? { signatureCapturedAt: formData.signatureCapturedAt } : {}),
    ...(formData.submittedByProspectAt !== null ? { submittedByProspectAt: formData.submittedByProspectAt } : {}),
    ...(formData.lastSavedAt !== null ? { lastSavedAt: formData.lastSavedAt } : {}),
  };
}

function validateFinanceDecisionInput(cisPackage: CisPackageWithRelations, input: CisFinanceDecisionRequest) {
  const paymentMethod = cisPackage.formData?.paymentMethod ?? null;
  if (input.decision === 'approved') {
    if (!cisPackage.formData?.cardOnFileAuthorized) {
      throw new Error('Card-on-file authorization is required before approving finance');
    }
    if (paymentMethod !== CisPaymentMethod.CREDIT_CARD) {
      if (input.creditLineAmount === undefined) {
        throw new Error('creditLineAmount is required when approving non-card payment terms');
      }
      if (input.paymentTerms === undefined) {
        throw new Error('paymentTerms is required when approving non-card payment terms');
      }
    }
  }

  if ((input.decision === 'conditional' || input.decision === 'info_requested') && !optionalTrimmed(input.decisionNotes) && !optionalTrimmed(input.requestedInfoNotes)) {
    throw new Error('decisionNotes or requestedInfoNotes is required for conditional or info-requested outcomes');
  }

  if (input.decision === 'declined' && !optionalTrimmed(input.decisionNotes)) {
    throw new Error('decisionNotes is required when declining finance');
  }
}

function mapFinanceDecisionState(decision: CisFinanceDecisionRequest['decision']) {
  switch (decision) {
    case 'approved':
      return {
        packageStatus: CisPackageStatus.FINANCE_APPROVED,
        decisionStatus: CisFinanceDecisionStatus.APPROVED,
        eventType: 'finance_approved',
      } as const;
    case 'declined':
      return {
        packageStatus: CisPackageStatus.FINANCE_DECLINED,
        decisionStatus: CisFinanceDecisionStatus.DECLINED,
        eventType: 'finance_declined',
      } as const;
    case 'conditional':
      return {
        packageStatus: CisPackageStatus.FINANCE_PENDING,
        decisionStatus: CisFinanceDecisionStatus.CONDITIONAL,
        eventType: 'finance_conditional',
      } as const;
    case 'info_requested':
      return {
        packageStatus: CisPackageStatus.FINANCE_PENDING,
        decisionStatus: CisFinanceDecisionStatus.INFO_REQUESTED,
        eventType: 'finance_info_requested',
      } as const;
    default:
      throw new Error(`Unsupported finance decision: ${decision satisfies never}`);
  }
}

function normalizeCreditLineAmount(value: number | undefined) {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('creditLineAmount must be greater than zero');
  }
  return Math.round(value * 100);
}

function toCisPaymentTermsEnum(value: NonNullable<CisFinanceDecisionRequest['paymentTerms']>) {
  switch (value) {
    case 'NET_30':
      return CisPaymentTerms.NET_30;
    case 'NET_60':
      return CisPaymentTerms.NET_60;
    case 'COD':
      return CisPaymentTerms.COD;
    case 'CUSTOM':
      return CisPaymentTerms.CUSTOM;
    default:
      throw new Error(`Unsupported payment terms: ${value satisfies never}`);
  }
}

function calculateHoursOpen(isoTimestamp: string) {
  const openedAt = new Date(isoTimestamp).getTime();
  return Math.max(0, Math.floor((Date.now() - openedAt) / (60 * 60 * 1000)));
}
