import { assertActionAccess, assertModuleAccess, normalizeRole } from '@pulse/auth';
import {
  AuditAction,
  CisFinanceDecisionStatus,
  LeadCaptureMethod,
  LeadConsignmentEntryTiming,
  LeadConsignmentInterestStatus,
  LeadImportDuplicateDecision,
  LeadImportRunRowStatus,
  LeadImportRunStatus,
  LeadLifecycleStatus,
  LeadRoutingBasis,
  LeadRoutingTeam,
  LeadStage,
  GroupClassification,
  MobileVoiceNoteContextType,
  MobileVoiceNoteProcessingStatus,
  MobileVoiceNoteReviewStatus,
  TerritoryAssignmentMethod,
  Prisma,
  prisma,
  WebsiteLeadFormType,
  WebsiteLeadSubmissionOutcome,
  WebsiteLeadSubmissionReviewStatus,
  WebsiteLeadType,
} from '@pulse/db';
import type {
  CaptureWebsiteLeadResponse,
  CaptureWebsiteLeadRequest,
  CompleteLeadDiscoveryRequest,
  CommitLeadImportRunRequest,
  CreateLeadRequest,
  ImportLeadFileRequest,
  ImportLeadFileResponse,
  LeadImportDuplicateCandidate,
  LeadImportDuplicateDecisionKey,
  PreviewLeadDuplicateCandidatesRequest,
  PreviewLeadDuplicateCandidatesResponse,
  ImportLeadRowInput,
  LeadImportFileError,
  LeadImportFilePreviewRequest,
  LeadImportFilePreviewResponse,
  LeadImportPreviewRow,
  LeadImportReviewRow,
  LeadImportRunDetail,
  ImportLeadsRequest,
  ImportLeadsResponse,
  LeadLifecycleReasonCodeKey,
  LeadLifecycleStatusKey,
  LogLeadInitialContactRequest,
  LogLeadActivityNoteRequest,
  LogLeadActivityNoteResponse,
  LeadDetail,
  LeadConsignmentEntryTimingKey,
  LeadConsignmentInterestStatusKey,
  LeadRoutingBasisKey,
  LeadRoutingPolicySummary,
  LeadOperationalAlertRecipientSummary,
  LeadStageEventSummary,
  LeadStageKey,
  LeadWorkflowTaskSummary,
  LeadWorkflowActionTypeKey,
  LeadHistoryFeedEntry,
  LeadHistoryFeedActorSummary,
  ListLeadHistoryFeedRequest,
  ListLeadHistoryFeedResponse,
  LeadWorkflowQueueItem,
  LeadWorkflowQueueSummary,
  LeadWorkflowQueueViewKey,
  LeadWorkflowUrgencyKey,
  LeadSummary,
  LeadRoutingTeamKey,
  ListLeadWorkflowQueueRequest,
  ListLeadWorkflowQueueResponse,
  ListLeadsRequest,
  ListLeadsResponse,
  ListWebsiteFormLeadsRequest,
  ListWebsiteFormLeadsResponse,
  ListWebsiteLeadSubmissionsRequest,
  ListWebsiteLeadSubmissionsResponse,
  ResolveWebsiteLeadSubmissionRequest,
  ScheduleLeadDiscoveryRequest,
  ReviewLeadImportRequest,
  ReviewLeadImportResponse,
  SkipLeadDiscoveryRequest,
  TransitionLeadStageRequest,
  UpdateLeadLifecycleRequest,
  UpdateLeadOperationalAlertQuietHoursRequest,
  UpdateLeadOperationalAlertRecipientRequest,
  UpdateLeadRoutingPolicyRequest,
  UpdateLeadRequest,
  WebsiteFormLeadSummary,
  WebsiteLeadSubmissionSummary,
  WebsiteLeadTypeKey,
  TerritoryAssignmentMethodKey,
} from '@pulse/contracts';
import { findLeadRegionOption } from '@pulse/contracts';
import { createHash } from 'node:crypto';
import type { AppConfig } from '../../config.js';
import type { AuthenticatedActor } from '../auth/types.js';
import { resolveLeadRecordScope, resolveLeadRecordScopeSql } from '../auth/visibility.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import { JSON_SIZE_LIMITS, toBoundedJsonValue } from '../../utils/json.js';
import { assertNoRawPaymentCardData } from '../../utils/pci.js';
import {
  deriveGroupClassification,
  resolveAffinityGroupAxis,
  resolveOwnershipGroupAxis,
  toGroupAxisSelectionKey,
  toGroupClassificationKey,
} from '../reference/group-classification.js';
import {
  tryAutoSyncCalendarEventToOutlook,
  tryAutoUnsyncCalendarEventFromOutlook,
} from '../calendar/outlook.js';
import { mapLeadImportFile, previewLeadImportFile } from './file-ingest.js';
import {
  asString,
  normalizeEmailAddress,
  normalizeOptionalEmail,
  normalizeOptionalPhone,
  optionalTrimmed,
  requiredTrimmed,
  toWebsiteLeadSiteFormConfig,
} from './shared.js';
import {
  syncLeadTerritoryAssignment,
} from '../territories/service.js';
export {
  deadLetterLeadOperationalAlertDeliveries,
  ensureLeadOperationalAlertRecipientsSeeded,
  getLeadOperationalAlertDeliveryAdminSettings,
  listLeadOperationalAlertIntegrationStatuses,
  processLeadOperationalAlertDeliveryJob,
  processLeadOperationalAlertScanJob,
  retryLeadOperationalAlertDeliveries,
} from './alerts.js';
export {
  createWebsiteLeadNotificationRecipient,
  createWebsiteLeadSite,
  ensureWebsiteLeadConfigSeeded,
  getPublicWebsiteLeadSite,
  getPublicWebsiteLeadSiteAllowedOrigins,
  listWebsiteLeadNotificationRecipients,
  listActivePublicWebsiteLeadOrigins,
  listWebsiteLeadSites,
  updateWebsiteLeadNotificationRecipient,
  updateWebsiteLeadSite,
} from './website-config.js';

const LEAD_ENTITY_TYPE = 'LEAD';
const LEAD_ROUTING_POLICY_ENTITY_TYPE = 'LEAD_ROUTING_POLICY';
const LEAD_LIFECYCLE_REASON_CODES = new Set<LeadLifecycleReasonCodeKey>([
  'not_interested',
  'no_response',
  'duplicate',
  'disqualified',
  'follow_up_later',
  'other',
]);

const DEFAULT_BUSINESS_SEGMENT_CODE = 'residential';
const DEFAULT_MANUAL_LEAD_SOURCE_CODE = 'manual_entry';
const DEFAULT_WEBSITE_LEAD_SOURCE_CODE = 'branded_website';

const LEAD_SUMMARY_INCLUDE = {
  businessSegment: true,
  leadSource: true,
  affinityGroup: true,
  ownershipGroup: true,
  territory: {
    include: {
      region: {
        include: {
          directorUser: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      },
      shippingCenter: true,
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
} satisfies Prisma.LeadInclude;

const LEAD_DETAIL_INCLUDE = {
  ...LEAD_SUMMARY_INCLUDE,
  stageEvents: {
    orderBy: {
      occurredAt: 'desc',
    },
  },
  cisPackages: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
    include: {
      financeDecision: true,
    },
  },
  mobileVoiceNotes: {
    where: {
      reviewStatus: MobileVoiceNoteReviewStatus.APPROVED,
    },
    orderBy: {
      recordedAt: 'desc',
    },
    take: 5,
    include: {
      createdBy: { select: { displayName: true, email: true } },
      reviewedBy: { select: { displayName: true, email: true } },
    },
  },
} satisfies Prisma.LeadInclude;

const LEAD_WORKFLOW_INCLUDE = {
  ...LEAD_SUMMARY_INCLUDE,
  cisPackages: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
    include: {
      financeDecision: true,
    },
  },
} satisfies Prisma.LeadInclude;

const WEBSITE_LEAD_SUBMISSION_INCLUDE = {
  websiteLeadSite: true,
  linkedLead: {
    include: LEAD_SUMMARY_INCLUDE,
  },
  reviewedBy: {
    select: {
      id: true,
      displayName: true,
    },
  },
} satisfies Prisma.WebsiteLeadSubmissionInclude;

type LeadWithRefs = Prisma.LeadGetPayload<{
  include: typeof LEAD_SUMMARY_INCLUDE;
}>;

type WebsiteLeadSubmissionWithRefs = Prisma.WebsiteLeadSubmissionGetPayload<{
  include: typeof WEBSITE_LEAD_SUBMISSION_INCLUDE;
}>;

type LeadWithDetailRefs = Prisma.LeadGetPayload<{
  include: typeof LEAD_DETAIL_INCLUDE;
}>;

type LeadMutationContext = {
  actorUserId?: string;
  sessionId?: string;
  actorRole?: string;
  actorType: string;
  trigger: 'manual' | 'public_capture' | 'bulk_import' | 'stage_transition' | 'routing_policy';
};

type NormalizedLeadInput = {
  companyName: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactDisplayName: string;
  email?: string;
  phone?: string;
  state?: string;
  countryCode?: string;
  businessSegmentCode: string;
  leadSourceCode: string;
  leadCaptureMethod: LeadCaptureMethod;
  leadType?: WebsiteLeadType;
  sourceDetail?: string;
  sourceSiteId?: string;
  sourceSiteName?: string;
  sourceBrandTag?: string;
  sourceCampaign?: string;
  leadRating?: string;
  serviceTechCount: number;
  installTechCount?: number;
  truckCount?: number;
  salesPersonCount?: number;
  potentialValueCents?: number;
  affinityGroupSelection?: import('@pulse/contracts').GroupAxisSelectionKey;
  affinityGroupId?: string;
  affinityGroupCode?: string;
  affinityGroupName?: string;
  ownershipGroupSelection?: import('@pulse/contracts').GroupAxisSelectionKey;
  ownershipGroupId?: string;
  ownershipGroupCode?: string;
  ownershipGroupName?: string;
  privateLabelName?: string;
  leadOwnerName?: string;
  assignedTmName?: string;
  notes?: string;
};

type LeadInputSource = {
  companyName?: unknown;
  contactFirstName?: unknown;
  contactLastName?: unknown;
  contactDisplayName?: unknown;
  email?: unknown;
  phone?: unknown;
  state?: unknown;
  countryCode?: unknown;
  businessSegmentCode?: unknown;
  leadSourceCode?: unknown;
  leadType?: unknown;
  sourceDetail?: unknown;
  sourceSiteId?: unknown;
  sourceSiteName?: unknown;
  sourceBrandTag?: unknown;
  sourceCampaign?: unknown;
  leadRating?: unknown;
  serviceTechCount?: unknown;
  installTechCount?: unknown;
  truckCount?: unknown;
  salesPersonCount?: unknown;
  potentialValueCents?: unknown;
  affinityGroupSelection?: unknown;
  affinityGroupId?: unknown;
  affinityGroupCode?: unknown;
  affinityGroupName?: unknown;
  ownershipGroupSelection?: unknown;
  ownershipGroupId?: unknown;
  ownershipGroupCode?: unknown;
  ownershipGroupName?: unknown;
  privateLabelName?: unknown;
  leadOwnerName?: unknown;
  assignedTmName?: unknown;
  notes?: unknown;
};

type ResolvedLeadDependencies = {
  businessSegmentId: string;
  businessSegmentCode: string;
  leadSourceId: string;
};

type RoutingDecision = {
  routingBasis: LeadRoutingBasis;
  threshold: number;
  routingTeam: LeadRoutingTeam;
  leadOwnerName?: string;
};

type LeadWithWorkflowRefs = Prisma.LeadGetPayload<{
  include: typeof LEAD_WORKFLOW_INCLUDE;
}>;

type WorkflowTask = {
  nextAction: string;
  actionType: LeadWorkflowActionTypeKey;
  urgency: LeadWorkflowUrgencyKey;
  colorToken: string;
  reason: string;
  financeDecisionStatus?: LeadWorkflowQueueItem['financeDecisionStatus'];
};

type WorkflowQueueComputation = {
  item: LeadWorkflowQueueItem;
  stageAnchorAt: Date;
};

type InitialContactSlaState = {
  dueAt: Date;
  hoursUntilDue: number;
  hasInitialContact: boolean;
  overdue: boolean;
  urgent: boolean;
};

type DiscoverySchedulingSlaState = {
  applicable: boolean;
  dueAt?: Date;
  hoursUntilDue?: number;
  overdue: boolean;
  urgent: boolean;
};

type CisFollowUpSlaState = {
  applicable: boolean;
  dueAt?: Date;
  reminderAt?: Date;
  businessDaysUntilDue?: number;
  overdue: boolean;
  reminderDue: boolean;
};

type LeadRoutingPolicyRecord = Prisma.LeadRoutingPolicyGetPayload<{}>;

const LEAD_STAGE_ORDER: Record<LeadStage, number> = {
  NEW: 1,
  DISCOVERY_SCHEDULED: 2,
  DISCOVERY_COMPLETED: 3,
  CIS_SENT: 4,
  CIS_SIGNED: 5,
  ONBOARDING_COMPLETED: 6,
  CUSTOMER_ACTIVE: 7,
};

export async function ensureLeadRoutingPolicySeeded() {
  try {
    await prisma.leadRoutingPolicy.upsert({
      where: {
        id: 'default',
      },
      update: {},
      create: {
        id: 'default',
        routingBasis: LeadRoutingBasis.SERVICE_TECH_COUNT,
        strategicGrowthMax: 5,
        notes: 'Meetings-backed default as of March 13, 2026: route using service technician count, not truck count.',
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      await prisma.leadRoutingPolicy.update({
        where: { id: 'default' },
        data: {},
      });
      return;
    }

    throw error;
  }
}

export async function listLeads(actor: AuthenticatedActor, query: ListLeadsRequest = {}): Promise<ListLeadsResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.view');

  const limit = normalizeLimit(query.limit);
  const search = optionalTrimmed(query.search);
  const scopeWhere = await resolveLeadRecordScope(actor);
  const where: Prisma.LeadWhereInput = {
    lifecycleStatus: query.lifecycleStatus
      ? toLeadLifecycleStatusEnum(query.lifecycleStatus)
      : LeadLifecycleStatus.ACTIVE,
  };

  if (query.stage) {
    where.stage = toLeadStageEnum(query.stage);
  }
  if (query.routingTeam) {
    where.routingTeam = toLeadRoutingTeamEnum(query.routingTeam);
  }
  if (query.leadSourceCode) {
    where.leadSource = {
      code: normalizeCode(query.leadSourceCode),
    };
  }
  // UX-L-014: affinity group / ownership group / territory filters.
  // Group codes are stored UPPER_SNAKE (see normalizeOptionalCode in reference/group-classification),
  // so the filter must use the same normalization — normalizeCode (lower-case) never matched.
  if (query.affinityGroupCode) {
    where.affinityGroup = { code: normalizeGroupCode(query.affinityGroupCode) };
  }
  if (query.ownershipGroupCode) {
    where.ownershipGroup = { code: normalizeGroupCode(query.ownershipGroupCode) };
  }
  if (query.territoryId) {
    where.territoryId = query.territoryId;
  }
  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { contactDisplayName: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { phone: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { affinityGroup: { is: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } } },
      { ownershipGroup: { is: { name: { contains: search, mode: Prisma.QueryMode.insensitive } } } },
    ];
  }

  // UX-L-013: pagination
  const pageSize = limit;
  const pageIndex = query.page !== undefined ? Math.max(0, query.page) : 0;
  const skipCount = pageIndex * pageSize;

  const [policy, items, total] = await Promise.all([
    prisma.leadRoutingPolicy.findUnique({
      where: {
        id: 'default',
      },
    }),
    prisma.lead.findMany({
      where: scopeWhere ? { AND: [scopeWhere, where] } : where,
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: pageSize,
      skip: skipCount,
      include: LEAD_WORKFLOW_INCLUDE,
    }),
    prisma.lead.count({ where: scopeWhere ? { AND: [scopeWhere, where] } : where }),
  ]);

  if (!policy) {
    throw new Error('Lead routing policy is not seeded');
  }

  return {
    items: items.map((lead) => toLeadSummaryWithWorkflowTask(lead, policy)),
    total,
  };
}

export async function listWebsiteFormLeads(
  actor: AuthenticatedActor,
  query: ListWebsiteFormLeadsRequest = {},
): Promise<ListWebsiteFormLeadsResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.view');

  const limit = normalizeLimit(query.limit);
  const search = optionalTrimmed(query.search);
  const sourceSiteId = optionalTrimmed(query.sourceSiteId);
  const scopeWhere = await resolveLeadRecordScope(actor);
  const where: Prisma.LeadWhereInput = {
    leadCaptureMethod: LeadCaptureMethod.DIRECT_WEB_FORM,
    lifecycleStatus: query.lifecycleStatus
      ? toLeadLifecycleStatusEnum(query.lifecycleStatus)
      : LeadLifecycleStatus.ACTIVE,
  };

  if (query.stage) {
    where.stage = toLeadStageEnum(query.stage);
  }
  if (sourceSiteId) {
    where.sourceSiteId = sourceSiteId;
  }
  if (search) {
    where.OR = buildWebsiteLeadSearchClauses(search);
  }

  const activePipelineWhere: Prisma.LeadWhereInput = {
    AND: [
      ...(scopeWhere ? [scopeWhere] : []),
      where,
      {
        stage: {
          not: LeadStage.CUSTOMER_ACTIVE,
        },
      },
      {
        lifecycleStatus: LeadLifecycleStatus.ACTIVE,
      },
    ],
  };

  const [items, total, activePipelineCount, siteGroups, aggregate] = await Promise.all([
    prisma.lead.findMany({
      where: scopeWhere ? { AND: [scopeWhere, where] } : where,
      orderBy: [
        { createdAt: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: limit,
      include: LEAD_SUMMARY_INCLUDE,
    }),
    prisma.lead.count({ where: scopeWhere ? { AND: [scopeWhere, where] } : where }),
    prisma.lead.count({ where: activePipelineWhere }),
    prisma.lead.groupBy({
      by: ['sourceSiteId', 'sourceSiteName'],
      where: scopeWhere ? { AND: [scopeWhere, where] } : where,
    }),
    prisma.lead.aggregate({
      where: scopeWhere ? { AND: [scopeWhere, where] } : where,
      _max: {
        createdAt: true,
      },
    }),
  ]);

  return {
    items: items.map((item) => toWebsiteFormLeadSummary(item)),
    total,
    summary: {
      activePipelineCount,
      convertedCount: Math.max(total - activePipelineCount, 0),
      siteCount: siteGroups.filter((group) => group.sourceSiteId || group.sourceSiteName).length,
      ...(aggregate._max.createdAt ? { latestLeadAt: aggregate._max.createdAt.toISOString() } : {}),
    },
  };
}

export async function listWebsiteLeadSubmissions(
  actor: AuthenticatedActor,
  query: ListWebsiteLeadSubmissionsRequest = {},
): Promise<ListWebsiteLeadSubmissionsResponse> {
  assertModuleAccess(actor.role, 'leads');
  // Raw inbound submissions carry unfiltered contact PII and are a triage surface, not a
  // per-territory CRM view. Match the sibling resolve endpoint (lead.intake_manage) so view-only
  // roles (TM/RD/FINANCE) can't enumerate every submission platform-wide.
  assertActionAccess(actor.role, 'lead.intake_manage');

  const limit = normalizeLimit(query.limit);
  const search = optionalTrimmed(query.search);
  const sourceSiteId = optionalTrimmed(query.sourceSiteId);
  const where: Prisma.WebsiteLeadSubmissionWhereInput = {};

  if (query.outcome) {
    where.outcome = query.outcome === 'attached_to_existing_lead'
      ? WebsiteLeadSubmissionOutcome.ATTACHED_TO_EXISTING_LEAD
      : WebsiteLeadSubmissionOutcome.CREATED_NEW_LEAD;
  }

  if (sourceSiteId) {
    where.websiteLeadSite = {
      is: {
        siteId: sourceSiteId,
      },
    };
  }

  if (search) {
    where.OR = buildWebsiteLeadSubmissionSearchClauses(search);
  }

  const [items, total, duplicateCount, createdLeadCount, pendingReviewCount, resolvedCount, siteGroups, linkedLeadGroups, aggregate] = await Promise.all([
    prisma.websiteLeadSubmission.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit,
      include: WEBSITE_LEAD_SUBMISSION_INCLUDE,
    }),
    prisma.websiteLeadSubmission.count({ where }),
    prisma.websiteLeadSubmission.count({
      where: {
        ...where,
        outcome: WebsiteLeadSubmissionOutcome.ATTACHED_TO_EXISTING_LEAD,
      },
    }),
    prisma.websiteLeadSubmission.count({
      where: {
        ...where,
        outcome: WebsiteLeadSubmissionOutcome.CREATED_NEW_LEAD,
      },
    }),
    prisma.websiteLeadSubmission.count({
      where: {
        ...where,
        reviewStatus: WebsiteLeadSubmissionReviewStatus.PENDING_REVIEW,
      },
    }),
    prisma.websiteLeadSubmission.count({
      where: {
        ...where,
        reviewStatus: {
          in: [
            WebsiteLeadSubmissionReviewStatus.CONFIRMED_EXISTING,
            WebsiteLeadSubmissionReviewStatus.CREATED_NEW_LEAD,
            WebsiteLeadSubmissionReviewStatus.RELINKED_EXISTING,
          ],
        },
      },
    }),
    prisma.websiteLeadSubmission.groupBy({
      by: ['websiteLeadSiteId'],
      where,
    }),
    prisma.websiteLeadSubmission.groupBy({
      by: ['linkedLeadId'],
      where,
    }),
    prisma.websiteLeadSubmission.aggregate({
      where,
      _max: {
        createdAt: true,
      },
    }),
  ]);

  return {
    items: items.map((item) => toWebsiteLeadSubmissionSummary(item)),
    total,
    summary: {
      duplicateCount,
      createdLeadCount,
      pendingReviewCount,
      resolvedCount,
      siteCount: siteGroups.filter((group) => group.websiteLeadSiteId).length,
      uniqueLinkedLeadCount: linkedLeadGroups.filter((group) => group.linkedLeadId).length,
      ...(aggregate._max.createdAt ? { latestSubmissionAt: aggregate._max.createdAt.toISOString() } : {}),
    },
  };
}

export async function resolveWebsiteLeadSubmission(
  actor: AuthenticatedActor,
  submissionId: string,
  input: ResolveWebsiteLeadSubmissionRequest,
): Promise<WebsiteLeadSubmissionSummary> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const decision = requiredTrimmed(input.decision, 'decision');
  const reviewNote = optionalTrimmed(input.reviewNote) ?? null;
  const targetLeadId = optionalTrimmed(input.targetLeadId) ?? null;

  const updatedSubmission = await prisma.$transaction(async (tx) => {
    const submission = await tx.websiteLeadSubmission.findUnique({
      where: { id: submissionId },
      include: WEBSITE_LEAD_SUBMISSION_INCLUDE,
    });

    if (!submission) {
      throw new Error('Website lead submission not found');
    }

    if (submission.outcome !== WebsiteLeadSubmissionOutcome.ATTACHED_TO_EXISTING_LEAD) {
      throw new Error('Only repeat website submissions require duplicate-resolution actions');
    }

    if (submission.reviewStatus !== WebsiteLeadSubmissionReviewStatus.PENDING_REVIEW) {
      if (
        (decision === 'confirm_existing' && submission.reviewStatus === WebsiteLeadSubmissionReviewStatus.CONFIRMED_EXISTING)
        || (decision === 'enrich_existing' && submission.reviewStatus === WebsiteLeadSubmissionReviewStatus.CONFIRMED_EXISTING)
        || (decision === 'create_new_lead' && submission.reviewStatus === WebsiteLeadSubmissionReviewStatus.CREATED_NEW_LEAD)
        || (
          decision === 'relink_existing'
          && submission.reviewStatus === WebsiteLeadSubmissionReviewStatus.RELINKED_EXISTING
          && submission.linkedLeadId === targetLeadId
        )
      ) {
        return submission;
      }

      throw new Error('This duplicate submission has already been resolved');
    }

    let nextLinkedLeadId = submission.linkedLeadId ?? null;
    let nextReviewStatus: WebsiteLeadSubmissionReviewStatus;
    let createdLead: LeadWithRefs | null = null;

    switch (decision) {
      case 'confirm_existing':
        if (!submission.linkedLeadId) {
          throw new Error('Duplicate submission is missing its linked lead');
        }
        nextReviewStatus = WebsiteLeadSubmissionReviewStatus.CONFIRMED_EXISTING;
        break;
      case 'enrich_existing': {
        const selectedLeadId = targetLeadId ?? submission.linkedLeadId;
        if (!selectedLeadId) {
          throw new Error('Duplicate submission is missing its linked lead');
        }
        if (submission.linkedLeadId && targetLeadId && submission.linkedLeadId !== targetLeadId) {
          throw new Error('Use relink existing before enriching a different lead from this submission.');
        }

        const normalized = normalizeLeadInput(
          buildLeadInputFromWebsiteSubmission(submission),
          {
            defaultBusinessSegmentCode: DEFAULT_BUSINESS_SEGMENT_CODE,
            defaultLeadSourceCode: DEFAULT_WEBSITE_LEAD_SOURCE_CODE,
            leadCaptureMethod: LeadCaptureMethod.DIRECT_WEB_FORM,
          },
        );

        await enrichExistingLeadFromDuplicate(
          tx,
          actor,
          normalized,
          {
            decision: 'enrich_existing',
            reason: reviewNote ?? 'Website repeat submission enriched an existing lead.',
            targetEntityId: selectedLeadId,
          },
          [{
            entityType: 'lead',
            entityId: selectedLeadId,
            title: submission.linkedLead?.companyName ?? submission.companyName ?? 'Linked lead',
            ...(submission.linkedLead?.contactDisplayName ? { subtitle: submission.linkedLead.contactDisplayName } : {}),
            detail: 'Website repeat-submission duplicate review',
          }],
        );
        nextLinkedLeadId = selectedLeadId;
        nextReviewStatus = WebsiteLeadSubmissionReviewStatus.CONFIRMED_EXISTING;
        break;
      }
      case 'relink_existing': {
        if (!targetLeadId) {
          throw new Error('targetLeadId is required when relinking a duplicate submission');
        }
        if (submission.linkedLeadId === targetLeadId) {
          throw new Error('Selected lead is already linked to this submission. Use confirm existing instead.');
        }

        const targetLead = await tx.lead.findUnique({
          where: { id: targetLeadId },
          include: LEAD_SUMMARY_INCLUDE,
        });
        if (!targetLead) {
          throw new Error('Selected lead for relink was not found');
        }
        if (targetLead.lifecycleStatus !== LeadLifecycleStatus.ACTIVE || targetLead.stage === LeadStage.CUSTOMER_ACTIVE) {
          throw new Error('Duplicate submissions can only be relinked to active in-flight leads');
        }

        nextLinkedLeadId = targetLead.id;
        nextReviewStatus = WebsiteLeadSubmissionReviewStatus.RELINKED_EXISTING;
        break;
      }
      case 'create_new_lead': {
        const normalized = normalizeLeadInput(
          buildLeadInputFromWebsiteSubmission(submission),
          {
            defaultBusinessSegmentCode: DEFAULT_BUSINESS_SEGMENT_CODE,
            defaultLeadSourceCode: DEFAULT_WEBSITE_LEAD_SOURCE_CODE,
            leadCaptureMethod: LeadCaptureMethod.DIRECT_WEB_FORM,
          },
        );

        createdLead = await createLeadRecord(
          tx,
          normalized,
          {
            actorUserId: actor.userId,
            sessionId: actor.sessionId,
            actorRole: actor.role,
            actorType: actor.actorType,
            trigger: 'public_capture',
          },
          {
            sourceMetadata: buildWebsiteLeadSubmissionSourceMetadata(submission),
          },
        );
        nextLinkedLeadId = createdLead.id;
        nextReviewStatus = WebsiteLeadSubmissionReviewStatus.CREATED_NEW_LEAD;
        break;
      }
      default:
        throw new Error(`Unsupported duplicate-resolution decision: ${decision}`);
    }

    const updated = await tx.websiteLeadSubmission.update({
      where: { id: submissionId },
      data: {
        ...(nextLinkedLeadId ? { linkedLeadId: nextLinkedLeadId } : { linkedLeadId: null }),
        reviewStatus: nextReviewStatus,
        reviewedByUserId: actor.userId,
        reviewedAt: new Date(),
        reviewNote,
      },
      include: WEBSITE_LEAD_SUBMISSION_INCLUDE,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: 'WEBSITE_LEAD_SUBMISSION',
        entityId: updated.id,
        beforeData: {
          linkedLeadId: submission.linkedLeadId,
          reviewStatus: toWebsiteLeadSubmissionReviewStatusKey(submission.reviewStatus),
          reviewNote: submission.reviewNote,
        },
        afterData: {
          linkedLeadId: updated.linkedLeadId,
          reviewStatus: toWebsiteLeadSubmissionReviewStatusKey(updated.reviewStatus),
          reviewNote: updated.reviewNote,
          ...(createdLead ? { createdLeadId: createdLead.id } : {}),
        },
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
          operation: 'lead.website_submission.resolve',
          decision,
        },
      }),
    });

    if (updated.linkedLeadId) {
      await tx.auditEntry.create({
        data: buildAuditEntryData({
          actorUserId: actor.userId,
          action: AuditAction.UPDATE,
          entityType: LEAD_ENTITY_TYPE,
          entityId: updated.linkedLeadId,
          afterData: {
            duplicateSubmissionReview: {
              submissionId: updated.id,
              reviewStatus: toWebsiteLeadSubmissionReviewStatusKey(updated.reviewStatus),
              decision,
              ...(updated.reviewNote ? { reviewNote: updated.reviewNote } : {}),
            },
          },
          metadata: {
            actorRole: actor.role,
            actorType: actor.actorType,
            sessionId: actor.sessionId,
            operation: 'lead.website_submission.resolve',
            decision,
          },
        }),
      });
    }

    if (submission.linkedLeadId && submission.linkedLeadId !== updated.linkedLeadId) {
      await tx.auditEntry.create({
        data: buildAuditEntryData({
          actorUserId: actor.userId,
          action: AuditAction.UPDATE,
          entityType: LEAD_ENTITY_TYPE,
          entityId: submission.linkedLeadId,
          afterData: {
            duplicateSubmissionReview: {
              submissionId: updated.id,
              reviewStatus: toWebsiteLeadSubmissionReviewStatusKey(updated.reviewStatus),
              decision,
              relinkedAway: true,
              nextLinkedLeadId: updated.linkedLeadId ?? null,
              ...(updated.reviewNote ? { reviewNote: updated.reviewNote } : {}),
            },
          },
          metadata: {
            actorRole: actor.role,
            actorType: actor.actorType,
            sessionId: actor.sessionId,
            operation: 'lead.website_submission.resolve',
            decision,
          },
        }),
      });
    }

    return updated;
  });

  return toWebsiteLeadSubmissionSummary(updatedSubmission);
}


export async function listLeadWorkflowQueue(
  actor: AuthenticatedActor,
  query: ListLeadWorkflowQueueRequest = {},
): Promise<ListLeadWorkflowQueueResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.view');

  const limit = normalizeLimit(query.limit);
  const search = optionalTrimmed(query.search);
  const scopeWhere = await resolveLeadRecordScope(actor);
  const where: Prisma.LeadWhereInput = {
    stage: {
      not: LeadStage.CUSTOMER_ACTIVE,
    },
    lifecycleStatus: LeadLifecycleStatus.ACTIVE,
  };

  if (query.routingTeam) {
    where.routingTeam = toLeadRoutingTeamEnum(query.routingTeam);
  }
  if (search) {
    where.OR = buildWorkflowLeadSearchClauses(search);
  }

  const [policy, leads] = await Promise.all([
    prisma.leadRoutingPolicy.findUnique({
      where: {
        id: 'default',
      },
    }),
    prisma.lead.findMany({
      where: scopeWhere ? { AND: [scopeWhere, where] } : where,
      orderBy: [
        { updatedAt: 'asc' },
        { createdAt: 'asc' },
      ],
      include: LEAD_WORKFLOW_INCLUDE,
    }),
  ]);

  if (!policy) {
    throw new Error('Lead routing policy is not seeded');
  }

  const now = new Date();
  const queueComputations = leads
    .map((lead) => toWorkflowQueueComputationWithPolicy(lead, now, policy))
    .sort((left, right) => {
      const urgencyDelta = getWorkflowUrgencyWeight(right.item.urgency) - getWorkflowUrgencyWeight(left.item.urgency);
      if (urgencyDelta !== 0) {
        return urgencyDelta;
      }
      if (left.item.slaRisk !== right.item.slaRisk) {
        return left.item.slaRisk ? -1 : 1;
      }

      return left.stageAnchorAt.getTime() - right.stageAnchorAt.getTime();
    });

  const summary = summarizeWorkflowQueue(queueComputations.map((entry) => entry.item), policy.stagnantStageDays);
  const filteredItems = filterWorkflowQueueItems(
    queueComputations.map((entry) => entry.item),
    query.view,
    policy.stagnantStageDays,
  );

  return {
    items: filteredItems.slice(0, limit),
    total: filteredItems.length,
    summary,
  };
}

export async function listLeadHistoryFeed(
  actor: AuthenticatedActor,
  query: ListLeadHistoryFeedRequest = {},
): Promise<ListLeadHistoryFeedResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.view');

  const limit = normalizeLimit(query.limit);
  const search = optionalTrimmed(query.search);
  // Scoped roles (TM/RD) only see history for leads in their book; entries whose lead falls
  // outside scope are dropped below because the lead never lands in leadById.
  const scopeWhere = await resolveLeadRecordScope(actor);

  const entries = await prisma.auditEntry.findMany({
    where: {
      entityType: LEAD_ENTITY_TYPE,
    },
    orderBy: [{ createdAt: 'desc' }],
    take: search ? 300 : Math.min(Math.max(limit * 3, limit), 300),
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

  const leadIds = [...new Set(entries.flatMap((entry) => (entry.entityId ? [entry.entityId] : [])))];
  const leads = leadIds.length === 0
    ? []
    : await prisma.lead.findMany({
        where: scopeWhere
          ? { AND: [scopeWhere, { id: { in: leadIds } }] }
          : { id: { in: leadIds } },
        include: LEAD_SUMMARY_INCLUDE,
      });
  const leadById = new Map(leads.map((lead) => [lead.id, lead] as const));

  const items = entries
    .map((entry) => {
      if (!entry.entityId) {
        return null;
      }

      const lead = leadById.get(entry.entityId);
      if (!lead) {
        return null;
      }

      const item = toLeadHistoryFeedEntry(entry, lead);
      if (!item) {
        return null;
      }

      if (search) {
        const haystacks = [
          item.companyName,
          item.contactDisplayName,
          item.title,
          item.summary,
          item.actor?.displayName,
          item.actor?.email,
        ];
        if (!haystacks.some((value) => (value ?? '').toLowerCase().includes(search.toLowerCase()))) {
          return null;
        }
      }

      return item;
    })
    .filter((item): item is LeadHistoryFeedEntry => item !== null)
    .slice(0, limit);

  return {
    items,
    total: items.length,
  };
}

export async function getLeadDetail(actor: AuthenticatedActor, leadId: string): Promise<LeadDetail | null> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.view');
  const scopeWhere = await resolveLeadRecordScope(actor);

  const [lead, policy] = await Promise.all([
    prisma.lead.findFirst({
      where: scopeWhere ? { AND: [scopeWhere, { id: leadId }] } : { id: leadId },
      include: LEAD_DETAIL_INCLUDE,
    }),
    prisma.leadRoutingPolicy.findUnique({
      where: {
        id: 'default',
      },
    }),
  ]);

  if (!lead) {
    return null;
  }

  return toLeadDetail(lead, policy ?? buildInMemoryLeadRoutingPolicy());
}

export async function updateLead(
  actor: AuthenticatedActor,
  leadId: string,
  input: UpdateLeadRequest,
): Promise<LeadDetail> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const scopeWhere = await resolveLeadRecordScope(actor);

  await prisma.$transaction(async (tx) => {
    const current = await tx.lead.findFirst({
      where: scopeWhere ? { AND: [scopeWhere, { id: leadId }] } : { id: leadId },
      include: LEAD_DETAIL_INCLUDE,
    });

    if (!current) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    const data: Prisma.LeadUpdateInput = {};
    const beforeData: Record<string, unknown> = {};
    const afterData: Record<string, unknown> = {};

    applyLeadEditableTextPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'contactFirstName',
      nextValue: input.contactFirstName,
      mode: 'nullable',
    });
    applyLeadEditableTextPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'contactLastName',
      nextValue: input.contactLastName,
      mode: 'nullable',
    });
    applyLeadEditableTextPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'companyName',
      nextValue: input.companyName,
      mode: 'required',
    });
    applyLeadEditableTextPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'contactDisplayName',
      nextValue: input.contactDisplayName,
      mode: 'required',
    });
    applyLeadEditableTextPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'email',
      nextValue: input.email,
      mode: 'email',
    });
    applyLeadEditableTextPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'phone',
      nextValue: input.phone,
      mode: 'nullable',
    });
    applyLeadEditableTextPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'sourceDetail',
      nextValue: input.sourceDetail,
      mode: 'nullable',
    });
    applyLeadEditableTextPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'sourceSiteId',
      nextValue: input.sourceSiteId,
      mode: 'nullable',
    });
    applyLeadEditableTextPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'sourceSiteName',
      nextValue: input.sourceSiteName,
      mode: 'nullable',
    });
    applyLeadEditableTextPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'sourceBrandTag',
      nextValue: input.sourceBrandTag,
      mode: 'nullable',
    });
    applyLeadEditableTextPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'sourceCampaign',
      nextValue: input.sourceCampaign,
      mode: 'nullable',
    });
    applyLeadEditableTextPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'leadRating',
      nextValue: input.leadRating,
      mode: 'nullable',
    });
    applyLeadEditableTextPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'privateLabelName',
      nextValue: input.privateLabelName,
      mode: 'nullable',
    });
    applyLeadEditableTextPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'notes',
      nextValue: input.notes,
      mode: 'nullable',
    });

    if (input.state !== undefined || input.countryCode !== undefined) {
      const nextState = input.state !== undefined
        ? normalizeState(input.state ?? undefined) ?? null
        : current.state ?? null;
      const nextCountryCode = input.countryCode !== undefined
        ? normalizeCountryCode(input.countryCode ?? undefined, nextState ?? undefined) ?? null
        : (nextState
            ? normalizeCountryCode(undefined, nextState) ?? current.countryCode ?? null
            : current.countryCode ?? null);

      if ((current.state ?? null) !== nextState) {
        data.state = nextState;
        beforeData.state = current.state ?? null;
        afterData.state = nextState;
      }
      if ((current.countryCode ?? null) !== nextCountryCode) {
        data.countryCode = nextCountryCode;
        beforeData.countryCode = current.countryCode ?? null;
        afterData.countryCode = nextCountryCode;
      }
    }

    if (input.businessSegmentCode !== undefined || input.leadSourceCode !== undefined) {
      const dependencies = await resolveLeadDependencies(
        tx,
        input.businessSegmentCode ?? current.businessSegment.code,
        input.leadSourceCode ?? current.leadSource.code,
      );

      if (current.businessSegmentId !== dependencies.businessSegmentId) {
        data.businessSegment = { connect: { id: dependencies.businessSegmentId } };
        beforeData.businessSegmentCode = current.businessSegment.code;
        afterData.businessSegmentCode = dependencies.businessSegmentCode;
      }

      if (current.leadSourceId !== dependencies.leadSourceId) {
        data.leadSource = { connect: { id: dependencies.leadSourceId } };
        beforeData.leadSourceCode = current.leadSource.code;
        afterData.leadSourceCode = input.leadSourceCode ? normalizeCode(input.leadSourceCode) : current.leadSource.code;
      }
    }

    applyLeadEditableNumberPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'serviceTechCount',
      nextValue: input.serviceTechCount,
      mode: 'required',
    });
    applyLeadEditableNumberPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'installTechCount',
      nextValue: input.installTechCount,
      mode: 'nullable',
    });
    applyLeadEditableNumberPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'truckCount',
      nextValue: input.truckCount,
      mode: 'nullable',
    });
    applyLeadEditableNumberPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'salesPersonCount',
      nextValue: input.salesPersonCount,
      mode: 'nullable',
    });
    applyLeadEditableNumberPatch({
      data,
      beforeData,
      afterData,
      current,
      field: 'potentialValueCents',
      nextValue: input.potentialValueCents,
      mode: 'nullable',
    });

    if (
      input.affinityGroupSelection !== undefined
      || input.affinityGroupCode !== undefined
      || input.ownershipGroupSelection !== undefined
      || input.ownershipGroupCode !== undefined
    ) {
      const classification = await resolveLeadClassification(
        tx,
        {
          companyName: current.companyName,
          contactDisplayName: current.contactDisplayName,
          businessSegmentCode: current.businessSegment.code,
          leadSourceCode: current.leadSource.code,
          leadCaptureMethod: current.leadCaptureMethod,
          serviceTechCount: input.serviceTechCount ?? current.serviceTechCount,
          ...(input.truckCount !== undefined
            ? input.truckCount === null
              ? {}
              : { truckCount: normalizePositiveInteger(input.truckCount, 'truckCount', true) }
            : current.truckCount !== null && current.truckCount !== undefined
              ? { truckCount: current.truckCount }
              : {}),
          affinityGroupSelection: input.affinityGroupSelection ?? toGroupAxisSelectionKey(current.affinityGroupSelection),
          ...(input.affinityGroupCode !== undefined
            ? (optionalTrimmed(input.affinityGroupCode ?? undefined) ? { affinityGroupCode: optionalTrimmed(input.affinityGroupCode ?? undefined) } : {})
            : current.affinityGroup?.code
              ? { affinityGroupCode: current.affinityGroup.code }
              : {}),
          ownershipGroupSelection: input.ownershipGroupSelection ?? toGroupAxisSelectionKey(current.ownershipGroupSelection),
          ...(input.ownershipGroupCode !== undefined
            ? (optionalTrimmed(input.ownershipGroupCode ?? undefined) ? { ownershipGroupCode: optionalTrimmed(input.ownershipGroupCode ?? undefined) } : {})
            : current.ownershipGroup?.code
              ? { ownershipGroupCode: current.ownershipGroup.code }
              : {}),
        } as NormalizedLeadInput,
        {
          requireExplicitSelection: false,
          disallowUnknownSelection: false,
        },
      );

      if (current.affinityGroupSelection !== classification.affinity.selection) {
        data.affinityGroupSelection = classification.affinity.selection;
        beforeData.affinityGroupSelection = toGroupAxisSelectionKey(current.affinityGroupSelection);
        afterData.affinityGroupSelection = toGroupAxisSelectionKey(classification.affinity.selection);
      }
      if ((current.affinityGroupId ?? null) !== classification.affinity.id) {
        data.affinityGroup = classification.affinity.id
          ? { connect: { id: classification.affinity.id } }
          : { disconnect: true };
        beforeData.affinityGroupCode = current.affinityGroup?.code ?? null;
        afterData.affinityGroupCode = classification.affinity.code ?? null;
      }

      if (current.ownershipGroupSelection !== classification.ownership.selection) {
        data.ownershipGroupSelection = classification.ownership.selection;
        beforeData.ownershipGroupSelection = toGroupAxisSelectionKey(current.ownershipGroupSelection);
        afterData.ownershipGroupSelection = toGroupAxisSelectionKey(classification.ownership.selection);
      }
      if ((current.ownershipGroupId ?? null) !== classification.ownership.id) {
        data.ownershipGroup = classification.ownership.id
          ? { connect: { id: classification.ownership.id } }
          : { disconnect: true };
        beforeData.ownershipGroupCode = current.ownershipGroup?.code ?? null;
        afterData.ownershipGroupCode = classification.ownership.code ?? null;
      }

      if ((current.groupClassification ?? null) !== (classification.groupClassification ?? null)) {
        data.groupClassification = classification.groupClassification;
        beforeData.groupClassification = current.groupClassification ? toGroupClassificationKey(current.groupClassification) : null;
        afterData.groupClassification = classification.groupClassification ? toGroupClassificationKey(classification.groupClassification) : null;
      }
    }

    if (
      input.serviceTechCount !== undefined
      || input.truckCount !== undefined
    ) {
      const policy = await getRoutingPolicy(tx);
      const routing = resolveRoutingDecision(
        {
          companyName: current.companyName,
          contactDisplayName: current.contactDisplayName,
          businessSegmentCode: current.businessSegment.code,
          leadSourceCode: current.leadSource.code,
          leadCaptureMethod: current.leadCaptureMethod,
          serviceTechCount: input.serviceTechCount ?? current.serviceTechCount,
          ...(input.truckCount !== undefined
            ? input.truckCount === null
              ? {}
              : { truckCount: normalizePositiveInteger(input.truckCount, 'truckCount', true) }
            : current.truckCount !== null && current.truckCount !== undefined
              ? { truckCount: current.truckCount }
              : {}),
        } as NormalizedLeadInput,
        policy,
      );

      if (current.routingBasisSnapshot !== routing.routingBasis) {
        data.routingBasisSnapshot = routing.routingBasis;
        beforeData.routingBasis = current.routingBasisSnapshot === LeadRoutingBasis.TRUCK_COUNT ? 'truck_count' : 'service_tech_count';
        afterData.routingBasis = routing.routingBasis === LeadRoutingBasis.TRUCK_COUNT ? 'truck_count' : 'service_tech_count';
      }
      if (current.routingThresholdSnapshot !== routing.threshold) {
        data.routingThresholdSnapshot = routing.threshold;
        beforeData.routingThreshold = current.routingThresholdSnapshot;
        afterData.routingThreshold = routing.threshold;
      }
      if (current.routingTeam !== routing.routingTeam) {
        data.routingTeam = routing.routingTeam;
        beforeData.routingTeam = current.routingTeam === LeadRoutingTeam.STRATEGIC_GROWTH ? 'strategic_growth' : 'national_tm';
        afterData.routingTeam = routing.routingTeam === LeadRoutingTeam.STRATEGIC_GROWTH ? 'strategic_growth' : 'national_tm';
      }
      if ((current.leadOwnerName ?? null) !== (routing.leadOwnerName ?? null)) {
        data.leadOwnerName = routing.leadOwnerName ?? null;
        beforeData.leadOwnerName = current.leadOwnerName ?? null;
        afterData.leadOwnerName = routing.leadOwnerName ?? null;
      }
    }

    if (Object.keys(afterData).length === 0) {
      throw new Error('Lead already matches the requested values');
    }

    await tx.lead.update({
      where: { id: leadId },
      data,
    });

    if (Object.prototype.hasOwnProperty.call(afterData, 'state')) {
      await syncLeadTerritoryAssignment(tx, {
        leadId,
      });
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: LEAD_ENTITY_TYPE,
        entityId: leadId,
        beforeData,
        afterData,
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
          workflowAction: 'update_lead_record',
        },
      }),
    });
  });

  return (await getLeadDetail(actor, leadId)) as LeadDetail;
}

export async function logLeadInitialContact(
  actor: AuthenticatedActor,
  leadId: string,
  input: LogLeadInitialContactRequest = {},
): Promise<LeadDetail> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const note = optionalTrimmed(input.note) ?? 'Initial contact logged';

  await prisma.$transaction(async (tx) => {
    const current = await tx.lead.findUnique({
      where: { id: leadId },
    });
    if (!current) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    if (current.initialContactedAt) {
      throw new Error('Initial contact has already been logged for this lead');
    }

    const now = new Date();
    await tx.lead.update({
      where: { id: leadId },
      data: {
        initialContactedAt: now,
      },
    });

    await createLeadStageEvent(tx, {
      leadId,
      actorUserId: actor.userId,
      fromStage: current.stage,
      toStage: current.stage,
      note,
      metadata: {
        actorRole: actor.role,
        actorType: actor.actorType,
        sessionId: actor.sessionId,
        workflowAction: 'log_initial_contact',
      },
      occurredAt: now,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: LEAD_ENTITY_TYPE,
        entityId: leadId,
        beforeData: {
          initialContactedAt: null,
        },
        afterData: {
          initialContactedAt: now.toISOString(),
        },
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
          note,
          workflowAction: 'log_initial_contact',
        },
      }),
    });
  });

  return (await getLeadDetail(actor, leadId)) as LeadDetail;
}

// UX-L-010: freeform activity note on lead record
export async function logLeadActivityNote(
  actor: AuthenticatedActor,
  leadId: string,
  input: LogLeadActivityNoteRequest,
): Promise<LogLeadActivityNoteResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const noteText = optionalTrimmed(input.note) ?? '';
  if (!noteText) {
    throw new Error('Note text is required');
  }
  assertNoRawPaymentCardData(noteText, 'Note text');

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  const title = optionalTrimmed(input.title) ?? 'Activity note';
  const now = new Date();

  const note = await prisma.mobileVoiceNote.create({
    data: {
      leadId,
      contextType: MobileVoiceNoteContextType.LEAD,
      title,
      rawTranscript: noteText,
      structuredSummary: noteText,
      processingStatus: MobileVoiceNoteProcessingStatus.STRUCTURED,
      reviewStatus: MobileVoiceNoteReviewStatus.APPROVED,
      reviewedAt: now,
      ...(actor.userId ? { createdByUserId: actor.userId, reviewedByUserId: actor.userId } : {}),
    },
    include: {
      createdBy: true,
    },
  });

  return {
    id: note.id,
    leadId,
    note: noteText,
    title,
    ...(note.createdBy ? { createdByName: note.createdBy.displayName || note.createdBy.email } : {}),
    createdAt: note.createdAt.toISOString(),
  };
}

export async function scheduleLeadDiscovery(
  actor: AuthenticatedActor,
  leadId: string,
  input: ScheduleLeadDiscoveryRequest = {},
  config?: AppConfig,
): Promise<LeadDetail> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const note = optionalTrimmed(input.note) ?? 'Discovery scheduled';
  const requestedScheduledAt = parseOptionalScheduledAt(input.scheduledAt, 'scheduledAt');

  await prisma.$transaction(async (tx) => {
    const current = await tx.lead.findUnique({
      where: { id: leadId },
    });
    if (!current) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    if (current.stage !== LeadStage.NEW) {
      throw new Error('Discovery can only be scheduled while the lead is in the New Lead stage');
    }

    const now = new Date();
    const scheduledAt = current.discoveryScheduledAt ?? requestedScheduledAt ?? now;
    await tx.lead.update({
      where: { id: leadId },
      data: {
        stage: LeadStage.DISCOVERY_SCHEDULED,
        initialContactedAt: current.initialContactedAt ?? now,
        discoveryScheduledAt: scheduledAt,
      },
    });

    await createLeadStageEvent(tx, {
      leadId,
      actorUserId: actor.userId,
      fromStage: current.stage,
      toStage: LeadStage.DISCOVERY_SCHEDULED,
      note,
      metadata: {
        actorRole: actor.role,
        actorType: actor.actorType,
        sessionId: actor.sessionId,
        workflowAction: 'schedule_discovery',
      },
      occurredAt: now,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: LEAD_ENTITY_TYPE,
        entityId: leadId,
        beforeData: {
          stage: toLeadStageKey(current.stage),
          initialContactedAt: current.initialContactedAt?.toISOString(),
          discoveryScheduledAt: current.discoveryScheduledAt?.toISOString(),
        },
        afterData: {
          stage: 'discovery_scheduled',
          initialContactedAt: (current.initialContactedAt ?? now).toISOString(),
          discoveryScheduledAt: scheduledAt.toISOString(),
        },
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
          note,
          workflowAction: 'schedule_discovery',
        },
      }),
    });
  });

  if (config) {
    await tryAutoSyncCalendarEventToOutlook(actor, config, {
      sourceModule: 'leads',
      sourceRecordId: leadId,
      eventType: 'discovery_call',
    });
  }

  return (await getLeadDetail(actor, leadId)) as LeadDetail;
}

export async function completeLeadDiscovery(
  actor: AuthenticatedActor,
  leadId: string,
  input: CompleteLeadDiscoveryRequest,
  config?: AppConfig,
): Promise<LeadDetail> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const normalized = normalizeDiscoveryCompletionInput(input, false);
  assertConsignmentLeadActionAccess(actor, normalized.consignmentInterestStatus);

  await prisma.$transaction(async (tx) => {
    const current = await tx.lead.findUnique({
      where: { id: leadId },
    });
    if (!current) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    if (LEAD_STAGE_ORDER[current.stage] > LEAD_STAGE_ORDER[LeadStage.DISCOVERY_COMPLETED]) {
      throw new Error('Discovery is already closed for this lead');
    }

    const now = new Date();
    const scheduledAt = current.discoveryScheduledAt ?? now;
    const initialContactedAt = current.initialContactedAt ?? now;
    const discoverySummary = normalized.summary ?? null;

    await tx.lead.update({
      where: { id: leadId },
      data: {
        stage: LeadStage.DISCOVERY_COMPLETED,
        initialContactedAt,
        discoveryScheduledAt: scheduledAt,
        discoveryCompletedAt: now,
        discoveryCallSkipped: false,
        discoveryPainPoints: normalized.painPoints,
        discoveryCurrentIaqSetup: normalized.currentIaqSetup ?? null,
        discoveryDecisionMaker: normalized.decisionMaker ?? null,
        discoveryBuyingIntent: normalized.buyingIntent ?? null,
        consignmentInterestStatus: normalized.consignmentInterestStatus
          ? toLeadConsignmentInterestStatusEnum(normalized.consignmentInterestStatus)
          : null,
        consignmentEntryTiming: normalized.consignmentEntryTiming
          ? toLeadConsignmentEntryTimingEnum(normalized.consignmentEntryTiming)
          : null,
        discoveryFastTrackReason: null,
        discoverySummary,
        notes: discoverySummary,
      },
    });

    await createLeadStageEvent(tx, {
      leadId,
      actorUserId: actor.userId,
      fromStage: current.stage,
      toStage: LeadStage.DISCOVERY_COMPLETED,
      note: normalized.note ?? 'Discovery completed',
      metadata: {
        actorRole: actor.role,
        actorType: actor.actorType,
        sessionId: actor.sessionId,
        workflowAction: 'complete_discovery',
      },
      occurredAt: now,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: LEAD_ENTITY_TYPE,
        entityId: leadId,
        beforeData: {
          stage: toLeadStageKey(current.stage),
        },
        afterData: {
          stage: 'discovery_completed',
          discoveryCallSkipped: false,
          discoverySummary: normalized.summary,
          discoveryPainPoints: normalized.painPoints,
          consignmentInterestStatus: normalized.consignmentInterestStatus,
          consignmentEntryTiming: normalized.consignmentEntryTiming,
        },
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
          note: normalized.note,
          workflowAction: 'complete_discovery',
        },
      }),
    });

    await auditConsignmentLeadCapture(tx, actor, current, normalized, 'complete_discovery');
  });

  if (config) {
    await tryAutoUnsyncCalendarEventFromOutlook(
      actor,
      config,
      {
        sourceModule: 'leads',
        sourceRecordId: leadId,
        eventType: 'discovery_call',
      },
      'Lead discovery completed in Pulse',
    );
  }

  return (await getLeadDetail(actor, leadId)) as LeadDetail;
}

export async function skipLeadDiscovery(
  actor: AuthenticatedActor,
  leadId: string,
  input: SkipLeadDiscoveryRequest,
  config?: AppConfig,
): Promise<LeadDetail> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const normalized = normalizeDiscoveryCompletionInput(input, true);
  assertConsignmentLeadActionAccess(actor, normalized.consignmentInterestStatus);

  await prisma.$transaction(async (tx) => {
    const current = await tx.lead.findUnique({
      where: { id: leadId },
    });
    if (!current) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    if (LEAD_STAGE_ORDER[current.stage] > LEAD_STAGE_ORDER[LeadStage.DISCOVERY_COMPLETED]) {
      throw new Error('Discovery is already closed for this lead');
    }

    const now = new Date();
    const scheduledAt = current.discoveryScheduledAt ?? now;
    const initialContactedAt = current.initialContactedAt ?? now;

    await tx.lead.update({
      where: { id: leadId },
      data: {
        stage: LeadStage.DISCOVERY_COMPLETED,
        initialContactedAt,
        discoveryScheduledAt: scheduledAt,
        discoveryCompletedAt: now,
        discoveryCallSkipped: true,
        discoveryPainPoints: normalized.painPoints,
        discoveryCurrentIaqSetup: normalized.currentIaqSetup ?? null,
        discoveryDecisionMaker: normalized.decisionMaker ?? null,
        discoveryBuyingIntent: normalized.buyingIntent ?? null,
        consignmentInterestStatus: normalized.consignmentInterestStatus
          ? toLeadConsignmentInterestStatusEnum(normalized.consignmentInterestStatus)
          : null,
        consignmentEntryTiming: normalized.consignmentEntryTiming
          ? toLeadConsignmentEntryTimingEnum(normalized.consignmentEntryTiming)
          : null,
        discoveryFastTrackReason: normalized.fastTrackReason ?? null,
        discoverySummary: normalized.summary ?? normalized.fastTrackReason ?? null,
        notes: normalized.summary ?? normalized.fastTrackReason ?? null,
      },
    });

    await createLeadStageEvent(tx, {
      leadId,
      actorUserId: actor.userId,
      fromStage: current.stage,
      toStage: LeadStage.DISCOVERY_COMPLETED,
      note: normalized.note ?? 'Discovery skipped with fast-track reason',
      metadata: {
        actorRole: actor.role,
        actorType: actor.actorType,
        sessionId: actor.sessionId,
        workflowAction: 'skip_discovery',
        fastTrackReason: normalized.fastTrackReason,
      },
      occurredAt: now,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: LEAD_ENTITY_TYPE,
        entityId: leadId,
        beforeData: {
          stage: toLeadStageKey(current.stage),
        },
        afterData: {
          stage: 'discovery_completed',
          discoveryCallSkipped: true,
          discoveryFastTrackReason: normalized.fastTrackReason,
          discoverySummary: normalized.summary ?? normalized.fastTrackReason,
          consignmentInterestStatus: normalized.consignmentInterestStatus,
          consignmentEntryTiming: normalized.consignmentEntryTiming,
        },
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
          note: normalized.note,
          workflowAction: 'skip_discovery',
        },
      }),
    });

    await auditConsignmentLeadCapture(tx, actor, current, normalized, 'skip_discovery');
  });

  if (config) {
    await tryAutoUnsyncCalendarEventFromOutlook(
      actor,
      config,
      {
        sourceModule: 'leads',
        sourceRecordId: leadId,
        eventType: 'discovery_call',
      },
      'Lead discovery was skipped / fast-tracked in Pulse',
    );
  }

  return (await getLeadDetail(actor, leadId)) as LeadDetail;
}

export async function createLead(actor: AuthenticatedActor, input: CreateLeadRequest): Promise<LeadSummary> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const normalized = normalizeLeadInput(input, {
    defaultBusinessSegmentCode: DEFAULT_BUSINESS_SEGMENT_CODE,
    defaultLeadSourceCode: DEFAULT_MANUAL_LEAD_SOURCE_CODE,
    leadCaptureMethod: LeadCaptureMethod.MANUAL_ENTRY,
  });
  const duplicateResolution = normalizeManualDuplicateResolution(input.duplicateResolution);

  const lead = await prisma.$transaction(async (tx) => {
    const duplicateCandidates = await findLeadImportDuplicateCandidates(tx, normalized);
    if (duplicateCandidates.length > 0 && !duplicateResolution) {
      throw new Error('Potential duplicate found. Review existing lead/account matches before creating a new manual lead.');
    }
    const selectedDuplicateCandidate = findDuplicateCandidateById(duplicateCandidates, duplicateResolution?.targetEntityId);
    if (duplicateResolution?.targetEntityId && !selectedDuplicateCandidate) {
      throw new Error('duplicateResolution.targetEntityId must match one of the duplicate candidates');
    }
    if (duplicateResolution?.decision === 'enrich_existing') {
      return enrichExistingLeadFromDuplicate(
        tx,
        actor,
        normalized,
        {
          decision: duplicateResolution.decision,
          reason: duplicateResolution.reason,
          ...(duplicateResolution.targetEntityId ? { targetEntityId: duplicateResolution.targetEntityId } : {}),
        },
        duplicateCandidates,
      );
    }

    return createLeadRecord(tx, normalized, {
      actorUserId: actor.userId,
      sessionId: actor.sessionId,
      actorRole: actor.role,
      actorType: actor.actorType,
      trigger: 'manual',
    }, duplicateResolution
      ? {
          sourceMetadata: {
            manualDuplicateResolution: {
              decision: duplicateResolution.decision,
              reason: duplicateResolution.reason,
              ...(duplicateResolution.targetEntityId ? { targetEntityId: duplicateResolution.targetEntityId } : {}),
              candidateCount: duplicateCandidates.length,
              candidates: duplicateCandidates,
              ...(selectedDuplicateCandidate ? { selectedCandidate: selectedDuplicateCandidate } : {}),
            },
          },
          auditMetadata: {
            manualDuplicateResolution: {
              decision: duplicateResolution.decision,
              reason: duplicateResolution.reason,
              ...(duplicateResolution.targetEntityId ? { targetEntityId: duplicateResolution.targetEntityId } : {}),
              candidateCount: duplicateCandidates.length,
              ...(selectedDuplicateCandidate ? { selectedCandidate: selectedDuplicateCandidate } : {}),
            },
          },
        }
      : undefined);
  });

  return toLeadSummary(lead);
}

export async function previewLeadDuplicateCandidates(
  actor: AuthenticatedActor,
  input: PreviewLeadDuplicateCandidatesRequest,
): Promise<PreviewLeadDuplicateCandidatesResponse> {
  assertModuleAccess(actor.role, 'leads');
  // Intake-only: this probes the entire lead/account table by name/email/phone and is invoked
  // solely from the create-lead flow (itself lead.intake_manage). Gating it as a read action let
  // scoped roles enumerate cross-territory candidates.
  assertActionAccess(actor.role, 'lead.intake_manage');

  const normalized = normalizeLeadInput(input, {
    defaultBusinessSegmentCode: DEFAULT_BUSINESS_SEGMENT_CODE,
    defaultLeadSourceCode: DEFAULT_MANUAL_LEAD_SOURCE_CODE,
    leadCaptureMethod: LeadCaptureMethod.MANUAL_ENTRY,
  });
  const candidates = await prisma.$transaction((tx) => findLeadImportDuplicateCandidates(tx, normalized));

  return {
    hasPotentialDuplicate: candidates.length > 0,
    candidates,
  };
}

export async function captureWebsiteLead(input: CaptureWebsiteLeadRequest): Promise<CaptureWebsiteLeadResponse> {
  const site = await prisma.websiteLeadSite.findUnique({
    where: {
      siteId: requiredTrimmed(input.siteId, 'siteId'),
    },
  });

  if (!site || !site.isActive) {
    throw new Error('Website lead form is not active for this site');
  }

  const leadType = toWebsiteLeadTypeEnum(input.leadType);
  assertWebsiteLeadTypeAllowed(site.formType, leadType);
  const siteFormConfig = toWebsiteLeadSiteFormConfig(site);

  const resolvedName = resolvePublicWebsiteContactName(input);
  const companyName = resolveWebsiteLeadCompanyName(input, leadType, resolvedName.contactDisplayName, site.siteName);
  const serviceTechCount = resolveWebsiteServiceTechCount(input, leadType);
  const notes = buildWebsiteCaptureNotes(input);
  const normalizedState = normalizeState(input.state);
  const normalizedCountryCode = normalizeCountryCode(input.countryCode, normalizedState);
  const inquiryTopic = optionalTrimmed(input.inquiryTopic);
  const referralSource = optionalTrimmed(input.referralSource);
  const referralDetail = optionalTrimmed(input.referralDetail);
  const message = optionalTrimmed(input.message);
  const streetAddress = optionalTrimmed(input.streetAddress);
  const city = optionalTrimmed(input.city);
  const postalCode = optionalTrimmed(input.postalCode);
  const customerStatus = normalizeOptionalWebsiteCustomerStatus(input.customerStatus);
  const marketingConsent = typeof input.marketingConsent === 'boolean' ? input.marketingConsent : undefined;

  validateWebsiteSubmissionMetadata({
    leadType,
    inquiryTopic,
    referralSource,
    siteFormConfig,
  });

  const normalizedInput: LeadInputSource = {
    companyName,
    ...(resolvedName.contactFirstName ? { contactFirstName: resolvedName.contactFirstName } : {}),
    ...(resolvedName.contactLastName ? { contactLastName: resolvedName.contactLastName } : {}),
    contactDisplayName: resolvedName.contactDisplayName,
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.state !== undefined ? { state: input.state } : {}),
    ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
    businessSegmentCode: DEFAULT_BUSINESS_SEGMENT_CODE,
    leadSourceCode: DEFAULT_WEBSITE_LEAD_SOURCE_CODE,
    leadType: toWebsiteLeadTypeKey(leadType),
    sourceDetail: site.siteName,
    sourceSiteId: site.siteId,
    sourceSiteName: site.siteName,
    sourceBrandTag: site.brandTag,
    ...(input.campaign !== undefined ? { sourceCampaign: input.campaign } : {}),
    serviceTechCount,
    ...(input.installTechCount !== undefined ? { installTechCount: input.installTechCount } : {}),
    ...(input.truckCount !== undefined ? { truckCount: input.truckCount } : {}),
    ...(input.salesPersonCount !== undefined ? { salesPersonCount: input.salesPersonCount } : {}),
    ...(input.potentialValueCents !== undefined ? { potentialValueCents: input.potentialValueCents } : {}),
    ...(input.affinityGroupSelection !== undefined ? { affinityGroupSelection: input.affinityGroupSelection } : {}),
    ...(input.affinityGroupId !== undefined ? { affinityGroupId: input.affinityGroupId } : {}),
    ...(input.affinityGroupCode !== undefined ? { affinityGroupCode: input.affinityGroupCode } : {}),
    ...(input.affinityGroupName !== undefined ? { affinityGroupName: input.affinityGroupName } : {}),
    ...(input.ownershipGroupSelection !== undefined ? { ownershipGroupSelection: input.ownershipGroupSelection } : {}),
    ...(input.ownershipGroupId !== undefined ? { ownershipGroupId: input.ownershipGroupId } : {}),
    ...(input.ownershipGroupCode !== undefined ? { ownershipGroupCode: input.ownershipGroupCode } : {}),
    ...(input.ownershipGroupName !== undefined ? { ownershipGroupName: input.ownershipGroupName } : {}),
    ...(input.privateLabelName !== undefined ? { privateLabelName: input.privateLabelName } : {}),
    ...(notes ? { notes } : {}),
  };

  const result = await prisma.$transaction(async (tx) => {
    const duplicateLead = await findWebsiteLeadDuplicate(tx, normalizedInput);
    let linkedLead: LeadWithRefs;
    let outcome: WebsiteLeadSubmissionOutcome;

    if (duplicateLead) {
      linkedLead = duplicateLead;
      outcome = WebsiteLeadSubmissionOutcome.ATTACHED_TO_EXISTING_LEAD;
    } else {
      const normalized = normalizeLeadInput(
        normalizedInput,
        {
          defaultBusinessSegmentCode: DEFAULT_BUSINESS_SEGMENT_CODE,
          defaultLeadSourceCode: DEFAULT_WEBSITE_LEAD_SOURCE_CODE,
          leadCaptureMethod: LeadCaptureMethod.DIRECT_WEB_FORM,
        },
      );

      linkedLead = await createLeadRecord(
        tx,
        normalized,
        {
          actorType: 'public',
          trigger: 'public_capture',
        },
        {
          sourceMetadata: {
            captureChannel: 'branded_website',
            ...(inquiryTopic ? { inquiryTopic } : {}),
            ...(referralSource ? { referralSource } : {}),
            ...(referralDetail ? { referralDetail } : {}),
            ...(customerStatus ? { customerStatus } : {}),
            ...(marketingConsent !== undefined ? { marketingConsent } : {}),
            ...(streetAddress || city || normalizedState || postalCode || normalizedCountryCode
              ? {
                  submittedAddress: {
                    ...(streetAddress ? { line1: streetAddress } : {}),
                    ...(city ? { city } : {}),
                    ...(normalizedState ? { state: normalizedState } : {}),
                    ...(postalCode ? { postalCode } : {}),
                    ...(normalizedCountryCode ? { countryCode: normalizedCountryCode } : {}),
                  },
                }
              : {}),
          },
        },
      );
      outcome = WebsiteLeadSubmissionOutcome.CREATED_NEW_LEAD;
    }

    const submission = await tx.websiteLeadSubmission.create({
      data: {
        websiteLeadSiteId: site.id,
        linkedLeadId: linkedLead.id,
        leadType,
        outcome,
        reviewStatus:
          outcome === WebsiteLeadSubmissionOutcome.ATTACHED_TO_EXISTING_LEAD
            ? WebsiteLeadSubmissionReviewStatus.PENDING_REVIEW
            : WebsiteLeadSubmissionReviewStatus.NOT_REQUIRED,
        contactDisplayName: resolvedName.contactDisplayName,
        ...(resolvedName.contactFirstName ? { contactFirstName: resolvedName.contactFirstName } : {}),
        ...(resolvedName.contactLastName ? { contactLastName: resolvedName.contactLastName } : {}),
        ...(input.companyName ? { companyName: input.companyName.trim() } : {}),
        ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
        ...(input.phone ? { phone: input.phone.trim() } : {}),
        ...(normalizedState ? { state: normalizedState } : {}),
        ...(normalizedCountryCode ? { countryCode: normalizedCountryCode } : {}),
        ...(serviceTechCount ? { serviceTechCount } : {}),
        ...(input.installTechCount !== undefined ? { installTechCount: input.installTechCount } : {}),
        ...(input.truckCount !== undefined ? { truckCount: input.truckCount } : {}),
        ...(input.salesPersonCount !== undefined ? { salesPersonCount: input.salesPersonCount } : {}),
        ...(input.potentialValueCents !== undefined ? { potentialValueCents: input.potentialValueCents } : {}),
        ...(inquiryTopic ? { inquiryTopic } : {}),
        ...(referralSource ? { referralSource } : {}),
        ...(referralDetail ? { referralDetail } : {}),
        ...(message ? { message } : {}),
        payload: toBoundedJsonValue(input, {
          field: 'websiteLeadSubmission.payload',
          maxBytes: JSON_SIZE_LIMITS.websiteLeadSubmissionPayloadBytes,
        }),
      },
    });

    return {
      lead: linkedLead,
      submission,
      outcome,
    };
  });

  return {
    ...toLeadSummary(result.lead),
    submissionId: result.submission.id,
    outcome: toWebsiteLeadSubmissionOutcomeKey(result.outcome),
    reviewStatus: toWebsiteLeadSubmissionReviewStatusKey(result.submission.reviewStatus),
  };
}

export async function importLeads(actor: AuthenticatedActor, input: ImportLeadsRequest): Promise<ImportLeadsResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    throw new Error('rows must contain at least one item');
  }
  if (input.rows.length > 500) {
    throw new Error('rows cannot exceed 500 in one request');
  }

  const items: LeadSummary[] = [];
  const errors: ImportLeadsResponse['errors'] = [];

  for (const [index, row] of input.rows.entries()) {
    try {
      const rowInput: LeadInputSource = {
        ...row,
        ...(input.businessSegmentCode !== undefined ? { businessSegmentCode: input.businessSegmentCode } : {}),
        ...(input.leadSourceCode !== undefined ? { leadSourceCode: input.leadSourceCode } : {}),
        ...(input.sourceSiteId !== undefined ? { sourceSiteId: input.sourceSiteId } : {}),
        ...(input.sourceSiteName !== undefined ? { sourceSiteName: input.sourceSiteName } : {}),
        ...(input.sourceBrandTag !== undefined ? { sourceBrandTag: input.sourceBrandTag } : {}),
      };

      const normalized = normalizeLeadInput(
        rowInput,
        {
          defaultBusinessSegmentCode: DEFAULT_BUSINESS_SEGMENT_CODE,
          defaultLeadSourceCode: DEFAULT_MANUAL_LEAD_SOURCE_CODE,
          leadCaptureMethod: LeadCaptureMethod.BULK_IMPORT,
        },
      );

      const lead = await prisma.$transaction((tx) =>
        createLeadRecord(
          tx,
          normalized,
          {
            actorUserId: actor.userId,
            sessionId: actor.sessionId,
            actorRole: actor.role,
            actorType: actor.actorType,
            trigger: 'bulk_import',
          },
          {
            sourceMetadata: {
              batchName: optionalTrimmed(input.batchName),
              rowIndex: index,
            },
          },
        ),
      );

      items.push(toLeadSummary(lead));
    } catch (error) {
      errors.push({
        rowIndex: index,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const batchName = optionalTrimmed(input.batchName);

  return {
    ...(batchName !== undefined ? { batchName } : {}),
    createdCount: items.length,
    skippedCount: errors.length,
    errorCount: errors.length,
    items,
    errors,
  };
}

export async function previewLeadImport(actor: AuthenticatedActor, input: LeadImportFilePreviewRequest): Promise<LeadImportFilePreviewResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  return previewLeadImportFile(input);
}

const LEAD_IMPORT_RUN_INCLUDE = {
  rows: {
    orderBy: {
      rowNumber: 'asc',
    },
  },
} satisfies Prisma.LeadImportRunInclude;

type LeadImportRunWithRows = Prisma.LeadImportRunGetPayload<{
  include: typeof LEAD_IMPORT_RUN_INCLUDE;
}>;

type LeadImportReviewComputationRow = {
  rowNumber: number;
  status: LeadImportRunRowStatus;
  detail: string;
  candidates: LeadImportDuplicateCandidate[];
  sourceValues: Record<string, string>;
  mappedPayload?: LeadInputSource;
};

export async function reviewLeadImport(
  actor: AuthenticatedActor,
  input: ReviewLeadImportRequest,
): Promise<ReviewLeadImportResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const mapped = mapLeadImportFile(input);
  const reviewRows: LeadImportReviewComputationRow[] = [];
  let readyRowCount = 0;
  const withinFileSignals = new Map<string, LeadImportDuplicateCandidate[]>();

  for (const [index, row] of mapped.rows.entries()) {
    const rowNumber = mapped.rowNumbers[index] ?? index + 2;
    const sourceValues = mapped.sourceRows[index]?.values ?? {};

    try {
      const rowInput = buildImportLeadRowInput(input, row);
      const normalized = normalizeLeadInput(
        rowInput,
        {
          defaultBusinessSegmentCode: DEFAULT_BUSINESS_SEGMENT_CODE,
          defaultLeadSourceCode: DEFAULT_MANUAL_LEAD_SOURCE_CODE,
          leadCaptureMethod: LeadCaptureMethod.BULK_IMPORT,
        },
      );

      const candidates = [
        ...buildWithinFileDuplicateCandidates(withinFileSignals, normalized),
        ...(await findLeadImportDuplicateCandidates(prisma, normalized)),
      ];
      registerWithinFileDuplicateSignals(withinFileSignals, rowNumber, normalized, sourceValues);

      if (candidates.length > 0) {
        reviewRows.push({
          rowNumber,
          status: LeadImportRunRowStatus.POTENTIAL_DUPLICATE,
          detail: buildLeadImportDuplicateDetail(candidates),
          candidates,
          sourceValues,
          mappedPayload: rowInput,
        });
        continue;
      }

      readyRowCount += 1;
      reviewRows.push({
        rowNumber,
        status: LeadImportRunRowStatus.READY,
        detail: 'Row is ready for import.',
        candidates: [],
        sourceValues,
        mappedPayload: rowInput,
      });
    } catch (error) {
      reviewRows.push({
        rowNumber,
        status: LeadImportRunRowStatus.INVALID,
        detail: error instanceof Error ? error.message : String(error),
        candidates: [],
        sourceValues,
      });
    }
  }

  const batchName = optionalTrimmed(input.batchName);
  const createdAt = new Date();
  const run = await prisma.leadImportRun.create({
    data: {
      ...(actor.userId ? { createdByUserId: actor.userId } : {}),
      fileName: mapped.fileName,
      fileFormat: mapped.format,
      fileDigest: buildLeadImportFileDigest(input.fileName, input.fileContentBase64, input.sheetName),
      sheetName: mapped.sheetName,
      ...(batchName ? { batchName } : {}),
      ...(input.businessSegmentCode ? { businessSegmentCode: input.businessSegmentCode } : {}),
      ...(input.leadSourceCode ? { leadSourceCode: input.leadSourceCode } : {}),
      ...(input.sourceSiteId ? { sourceSiteId: input.sourceSiteId } : {}),
      ...(input.sourceSiteName ? { sourceSiteName: input.sourceSiteName } : {}),
      ...(input.sourceBrandTag ? { sourceBrandTag: input.sourceBrandTag } : {}),
      mappings: toBoundedJsonValue(input.mappings, {
        field: 'leadImportRun.mappings',
        maxBytes: JSON_SIZE_LIMITS.leadImportRunMappingsBytes,
      }),
      totalRows: mapped.totalRows,
      mappedRows: mapped.rows.length,
      readyRowCount,
      attentionRowCount: reviewRows.filter((row) => row.status !== LeadImportRunRowStatus.READY).length,
      createdAt,
      rows: {
        create: reviewRows.map((row) => ({
          rowNumber: row.rowNumber,
          status: row.status,
          detail: row.detail,
          ...(Object.keys(row.sourceValues).length > 0
            ? {
                sourceValues: toBoundedJsonValue(row.sourceValues, {
                  field: `leadImportRunRow.sourceValues[row ${row.rowNumber}]`,
                  maxBytes: JSON_SIZE_LIMITS.leadImportRunRowSourceValuesBytes,
                }),
              }
            : {}),
          ...(row.mappedPayload
            ? {
                mappedPayload: toBoundedJsonValue(row.mappedPayload, {
                  field: `leadImportRunRow.mappedPayload[row ${row.rowNumber}]`,
                  maxBytes: JSON_SIZE_LIMITS.leadImportRunRowPayloadBytes,
                }),
              }
            : {}),
          ...(row.candidates.length > 0
            ? {
                duplicateCandidates: toBoundedJsonValue(row.candidates, {
                  field: `leadImportRunRow.duplicateCandidates[row ${row.rowNumber}]`,
                  maxBytes: JSON_SIZE_LIMITS.leadImportRunRowCandidatesBytes,
                }),
              }
            : {}),
        })),
      },
    },
    include: LEAD_IMPORT_RUN_INCLUDE,
  });

  return toLeadImportRunDetail(run);
}

export async function importLeadFile(actor: AuthenticatedActor, input: ImportLeadFileRequest): Promise<ImportLeadFileResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const review = await reviewLeadImport(actor, input);
  const rowDecisionMap = new Map((input.rowDecisions ?? []).map((decision) => [decision.rowNumber, decision]));
  const unresolvedDuplicateRows = review.rows.filter((row) => row.status === 'potential_duplicate' && !rowDecisionMap.has(row.rowNumber));

  for (const row of unresolvedDuplicateRows) {
    await prisma.leadImportRunRow.updateMany({
      where: {
        runId: review.runId,
        rowNumber: row.rowNumber,
        status: LeadImportRunRowStatus.POTENTIAL_DUPLICATE,
      },
      data: {
        status: LeadImportRunRowStatus.FAILED,
        detail: 'Potential duplicate found. Review this row and choose whether to create a new lead, use the existing record, or skip the row.',
      },
    });
  }

  return commitLeadImportRun(actor, review.runId, input.rowDecisions ? {
    rowDecisions: input.rowDecisions,
  } : {});
}

export async function getLeadImportRun(actor: AuthenticatedActor, runId: string): Promise<LeadImportRunDetail> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const run = await prisma.leadImportRun.findUnique({
    where: { id: runId },
    include: LEAD_IMPORT_RUN_INCLUDE,
  });
  if (!run) {
    throw new Error('Lead import run not found');
  }

  return toLeadImportRunDetail(run);
}

export async function commitLeadImportRun(
  actor: AuthenticatedActor,
  runId: string,
  input: CommitLeadImportRunRequest,
): Promise<ImportLeadFileResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const finalizedRun = await prisma.$transaction(async (tx) => {
    const run = await tx.leadImportRun.findUnique({
      where: { id: runId },
      include: LEAD_IMPORT_RUN_INCLUDE,
    });
    if (!run) {
      throw new Error('Lead import run not found');
    }

    if (run.status === LeadImportRunStatus.IMPORTED || run.status === LeadImportRunStatus.IMPORTED_WITH_ERRORS) {
      return run;
    }

    const incomingDecisions = new Map<number, NonNullable<CommitLeadImportRunRequest['rowDecisions']>[number]>(
      (input.rowDecisions ?? []).map((decision) => [decision.rowNumber, decision]),
    );

    for (const row of run.rows) {
      const incomingDecision = incomingDecisions.get(row.rowNumber);
      if (!incomingDecision) {
        continue;
      }

      await tx.leadImportRunRow.update({
        where: { id: row.id },
        data: {
          duplicateDecision: toLeadImportDuplicateDecisionEnum(incomingDecision.duplicateDecision),
          targetEntityId: incomingDecision.targetEntityId ?? null,
        },
      });
    }

    const refreshedRun = await tx.leadImportRun.findUniqueOrThrow({
      where: { id: runId },
      include: LEAD_IMPORT_RUN_INCLUDE,
    });

    validateLeadImportRunDecisions(refreshedRun.rows);

    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const [index, row] of refreshedRun.rows.entries()) {
      if (row.status === LeadImportRunRowStatus.IMPORTED || row.status === LeadImportRunRowStatus.SKIPPED) {
        if (row.status === LeadImportRunRowStatus.IMPORTED) {
          createdCount += 1;
        } else {
          skippedCount += 1;
        }
        continue;
      }

      if (row.status === LeadImportRunRowStatus.INVALID) {
        errorCount += 1;
        continue;
      }

      if (row.status === LeadImportRunRowStatus.FAILED) {
        errorCount += 1;
        continue;
      }

      const decision = row.duplicateDecision;
      if (row.status === LeadImportRunRowStatus.POTENTIAL_DUPLICATE && (decision === LeadImportDuplicateDecision.USE_EXISTING || decision === LeadImportDuplicateDecision.SKIP)) {
        if (decision === LeadImportDuplicateDecision.USE_EXISTING) {
          const duplicateCandidates = parseLeadImportDuplicateCandidates(row.duplicateCandidates);
          const selectedCandidate = row.targetEntityId
            ? findDuplicateCandidateById(duplicateCandidates, row.targetEntityId)
            : duplicateCandidates.filter((candidate) => candidate.entityType !== 'import_row').length === 1
              ? duplicateCandidates.find((candidate) => candidate.entityType !== 'import_row')
              : undefined;
          if (!selectedCandidate || selectedCandidate.entityType === 'import_row') {
            throw new Error(`Row ${row.rowNumber} must choose which existing record should be used.`);
          }
          await auditImportUseExistingDuplicateResolution(tx, actor, refreshedRun, row, selectedCandidate);
        }

        skippedCount += 1;
        await tx.leadImportRunRow.update({
          where: { id: row.id },
          data: {
            status: LeadImportRunRowStatus.SKIPPED,
            detail: buildSkippedImportRowDetail(row),
          },
        });
        continue;
      }

      try {
        const payload = parseLeadImportMappedPayload(row);
        const normalized = normalizeLeadInput(
          payload,
          {
            defaultBusinessSegmentCode: DEFAULT_BUSINESS_SEGMENT_CODE,
            defaultLeadSourceCode: DEFAULT_MANUAL_LEAD_SOURCE_CODE,
            leadCaptureMethod: LeadCaptureMethod.BULK_IMPORT,
          },
        );

        if (row.status === LeadImportRunRowStatus.POTENTIAL_DUPLICATE && decision === LeadImportDuplicateDecision.ENRICH_EXISTING) {
          const duplicateCandidates = parseLeadImportDuplicateCandidates(row.duplicateCandidates);
          const target = resolveImportDuplicateTarget(row, duplicateCandidates, 'lead');
          const lead = await enrichExistingLeadFromDuplicate(
            tx,
            actor,
            normalized,
            {
              decision: 'enrich_existing',
              reason: `Bulk import row ${row.rowNumber} enriched an existing lead.`,
              targetEntityId: target.entityId,
            },
            duplicateCandidates,
          );

          skippedCount += 1;
          await tx.leadImportRunRow.update({
            where: { id: row.id },
            data: {
              status: LeadImportRunRowStatus.SKIPPED,
              importedLeadId: lead.id,
              importedAt: new Date(),
              detail: buildSkippedImportRowDetail(row),
            },
          });
          continue;
        }

        const lead = await createLeadRecord(
          tx,
          normalized,
          {
            actorUserId: actor.userId,
            sessionId: actor.sessionId,
            actorRole: actor.role,
            actorType: actor.actorType,
            trigger: 'bulk_import',
          },
          {
            sourceMetadata: {
              batchName: refreshedRun.batchName ?? undefined,
              rowIndex: index,
              importRunId: refreshedRun.id,
            },
          },
        );

        createdCount += 1;
        await tx.leadImportRunRow.update({
          where: { id: row.id },
          data: {
            status: LeadImportRunRowStatus.IMPORTED,
            importedLeadId: lead.id,
            importedAt: new Date(),
            detail: `Lead imported successfully as ${lead.companyName}.`,
          },
        });
      } catch (error) {
        errorCount += 1;
        await tx.leadImportRunRow.update({
          where: { id: row.id },
          data: {
            status: LeadImportRunRowStatus.FAILED,
            detail: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    await tx.leadImportRun.update({
      where: { id: refreshedRun.id },
      data: {
        createdCount,
        skippedCount,
        errorCount,
        status: errorCount > 0 ? LeadImportRunStatus.IMPORTED_WITH_ERRORS : LeadImportRunStatus.IMPORTED,
        committedAt: new Date(),
      },
    });

    return tx.leadImportRun.findUniqueOrThrow({
      where: { id: refreshedRun.id },
      include: LEAD_IMPORT_RUN_INCLUDE,
    });
  });

  return buildLeadImportRunCommitResponse(finalizedRun);
}

function buildLeadImportFileDigest(fileName: string, fileContentBase64: string, sheetName?: string) {
  return createHash('sha256')
    .update(fileName)
    .update(':')
    .update(sheetName ?? '')
    .update(':')
    .update(fileContentBase64)
    .digest('hex');
}

function buildImportDuplicateSignalKeys(input: NormalizedLeadInput) {
  const keys: string[] = [];
  const email = optionalTrimmed(input.email)?.toLowerCase();
  const phone = optionalTrimmed(input.phone);
  const companyName = optionalTrimmed(input.companyName)?.toLowerCase();
  const state = optionalTrimmed(input.state)?.toUpperCase();

  if (email) {
    keys.push(`email:${email}`);
  }
  if (phone) {
    keys.push(`phone:${phone}`);
  }
  if (companyName && state) {
    keys.push(`company:${companyName}|state:${state}`);
  }

  return keys;
}

function buildWithinFileDuplicateCandidates(
  seenSignals: Map<string, LeadImportDuplicateCandidate[]>,
  input: NormalizedLeadInput,
) {
  const candidates = new Map<string, LeadImportDuplicateCandidate>();

  for (const signal of buildImportDuplicateSignalKeys(input)) {
    const signalCandidates = seenSignals.get(signal) ?? [];
    for (const candidate of signalCandidates) {
      candidates.set(candidate.entityId, candidate);
    }
  }

  return [...candidates.values()];
}

function registerWithinFileDuplicateSignals(
  seenSignals: Map<string, LeadImportDuplicateCandidate[]>,
  rowNumber: number,
  input: NormalizedLeadInput,
  sourceValues: Record<string, string>,
) {
  const candidate: LeadImportDuplicateCandidate = {
    entityType: 'import_row',
    entityId: `import-row:${rowNumber}`,
    title: sourceValues.companyName || input.companyName,
    subtitle: `Import row #${rowNumber}`,
    detail: [sourceValues.email || input.email, sourceValues.phone || input.phone, sourceValues.state || input.state].filter(Boolean).join(' · '),
  };

  for (const signal of buildImportDuplicateSignalKeys(input)) {
    const rows = seenSignals.get(signal) ?? [];
    rows.push(candidate);
    seenSignals.set(signal, rows);
  }
}

function buildLeadImportDuplicateDetail(candidates: LeadImportDuplicateCandidate[]) {
  const importRowCount = candidates.filter((candidate) => candidate.entityType === 'import_row').length;
  const persistedCount = candidates.length - importRowCount;

  if (importRowCount > 0 && persistedCount > 0) {
    return `Potential duplicate found across existing records and other rows in this file (${candidates.length} candidate${candidates.length === 1 ? '' : 's'}).`;
  }
  if (importRowCount > 0) {
    return `Potential duplicate found against other rows in this file (${importRowCount} candidate${importRowCount === 1 ? '' : 's'}).`;
  }

  return `Potential duplicate found across existing leads or customer accounts (${persistedCount} candidate${persistedCount === 1 ? '' : 's'}).`;
}

function toLeadImportRunStatusKey(status: LeadImportRunStatus): 'review_ready' | 'imported' | 'imported_with_errors' {
  switch (status) {
    case LeadImportRunStatus.REVIEW_READY:
      return 'review_ready';
    case LeadImportRunStatus.IMPORTED:
      return 'imported';
    case LeadImportRunStatus.IMPORTED_WITH_ERRORS:
      return 'imported_with_errors';
    default:
      return 'review_ready';
  }
}

function toLeadImportReviewRowStatusKey(status: LeadImportRunRowStatus): 'ready' | 'potential_duplicate' | 'invalid' | 'skipped' | 'imported' | 'failed' {
  switch (status) {
    case LeadImportRunRowStatus.READY:
      return 'ready';
    case LeadImportRunRowStatus.POTENTIAL_DUPLICATE:
      return 'potential_duplicate';
    case LeadImportRunRowStatus.INVALID:
      return 'invalid';
    case LeadImportRunRowStatus.SKIPPED:
      return 'skipped';
    case LeadImportRunRowStatus.IMPORTED:
      return 'imported';
    case LeadImportRunRowStatus.FAILED:
      return 'failed';
    default:
      return 'invalid';
  }
}

function toLeadImportDuplicateDecisionEnum(decision: LeadImportDuplicateDecisionKey) {
  switch (decision) {
    case 'create_new':
      return LeadImportDuplicateDecision.CREATE_NEW;
    case 'use_existing':
      return LeadImportDuplicateDecision.USE_EXISTING;
    case 'enrich_existing':
      return LeadImportDuplicateDecision.ENRICH_EXISTING;
    case 'skip':
      return LeadImportDuplicateDecision.SKIP;
    default:
      return LeadImportDuplicateDecision.CREATE_NEW;
  }
}

function toLeadImportDuplicateDecisionKey(
  decision: LeadImportDuplicateDecision | null | undefined,
): LeadImportDuplicateDecisionKey | undefined {
  switch (decision) {
    case LeadImportDuplicateDecision.CREATE_NEW:
      return 'create_new';
    case LeadImportDuplicateDecision.USE_EXISTING:
      return 'use_existing';
    case LeadImportDuplicateDecision.ENRICH_EXISTING:
      return 'enrich_existing';
    case LeadImportDuplicateDecision.SKIP:
      return 'skip';
    default:
      return undefined;
  }
}

function parseLeadImportDuplicateCandidates(value: Prisma.JsonValue | null): LeadImportDuplicateCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return [];
    }

    const entityType = 'entityType' in candidate ? candidate.entityType : undefined;
    const entityId = 'entityId' in candidate ? candidate.entityId : undefined;
    const title = 'title' in candidate ? candidate.title : undefined;
    const subtitle = 'subtitle' in candidate && typeof candidate.subtitle === 'string' ? candidate.subtitle : undefined;
    const detail = 'detail' in candidate && typeof candidate.detail === 'string' ? candidate.detail : undefined;

    if (typeof entityType !== 'string' || typeof entityId !== 'string' || typeof title !== 'string') {
      return [];
    }

    if (entityType !== 'lead' && entityType !== 'account' && entityType !== 'import_row') {
      return [];
    }

    return [{
      entityType,
      entityId,
      title,
      ...(subtitle ? { subtitle } : {}),
      ...(detail ? { detail } : {}),
    }];
  });
}

function parseLeadImportMappedPayload(row: Prisma.LeadImportRunRowGetPayload<{}>): LeadInputSource {
  if (!row.mappedPayload || typeof row.mappedPayload !== 'object' || Array.isArray(row.mappedPayload)) {
    throw new Error(`Import row ${row.rowNumber} is missing its mapped payload.`);
  }

  return row.mappedPayload as unknown as LeadInputSource;
}

function toLeadImportReviewRow(row: Prisma.LeadImportRunRowGetPayload<{}>): LeadImportReviewRow {
  return {
    rowNumber: row.rowNumber,
    status: toLeadImportReviewRowStatusKey(row.status),
    detail: row.detail,
    candidates: parseLeadImportDuplicateCandidates(row.duplicateCandidates),
  };
}

function toLeadImportRunDetail(run: LeadImportRunWithRows): LeadImportRunDetail {
  return {
    runId: run.id,
    status: toLeadImportRunStatusKey(run.status),
    fileName: run.fileName,
    sheetName: run.sheetName,
    ...(run.batchName ? { batchName: run.batchName } : {}),
    totalRows: run.totalRows,
    mappedRows: run.mappedRows,
    readyRowCount: run.readyRowCount,
    attentionRowCount: run.attentionRowCount,
    createdCount: run.createdCount,
    skippedCount: run.skippedCount,
    errorCount: run.errorCount,
    createdAt: run.createdAt.toISOString(),
    ...(run.committedAt ? { committedAt: run.committedAt.toISOString() } : {}),
    rows: run.rows
      .filter((row) => row.status !== LeadImportRunRowStatus.READY)
      .map(toLeadImportReviewRow),
  };
}

function buildSkippedImportRowDetail(row: Prisma.LeadImportRunRowGetPayload<{}>) {
  const decisionKey = toLeadImportDuplicateDecisionKey(row.duplicateDecision);
  const candidates = parseLeadImportDuplicateCandidates(row.duplicateCandidates);

  if (decisionKey === 'skip') {
    return 'Row skipped by operator decision during duplicate review.';
  }

  if (decisionKey === 'use_existing') {
    const target = row.targetEntityId
      ? candidates.find((candidate) => candidate.entityId === row.targetEntityId)
      : candidates.find((candidate) => candidate.entityType !== 'import_row');
    if (target) {
      return `Row linked to existing ${target.entityType === 'account' ? 'customer account' : 'lead'} ${target.title}.`;
    }

    return 'Row linked to an existing record during duplicate review.';
  }

  if (decisionKey === 'enrich_existing') {
    const target = row.targetEntityId
      ? candidates.find((candidate) => candidate.entityId === row.targetEntityId)
      : candidates.find((candidate) => candidate.entityType === 'lead');
    if (target) {
      return `Row enriched existing lead ${target.title}.`;
    }

    return 'Row enriched an existing lead during duplicate review.';
  }

  return row.detail;
}

function findDuplicateCandidateById(
  candidates: LeadImportDuplicateCandidate[],
  targetEntityId: string | undefined,
) {
  if (!targetEntityId) {
    return undefined;
  }

  return candidates.find((candidate) => candidate.entityId === targetEntityId);
}

function resolveImportDuplicateTarget(
  row: Prisma.LeadImportRunRowGetPayload<{}>,
  candidates: LeadImportDuplicateCandidate[],
  entityType: 'lead' | 'account',
) {
  const allowedCandidates = candidates.filter((candidate) => candidate.entityType === entityType);
  const selectedCandidate = row.targetEntityId
    ? allowedCandidates.find((candidate) => candidate.entityId === row.targetEntityId)
    : allowedCandidates.length === 1
      ? allowedCandidates[0]
      : undefined;

  if (!selectedCandidate) {
    throw new Error(`Row ${row.rowNumber} must choose which existing ${entityType} should be used.`);
  }

  return selectedCandidate;
}

async function auditImportUseExistingDuplicateResolution(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  run: LeadImportRunWithRows,
  row: Prisma.LeadImportRunRowGetPayload<{}>,
  selectedCandidate: LeadImportDuplicateCandidate,
) {
  await tx.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: selectedCandidate.entityType === 'account' ? 'ACCOUNT' : LEAD_ENTITY_TYPE,
      entityId: selectedCandidate.entityId,
      afterData: {
        duplicateImportResolution: {
          runId: run.id,
          fileName: run.fileName,
          rowNumber: row.rowNumber,
          decision: 'use_existing',
          selectedCandidate,
        },
      },
      metadata: {
        actorRole: actor.role,
        actorType: actor.actorType,
        sessionId: actor.sessionId,
        workflowAction: 'duplicate_use_existing',
        duplicateResolution: {
          decision: 'use_existing',
          runId: run.id,
          fileName: run.fileName,
          rowNumber: row.rowNumber,
          targetEntityId: selectedCandidate.entityId,
          selectedCandidate,
        },
      },
    }),
  });
}

function validateLeadImportRunDecisions(rows: Prisma.LeadImportRunRowGetPayload<{}>[]) {
  for (const row of rows) {
    if (row.status !== LeadImportRunRowStatus.POTENTIAL_DUPLICATE) {
      continue;
    }

    const decisionKey = toLeadImportDuplicateDecisionKey(row.duplicateDecision);
    if (!decisionKey) {
      throw new Error(`Row ${row.rowNumber} still requires a duplicate decision before import can continue.`);
    }

    const candidates = parseLeadImportDuplicateCandidates(row.duplicateCandidates);
    const persistedCandidates = candidates.filter((candidate) => candidate.entityType !== 'import_row');

    if (decisionKey === 'use_existing' || decisionKey === 'enrich_existing') {
      const allowedCandidates = decisionKey === 'enrich_existing'
        ? persistedCandidates.filter((candidate) => candidate.entityType === 'lead')
        : persistedCandidates;
      const actionLabel = decisionKey === 'enrich_existing' ? 'enrich an existing lead' : 'use an existing record';

      if (allowedCandidates.length === 0) {
        throw new Error(`Row ${row.rowNumber} can only ${actionLabel} when a ${decisionKey === 'enrich_existing' ? 'lead' : 'lead or account'} match is available.`);
      }

      if (row.targetEntityId) {
        const selectedCandidate = allowedCandidates.find((candidate) => candidate.entityId === row.targetEntityId);
        if (!selectedCandidate) {
          throw new Error(`Row ${row.rowNumber} has an invalid ${decisionKey === 'enrich_existing' ? 'lead' : 'existing-record'} selection.`);
        }
      } else if (allowedCandidates.length > 1) {
        throw new Error(`Row ${row.rowNumber} must choose which ${decisionKey === 'enrich_existing' ? 'lead' : 'existing record'} should be used.`);
      }
    }
  }
}

async function buildLeadImportRunCommitResponse(run: LeadImportRunWithRows): Promise<ImportLeadFileResponse> {
  const importedLeadIds = run.rows
    .filter((row) => row.status === LeadImportRunRowStatus.IMPORTED && row.importedLeadId)
    .map((row) => row.importedLeadId as string);

  const importedLeads = importedLeadIds.length > 0
    ? await prisma.lead.findMany({
        where: {
          id: {
            in: importedLeadIds,
          },
        },
        include: LEAD_SUMMARY_INCLUDE,
      })
    : [];

  const importedLeadMap = new Map(importedLeads.map((lead) => [lead.id, toLeadSummary(lead)]));

  return {
    runId: run.id,
    status: toLeadImportRunStatusKey(run.status),
    fileName: run.fileName,
    sheetName: run.sheetName,
    ...(run.batchName ? { batchName: run.batchName } : {}),
    totalRows: run.totalRows,
    mappedRows: run.mappedRows,
    readyRowCount: run.readyRowCount,
    attentionRowCount: run.attentionRowCount,
    createdCount: run.createdCount,
    skippedCount: run.skippedCount,
    errorCount: run.errorCount,
    createdAt: run.createdAt.toISOString(),
    ...(run.committedAt ? { committedAt: run.committedAt.toISOString() } : {}),
    items: run.rows
      .filter((row) => row.status === LeadImportRunRowStatus.IMPORTED && row.importedLeadId)
      .map((row) => importedLeadMap.get(row.importedLeadId as string))
      .filter((lead): lead is LeadSummary => Boolean(lead)),
    skippedRows: run.rows
      .filter((row) => row.status === LeadImportRunRowStatus.SKIPPED)
      .map((row) => {
        const decision = toLeadImportDuplicateDecisionKey(row.duplicateDecision);
        return {
          rowNumber: row.rowNumber,
          detail: row.detail,
          ...(decision ? { decision } : {}),
        };
      }),
    errors: run.rows
      .filter((row) => row.status === LeadImportRunRowStatus.INVALID || row.status === LeadImportRunRowStatus.FAILED)
      .map((row) => ({
        rowNumber: row.rowNumber,
        detail: row.detail,
      })),
  };
}

export async function transitionLeadStage(
  actor: AuthenticatedActor,
  leadId: string,
  input: TransitionLeadStageRequest,
): Promise<LeadDetail> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const nextStage = toLeadStageEnum(input.toStage);
  const note = optionalTrimmed(input.note);
  const backwardReason = optionalTrimmed(input.backwardReason);

  const lead = await prisma.$transaction(async (tx) => {
    const current = await tx.lead.findUnique({
      where: { id: leadId },
      include: LEAD_SUMMARY_INCLUDE,
    });
    if (!current) {
      throw new Error(`Lead not found: ${leadId}`);
    }
    if (current.stage === nextStage) {
      throw new Error('Lead is already at the requested stage');
    }

    // BR-L-07 (UX-L-011): backward stage transitions are governed — a reason is required.
    const isBackwardTransition = LEAD_STAGE_ORDER[nextStage] < LEAD_STAGE_ORDER[current.stage];
    if (isBackwardTransition && !backwardReason) {
      throw new Error('A reason is required to move a lead to an earlier stage (BR-L-07).');
    }

    const now = new Date();
    const timestampPatch = buildLeadStageTimestampPatch(current.stage, nextStage, now);
    const updated = await tx.lead.update({
      where: { id: leadId },
      data: {
        stage: nextStage,
        ...timestampPatch,
      },
      include: LEAD_SUMMARY_INCLUDE,
    });

    await tx.leadStageEvent.create({
      data: {
        leadId: leadId,
        actorUserId: actor.userId,
        fromStage: current.stage,
        toStage: nextStage,
        ...(note !== undefined ? { note } : {}),
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
          ...(isBackwardTransition ? { isBackwardTransition: true } : {}),
          ...(backwardReason !== undefined ? { backwardReason } : {}),
        },
        occurredAt: now,
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: LEAD_ENTITY_TYPE,
        entityId: leadId,
        beforeData: {
          stage: toLeadStageKey(current.stage),
        },
        afterData: {
          stage: toLeadStageKey(updated.stage),
        },
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
          note: optionalTrimmed(input.note),
          ...(isBackwardTransition ? { isBackwardTransition: true } : {}),
          ...(backwardReason !== undefined ? { backwardReason } : {}),
        },
      }),
    });

    return updated;
  });

  return (await getLeadDetail(actor, lead.id)) as LeadDetail;
}

export async function updateLeadLifecycle(
  actor: AuthenticatedActor,
  leadId: string,
  input: UpdateLeadLifecycleRequest,
): Promise<LeadDetail> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const nextStatus = toLeadLifecycleStatusEnum(input.status);
  const reasonCode = normalizeLeadLifecycleReasonCode(input.reasonCode);
  const reasonNote = optionalTrimmed(input.reasonNote) ?? null;

  if (nextStatus !== LeadLifecycleStatus.ACTIVE && !reasonCode) {
    throw new Error('A lifecycle reason is required when a lead is parked or closed');
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.lead.findUnique({
      where: { id: leadId },
    });
    if (!current) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    if (current.stage === LeadStage.CUSTOMER_ACTIVE && nextStatus !== LeadLifecycleStatus.ACTIVE) {
      throw new Error('Customer Active records cannot be parked or closed from the lead lifecycle');
    }

    if (
      current.lifecycleStatus === nextStatus
      && (current.lifecycleReasonCode ?? null) === (reasonCode ?? null)
      && (current.lifecycleReasonNote ?? null) === reasonNote
    ) {
      throw new Error('Lead lifecycle is already set to the requested status');
    }

    const now = new Date();
    await tx.lead.update({
      where: { id: leadId },
      data: {
        lifecycleStatus: nextStatus,
        lifecycleChangedAt: now,
        lifecycleReasonCode: nextStatus === LeadLifecycleStatus.ACTIVE ? null : reasonCode ?? null,
        lifecycleReasonNote: nextStatus === LeadLifecycleStatus.ACTIVE ? null : reasonNote,
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: LEAD_ENTITY_TYPE,
        entityId: leadId,
        beforeData: {
          lifecycleStatus: toLeadLifecycleStatusKey(current.lifecycleStatus),
          lifecycleReasonCode: current.lifecycleReasonCode,
          lifecycleReasonNote: current.lifecycleReasonNote,
        },
        afterData: {
          lifecycleStatus: toLeadLifecycleStatusKey(nextStatus),
          lifecycleReasonCode: nextStatus === LeadLifecycleStatus.ACTIVE ? null : reasonCode ?? null,
          lifecycleReasonNote: nextStatus === LeadLifecycleStatus.ACTIVE ? null : reasonNote,
          lifecycleChangedAt: now.toISOString(),
        },
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
          workflowAction: nextStatus === LeadLifecycleStatus.ACTIVE ? 'reopen_lead' : 'update_lead_lifecycle',
        },
      }),
    });
  });

  return (await getLeadDetail(actor, leadId)) as LeadDetail;
}

export async function getLeadRoutingPolicy(actor: AuthenticatedActor): Promise<LeadRoutingPolicySummary> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.view');

  const policy = await prisma.leadRoutingPolicy.findUnique({
    where: {
      id: 'default',
    },
  });
  if (!policy) {
    throw new Error('Lead routing policy is not seeded');
  }

  return toLeadRoutingPolicySummary(policy);
}

export async function updateLeadRoutingPolicy(
  actor: AuthenticatedActor,
  input: UpdateLeadRoutingPolicyRequest,
): Promise<LeadRoutingPolicySummary> {
  assertActionAccess(actor.role, 'reference.manage');

  const current = await prisma.leadRoutingPolicy.findUnique({
    where: {
      id: 'default',
    },
  });
  if (!current) {
    throw new Error('Lead routing policy is not seeded');
  }

  const data: Prisma.LeadRoutingPolicyUpdateInput = {};
  if (input.routingBasis) {
    data.routingBasis = toLeadRoutingBasisEnum(input.routingBasis);
  }
  if (input.strategicGrowthMax !== undefined) {
    const normalized = normalizePositiveInteger(input.strategicGrowthMax, 'strategicGrowthMax');
    if (normalized < 1) {
      throw new Error('strategicGrowthMax must be at least 1');
    }
    data.strategicGrowthMax = normalized;
  }
  if (input.initialContactSlaHours !== undefined) {
    data.initialContactSlaHours = normalizePositiveInteger(input.initialContactSlaHours, 'initialContactSlaHours');
  }
  if (input.initialContactUrgentWindowHours !== undefined) {
    data.initialContactUrgentWindowHours = normalizePositiveInteger(
      input.initialContactUrgentWindowHours,
      'initialContactUrgentWindowHours',
    );
  }
  if (input.initialContactManagerEscalationDelayHours !== undefined) {
    data.initialContactManagerEscalationDelayHours = normalizePositiveInteger(
      input.initialContactManagerEscalationDelayHours,
      'initialContactManagerEscalationDelayHours',
    );
  }
  if (input.initialContactLeadershipEscalationDelayHours !== undefined) {
    data.initialContactLeadershipEscalationDelayHours = normalizePositiveInteger(
      input.initialContactLeadershipEscalationDelayHours,
      'initialContactLeadershipEscalationDelayHours',
    );
  }
  if (input.discoverySchedulingSlaHours !== undefined) {
    data.discoverySchedulingSlaHours = normalizePositiveInteger(
      input.discoverySchedulingSlaHours,
      'discoverySchedulingSlaHours',
    );
  }
  if (input.discoverySchedulingManagerEscalationDelayHours !== undefined) {
    data.discoverySchedulingManagerEscalationDelayHours = normalizePositiveInteger(
      input.discoverySchedulingManagerEscalationDelayHours,
      'discoverySchedulingManagerEscalationDelayHours',
    );
  }
  if (input.cisFollowUpBusinessDays !== undefined) {
    data.cisFollowUpBusinessDays = normalizePositiveInteger(input.cisFollowUpBusinessDays, 'cisFollowUpBusinessDays');
  }
  if (input.cisFollowUpProspectReminderDelayBusinessDays !== undefined) {
    data.cisFollowUpProspectReminderDelayBusinessDays = normalizePositiveInteger(
      input.cisFollowUpProspectReminderDelayBusinessDays,
      'cisFollowUpProspectReminderDelayBusinessDays',
    );
  }
  if (input.cisFollowUpOwnerAlertDelayBusinessDays !== undefined) {
    data.cisFollowUpOwnerAlertDelayBusinessDays = normalizePositiveInteger(
      input.cisFollowUpOwnerAlertDelayBusinessDays,
      'cisFollowUpOwnerAlertDelayBusinessDays',
    );
  }
  if (input.stagnantStageDays !== undefined) {
    data.stagnantStageDays = normalizePositiveInteger(input.stagnantStageDays, 'stagnantStageDays');
  }
  if (input.operationalAlertQuietHours !== undefined) {
    const quietHours = normalizeLeadOperationalAlertQuietHours(input.operationalAlertQuietHours, {
      enabled: current.operationalAlertQuietHoursEnabled,
      startLocal: current.operationalAlertQuietHoursStartLocal,
      endLocal: current.operationalAlertQuietHoursEndLocal,
      timeZone: current.operationalAlertQuietHoursTimeZone,
    });
    data.operationalAlertQuietHoursEnabled = quietHours.enabled;
    data.operationalAlertQuietHoursStartLocal = quietHours.startLocal;
    data.operationalAlertQuietHoursEndLocal = quietHours.endLocal;
    data.operationalAlertQuietHoursTimeZone = quietHours.timeZone;
  }
  if (input.notes !== undefined) {
    data.notes = optionalTrimmed(input.notes) ?? null;
  }
  if (Object.keys(data).length === 0) {
    throw new Error('At least one field must be provided');
  }

  const nextPolicy = {
    routingBasis: data.routingBasis ?? current.routingBasis,
    strategicGrowthMax: data.strategicGrowthMax ?? current.strategicGrowthMax,
    initialContactSlaHours: data.initialContactSlaHours ?? current.initialContactSlaHours,
    initialContactUrgentWindowHours:
      data.initialContactUrgentWindowHours ?? current.initialContactUrgentWindowHours,
    initialContactManagerEscalationDelayHours:
      data.initialContactManagerEscalationDelayHours ?? current.initialContactManagerEscalationDelayHours,
    initialContactLeadershipEscalationDelayHours:
      data.initialContactLeadershipEscalationDelayHours ?? current.initialContactLeadershipEscalationDelayHours,
    discoverySchedulingSlaHours:
      data.discoverySchedulingSlaHours ?? current.discoverySchedulingSlaHours,
    discoverySchedulingManagerEscalationDelayHours:
      data.discoverySchedulingManagerEscalationDelayHours ?? current.discoverySchedulingManagerEscalationDelayHours,
    cisFollowUpBusinessDays: data.cisFollowUpBusinessDays ?? current.cisFollowUpBusinessDays,
    cisFollowUpProspectReminderDelayBusinessDays:
      data.cisFollowUpProspectReminderDelayBusinessDays ?? current.cisFollowUpProspectReminderDelayBusinessDays,
    cisFollowUpOwnerAlertDelayBusinessDays:
      data.cisFollowUpOwnerAlertDelayBusinessDays ?? current.cisFollowUpOwnerAlertDelayBusinessDays,
    stagnantStageDays: data.stagnantStageDays ?? current.stagnantStageDays,
    operationalAlertQuietHoursEnabled:
      data.operationalAlertQuietHoursEnabled ?? current.operationalAlertQuietHoursEnabled,
    operationalAlertQuietHoursStartLocal:
      data.operationalAlertQuietHoursStartLocal ?? current.operationalAlertQuietHoursStartLocal,
    operationalAlertQuietHoursEndLocal:
      data.operationalAlertQuietHoursEndLocal ?? current.operationalAlertQuietHoursEndLocal,
    operationalAlertQuietHoursTimeZone:
      data.operationalAlertQuietHoursTimeZone ?? current.operationalAlertQuietHoursTimeZone,
  };

  if (nextPolicy.initialContactUrgentWindowHours > nextPolicy.initialContactSlaHours) {
    throw new Error('initialContactUrgentWindowHours cannot exceed initialContactSlaHours');
  }
  if (
    nextPolicy.initialContactLeadershipEscalationDelayHours
    < nextPolicy.initialContactManagerEscalationDelayHours
  ) {
    throw new Error('initialContactLeadershipEscalationDelayHours must be greater than or equal to the manager escalation delay');
  }
  if (
    nextPolicy.cisFollowUpProspectReminderDelayBusinessDays
    > nextPolicy.cisFollowUpBusinessDays
  ) {
    throw new Error('cisFollowUpProspectReminderDelayBusinessDays cannot exceed cisFollowUpBusinessDays');
  }
  if (
    nextPolicy.cisFollowUpOwnerAlertDelayBusinessDays
    < nextPolicy.cisFollowUpProspectReminderDelayBusinessDays
  ) {
    throw new Error('cisFollowUpOwnerAlertDelayBusinessDays must be greater than or equal to the prospect reminder delay');
  }
  if (nextPolicy.cisFollowUpOwnerAlertDelayBusinessDays > nextPolicy.cisFollowUpBusinessDays) {
    throw new Error('cisFollowUpOwnerAlertDelayBusinessDays cannot exceed cisFollowUpBusinessDays');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.leadRoutingPolicy.update({
      where: {
        id: 'default',
      },
      data,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: LEAD_ROUTING_POLICY_ENTITY_TYPE,
        entityId: next.id,
        beforeData: {
          routingBasis: toLeadRoutingBasisKey(current.routingBasis),
          strategicGrowthMax: current.strategicGrowthMax,
          initialContactSlaHours: current.initialContactSlaHours,
          initialContactUrgentWindowHours: current.initialContactUrgentWindowHours,
          initialContactManagerEscalationDelayHours: current.initialContactManagerEscalationDelayHours,
          initialContactLeadershipEscalationDelayHours: current.initialContactLeadershipEscalationDelayHours,
          discoverySchedulingSlaHours: current.discoverySchedulingSlaHours,
          discoverySchedulingManagerEscalationDelayHours: current.discoverySchedulingManagerEscalationDelayHours,
          cisFollowUpBusinessDays: current.cisFollowUpBusinessDays,
          cisFollowUpProspectReminderDelayBusinessDays: current.cisFollowUpProspectReminderDelayBusinessDays,
          cisFollowUpOwnerAlertDelayBusinessDays: current.cisFollowUpOwnerAlertDelayBusinessDays,
          stagnantStageDays: current.stagnantStageDays,
          operationalAlertQuietHours: toLeadOperationalAlertQuietHoursPolicy(current),
          notes: current.notes ?? undefined,
        },
        afterData: {
          routingBasis: toLeadRoutingBasisKey(next.routingBasis),
          strategicGrowthMax: next.strategicGrowthMax,
          initialContactSlaHours: next.initialContactSlaHours,
          initialContactUrgentWindowHours: next.initialContactUrgentWindowHours,
          initialContactManagerEscalationDelayHours: next.initialContactManagerEscalationDelayHours,
          initialContactLeadershipEscalationDelayHours: next.initialContactLeadershipEscalationDelayHours,
          discoverySchedulingSlaHours: next.discoverySchedulingSlaHours,
          discoverySchedulingManagerEscalationDelayHours: next.discoverySchedulingManagerEscalationDelayHours,
          cisFollowUpBusinessDays: next.cisFollowUpBusinessDays,
          cisFollowUpProspectReminderDelayBusinessDays: next.cisFollowUpProspectReminderDelayBusinessDays,
          cisFollowUpOwnerAlertDelayBusinessDays: next.cisFollowUpOwnerAlertDelayBusinessDays,
          stagnantStageDays: next.stagnantStageDays,
          operationalAlertQuietHours: toLeadOperationalAlertQuietHoursPolicy(next),
          notes: next.notes ?? undefined,
        },
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
        },
      }),
    });

    return next;
  });

  return toLeadRoutingPolicySummary(updated);
}

export async function updateLeadOperationalAlertQuietHours(
  actor: AuthenticatedActor,
  input: UpdateLeadOperationalAlertQuietHoursRequest,
): Promise<LeadRoutingPolicySummary> {
  assertActionAccess(actor.role, 'reference.manage');

  return updateLeadRoutingPolicy(actor, {
    operationalAlertQuietHours: input,
  });
}

export async function updateLeadOperationalAlertRecipient(
  actor: AuthenticatedActor,
  recipientId: string,
  input: UpdateLeadOperationalAlertRecipientRequest,
): Promise<LeadOperationalAlertRecipientSummary> {
  assertActionAccess(actor.role, 'admin.integration_manage');

  const current = await prisma.leadOperationalAlertRecipient.findUnique({
    where: { id: recipientId },
  });
  if (!current) {
    throw new Error('Lead operational alert recipient not found');
  }

  const data: Prisma.LeadOperationalAlertRecipientUpdateInput = {};
  if (input.name !== undefined) {
    data.name = requiredTrimmed(input.name, 'name');
  }
  if (input.email !== undefined) {
    data.email = optionalTrimmed(input.email ?? undefined) ?? null;
  }
  if (input.roleTitle !== undefined) {
    data.roleTitle = optionalTrimmed(input.roleTitle ?? undefined) ?? null;
  }
  if (input.isActive !== undefined) {
    data.isActive = Boolean(input.isActive);
  }
  if (input.sortOrder !== undefined) {
    data.sortOrder = normalizePositiveInteger(input.sortOrder, 'sortOrder', true);
  }
  if (Object.keys(data).length === 0) {
    throw new Error('At least one field must be provided');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.leadOperationalAlertRecipient.update({
      where: { id: recipientId },
      data,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: 'LEAD_OPERATIONAL_ALERT_RECIPIENT',
        entityId: next.id,
        beforeData: toLeadOperationalAlertRecipientAuditData(current),
        afterData: toLeadOperationalAlertRecipientAuditData(next),
        metadata: {
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
        },
      }),
    });

    return next;
  });

  return toLeadOperationalAlertRecipientSummary(updated);
}

async function createLeadRecord(
  tx: Prisma.TransactionClient,
  input: NormalizedLeadInput,
  context: LeadMutationContext,
  options?: {
    sourceMetadata?: Record<string, unknown>;
    auditMetadata?: Record<string, unknown>;
  },
): Promise<LeadWithRefs> {
  const [dependencies, policy] = await Promise.all([
    resolveLeadDependencies(tx, input.businessSegmentCode, input.leadSourceCode),
    getRoutingPolicy(tx),
  ]);
  const classification = await resolveLeadClassification(tx, input, {
    requireExplicitSelection: context.trigger === 'manual',
    disallowUnknownSelection: context.trigger === 'manual',
  });

  const routing = resolveRoutingDecision(input, policy);
  const now = new Date();

  const lead = await tx.lead.create({
    data: {
      companyName: input.companyName,
      ...(input.contactFirstName !== undefined ? { contactFirstName: input.contactFirstName } : {}),
      ...(input.contactLastName !== undefined ? { contactLastName: input.contactLastName } : {}),
      contactDisplayName: input.contactDisplayName,
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
      businessSegmentId: dependencies.businessSegmentId,
      leadSourceId: dependencies.leadSourceId,
      leadCaptureMethod: input.leadCaptureMethod,
      ...(input.leadType !== undefined ? { leadType: input.leadType } : {}),
      ...(input.sourceDetail !== undefined ? { sourceDetail: input.sourceDetail } : {}),
      ...(input.sourceSiteId !== undefined ? { sourceSiteId: input.sourceSiteId } : {}),
      ...(input.sourceSiteName !== undefined ? { sourceSiteName: input.sourceSiteName } : {}),
      ...(input.sourceBrandTag !== undefined ? { sourceBrandTag: input.sourceBrandTag } : {}),
      ...(input.sourceCampaign !== undefined ? { sourceCampaign: input.sourceCampaign } : {}),
      ...(input.leadRating !== undefined ? { leadRating: input.leadRating } : {}),
      serviceTechCount: input.serviceTechCount,
      ...(input.installTechCount !== undefined ? { installTechCount: input.installTechCount } : {}),
      ...(input.truckCount !== undefined ? { truckCount: input.truckCount } : {}),
      ...(input.salesPersonCount !== undefined ? { salesPersonCount: input.salesPersonCount } : {}),
      ...(input.potentialValueCents !== undefined ? { potentialValueCents: input.potentialValueCents } : {}),
      affinityGroupSelection: classification.affinity.selection,
      ownershipGroupSelection: classification.ownership.selection,
      ...(classification.affinity.id ? { affinityGroupId: classification.affinity.id } : {}),
      ...(classification.ownership.id ? { ownershipGroupId: classification.ownership.id } : {}),
      ...(classification.groupClassification ? { groupClassification: classification.groupClassification } : {}),
      ...(input.privateLabelName !== undefined ? { privateLabelName: input.privateLabelName } : {}),
      routingBasisSnapshot: routing.routingBasis,
      routingThresholdSnapshot: routing.threshold,
      routingTeam: routing.routingTeam,
      ...(input.leadOwnerName !== undefined || routing.leadOwnerName !== undefined
        ? { leadOwnerName: input.leadOwnerName ?? routing.leadOwnerName }
        : {}),
      ...(input.assignedTmName !== undefined ? { assignedTmName: input.assignedTmName } : {}),
      stage: LeadStage.NEW,
      initialContactDueAt: addHours(now, policy.initialContactSlaHours),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });

  if (input.state) {
    await syncLeadTerritoryAssignment(tx, {
      leadId: lead.id,
    });
  }

  const hydratedLead = await tx.lead.findUniqueOrThrow({
    where: { id: lead.id },
    include: LEAD_SUMMARY_INCLUDE,
  });

  if (options?.sourceMetadata && Object.keys(options.sourceMetadata).length > 0) {
    await tx.leadExtension.create({
      data: {
        leadId: lead.id,
        sourceMetadata: options.sourceMetadata as Prisma.InputJsonValue,
      },
    });
  }

  await tx.leadStageEvent.create({
    data: {
      leadId: lead.id,
      ...(context.actorUserId !== undefined ? { actorUserId: context.actorUserId } : {}),
      toStage: LeadStage.NEW,
      note: 'Lead created',
      metadata: {
        actorRole: context.actorRole,
        actorType: context.actorType,
        sessionId: context.sessionId,
        trigger: context.trigger,
      },
      occurredAt: now,
    },
  });

  await tx.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: context.actorUserId,
      action: AuditAction.CREATE,
      entityType: LEAD_ENTITY_TYPE,
      entityId: lead.id,
      afterData: {
        companyName: hydratedLead.companyName,
        stage: toLeadStageKey(hydratedLead.stage),
        routingTeam: toLeadRoutingTeamKey(hydratedLead.routingTeam),
        businessSegmentCode: dependencies.businessSegmentCode,
        leadSourceCode: input.leadSourceCode,
        serviceTechCount: hydratedLead.serviceTechCount,
        potentialValueCents: hydratedLead.potentialValueCents ?? undefined,
        territoryCode: hydratedLead.territory?.code ?? undefined,
      },
      metadata: {
        actorRole: context.actorRole,
        actorType: context.actorType,
        sessionId: context.sessionId,
        trigger: context.trigger,
        ...(options?.auditMetadata ?? {}),
      },
    }),
  });

  return hydratedLead;
}

async function resolveLeadClassification(
  tx: Prisma.TransactionClient,
  input: NormalizedLeadInput,
  options: {
    requireExplicitSelection: boolean;
    disallowUnknownSelection: boolean;
  },
) {
  const affinity = await resolveAffinityGroupAxis({
    tx,
    kind: 'affinity',
    selection: input.affinityGroupSelection,
    id: input.affinityGroupId,
    code: input.affinityGroupCode,
    name: input.affinityGroupName,
    requireExplicitSelection: options.requireExplicitSelection,
    disallowUnknownSelection: options.disallowUnknownSelection,
  });
  const ownership = await resolveOwnershipGroupAxis({
    tx,
    kind: 'ownership',
    selection: input.ownershipGroupSelection,
    id: input.ownershipGroupId,
    code: input.ownershipGroupCode,
    name: input.ownershipGroupName,
    requireExplicitSelection: options.requireExplicitSelection,
    disallowUnknownSelection: options.disallowUnknownSelection,
  });

  return {
    affinity,
    ownership,
    groupClassification: deriveGroupClassification(affinity.selection, ownership.selection),
  };
}

async function resolveLeadDependencies(
  tx: Prisma.TransactionClient,
  businessSegmentCode: string,
  leadSourceCode: string,
): Promise<ResolvedLeadDependencies> {
  const [businessSegment, leadSource] = await Promise.all([
    tx.businessSegmentRef.findUnique({
      where: {
        code: normalizeCode(businessSegmentCode),
      },
    }),
    tx.leadSourceRef.findUnique({
      where: {
        code: normalizeCode(leadSourceCode),
      },
    }),
  ]);

  if (!businessSegment || !businessSegment.isActive) {
    throw new Error(`Unknown or inactive business segment: ${businessSegmentCode}`);
  }
  if (!leadSource || !leadSource.isActive) {
    throw new Error(`Unknown or inactive lead source: ${leadSourceCode}`);
  }

  return {
    businessSegmentId: businessSegment.id,
    businessSegmentCode: businessSegment.code,
    leadSourceId: leadSource.id,
  };
}

async function getRoutingPolicy(tx: Prisma.TransactionClient): Promise<LeadRoutingPolicyRecord> {
  let policy = await tx.leadRoutingPolicy.findUnique({
    where: {
      id: 'default',
    },
  });

  if (!policy) {
    await ensureLeadRoutingPolicySeeded();
    policy = await tx.leadRoutingPolicy.findUnique({
      where: {
        id: 'default',
      },
    });
  }

  if (!policy) {
    throw new Error('Lead routing policy is not seeded');
  }

  return policy;
}

async function findWebsiteLeadDuplicate(
  tx: Prisma.TransactionClient,
  input: LeadInputSource,
): Promise<LeadWithRefs | null> {
  const duplicateSignals = buildLeadDuplicateSignals(input);

  if (duplicateSignals.length === 0) {
    return null;
  }

  return tx.lead.findFirst({
    where: {
      AND: [
        {
          lifecycleStatus: LeadLifecycleStatus.ACTIVE,
        },
        {
          stage: {
            not: LeadStage.CUSTOMER_ACTIVE,
          },
        },
        {
          OR: duplicateSignals,
        },
      ],
    },
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    include: LEAD_SUMMARY_INCLUDE,
  });
}

async function findLeadImportDuplicateCandidates(
  tx: Prisma.TransactionClient,
  input: LeadInputSource,
): Promise<LeadImportDuplicateCandidate[]> {
  const leadSignals = buildLeadDuplicateSignals(input);
  const accountSignals = buildAccountDuplicateSignals(input);

  if (leadSignals.length === 0 && accountSignals.length === 0) {
    return [];
  }

  const [leadMatches, accountMatches] = await Promise.all([
    leadSignals.length > 0
      ? tx.lead.findMany({
          where: {
            AND: [
              {
                stage: {
                  not: LeadStage.CUSTOMER_ACTIVE,
                },
              },
              {
                OR: leadSignals,
              },
            ],
          },
          orderBy: [
            { updatedAt: 'desc' },
            { createdAt: 'desc' },
          ],
          take: 5,
          include: LEAD_SUMMARY_INCLUDE,
        })
      : Promise.resolve([]),
    accountSignals.length > 0
      ? tx.account.findMany({
          where: {
            OR: accountSignals,
          },
          orderBy: [
            { updatedAt: 'desc' },
            { createdAt: 'desc' },
          ],
          take: 5,
          include: {
            contacts: {
              where: {
                isActive: true,
              },
              orderBy: [
                { isPrimary: 'desc' },
                { createdAt: 'asc' },
              ],
              take: 1,
            },
          },
        })
      : Promise.resolve([]),
  ]);

  return [
    ...leadMatches.map(toLeadImportDuplicateCandidate),
    ...accountMatches.map(toAccountImportDuplicateCandidate),
  ];
}

function buildLeadDuplicateSignals(input: LeadInputSource): Prisma.LeadWhereInput[] {
  const email = optionalTrimmed(asString(input.email))?.toLowerCase();
  const phone = optionalTrimmed(asString(input.phone));
  const companyName = optionalTrimmed(asString(input.companyName));
  const state = normalizeState(asString(input.state));
  const duplicateSignals: Prisma.LeadWhereInput[] = [];

  if (email) {
    duplicateSignals.push({
      email: {
        equals: email,
        mode: Prisma.QueryMode.insensitive,
      },
    });
  }

  if (phone) {
    duplicateSignals.push({ phone });
  }

  if (companyName && state) {
    duplicateSignals.push({
      AND: [
        {
          companyName: {
            equals: companyName,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        { state },
      ],
    });
  }

  return duplicateSignals;
}

async function enrichExistingLeadFromDuplicate(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  normalized: NormalizedLeadInput,
  duplicateResolution: {
    decision: 'enrich_existing';
    reason: string;
    targetEntityId?: string;
  },
  duplicateCandidates: LeadImportDuplicateCandidate[],
): Promise<LeadWithRefs> {
  const targetEntityId = duplicateResolution.targetEntityId;
  if (!targetEntityId) {
    throw new Error('duplicateResolution.targetEntityId is required when enriching an existing lead');
  }
  const selectedCandidate = duplicateCandidates.find((candidate) => candidate.entityId === targetEntityId);
  if (!selectedCandidate) {
    throw new Error('duplicateResolution.targetEntityId must match one of the duplicate candidates');
  }
  if (selectedCandidate.entityType !== 'lead') {
    throw new Error('Only existing lead candidates can be enriched from duplicate intake');
  }

  const current = await tx.lead.findUnique({
    where: { id: targetEntityId },
    include: LEAD_SUMMARY_INCLUDE,
  }) as LeadWithRefs | null;
  if (!current) {
    throw new Error(`Lead not found: ${targetEntityId}`);
  }

  const data: Prisma.LeadUpdateInput = {};
  const beforeData: Record<string, unknown> = {};
  const afterData: Record<string, unknown> = {};

  applyDuplicateEnrichmentTextPatch({ data, beforeData, afterData, current, field: 'contactFirstName', nextValue: normalized.contactFirstName });
  applyDuplicateEnrichmentTextPatch({ data, beforeData, afterData, current, field: 'contactLastName', nextValue: normalized.contactLastName });
  applyDuplicateEnrichmentTextPatch({ data, beforeData, afterData, current, field: 'email', nextValue: normalized.email });
  applyDuplicateEnrichmentTextPatch({ data, beforeData, afterData, current, field: 'phone', nextValue: normalized.phone });
  applyDuplicateEnrichmentTextPatch({ data, beforeData, afterData, current, field: 'state', nextValue: normalized.state });
  applyDuplicateEnrichmentTextPatch({ data, beforeData, afterData, current, field: 'countryCode', nextValue: normalized.countryCode });
  applyDuplicateEnrichmentTextPatch({ data, beforeData, afterData, current, field: 'sourceDetail', nextValue: normalized.sourceDetail });
  applyDuplicateEnrichmentTextPatch({ data, beforeData, afterData, current, field: 'sourceSiteId', nextValue: normalized.sourceSiteId });
  applyDuplicateEnrichmentTextPatch({ data, beforeData, afterData, current, field: 'sourceSiteName', nextValue: normalized.sourceSiteName });
  applyDuplicateEnrichmentTextPatch({ data, beforeData, afterData, current, field: 'sourceBrandTag', nextValue: normalized.sourceBrandTag });
  applyDuplicateEnrichmentTextPatch({ data, beforeData, afterData, current, field: 'sourceCampaign', nextValue: normalized.sourceCampaign });
  applyDuplicateEnrichmentTextPatch({ data, beforeData, afterData, current, field: 'leadRating', nextValue: normalized.leadRating });
  applyDuplicateEnrichmentTextPatch({ data, beforeData, afterData, current, field: 'privateLabelName', nextValue: normalized.privateLabelName });
  applyDuplicateEnrichmentNumberPatch({ data, beforeData, afterData, current, field: 'installTechCount', nextValue: normalized.installTechCount });
  applyDuplicateEnrichmentNumberPatch({ data, beforeData, afterData, current, field: 'truckCount', nextValue: normalized.truckCount });
  applyDuplicateEnrichmentNumberPatch({ data, beforeData, afterData, current, field: 'salesPersonCount', nextValue: normalized.salesPersonCount });
  applyDuplicateEnrichmentNumberPatch({ data, beforeData, afterData, current, field: 'potentialValueCents', nextValue: normalized.potentialValueCents });

  const incomingNotes = optionalTrimmed(normalized.notes);
  if (incomingNotes && !(current.notes ?? '').includes(incomingNotes)) {
    const nextNotes = [current.notes, `Duplicate intake note: ${incomingNotes}`].filter(Boolean).join('\n\n');
    data.notes = nextNotes;
    beforeData.notes = current.notes ?? null;
    afterData.notes = nextNotes;
  }

  const enrichedFields = Object.keys(afterData);
  if (enrichedFields.length === 0) {
    throw new Error('Existing lead already contains the non-destructive duplicate intake values');
  }

  const updated = await tx.lead.update({
    where: { id: targetEntityId },
    data,
    include: LEAD_SUMMARY_INCLUDE,
  }) as LeadWithRefs;

  if (Object.prototype.hasOwnProperty.call(afterData, 'state')) {
    await syncLeadTerritoryAssignment(tx, { leadId: targetEntityId });
  }

  await tx.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: LEAD_ENTITY_TYPE,
      entityId: targetEntityId,
      beforeData,
      afterData,
      metadata: {
        actorRole: actor.role,
        actorType: actor.actorType,
        sessionId: actor.sessionId,
        workflowAction: 'duplicate_enrich_existing',
        duplicateResolution: {
          decision: duplicateResolution.decision,
          reason: duplicateResolution.reason,
          targetEntityId,
          candidateCount: duplicateCandidates.length,
          selectedCandidate,
          enrichedFields,
        },
      },
    }),
  });

  return updated;
}

function applyDuplicateEnrichmentTextPatch(input: {
  data: Prisma.LeadUpdateInput;
  beforeData: Record<string, unknown>;
  afterData: Record<string, unknown>;
  current: LeadWithRefs;
  field:
    | 'contactFirstName'
    | 'contactLastName'
    | 'email'
    | 'phone'
    | 'state'
    | 'countryCode'
    | 'sourceDetail'
    | 'sourceSiteId'
    | 'sourceSiteName'
    | 'sourceBrandTag'
    | 'sourceCampaign'
    | 'leadRating'
    | 'privateLabelName';
  nextValue: string | undefined;
}) {
  const nextValue = optionalTrimmed(input.nextValue);
  if (!nextValue) {
    return;
  }
  const currentValue = (input.current[input.field] ?? null) as string | null;
  if (currentValue) {
    return;
  }
  (input.data as Record<string, string>)[input.field] = nextValue;
  input.beforeData[input.field] = null;
  input.afterData[input.field] = nextValue;
}

function applyDuplicateEnrichmentNumberPatch(input: {
  data: Prisma.LeadUpdateInput;
  beforeData: Record<string, unknown>;
  afterData: Record<string, unknown>;
  current: LeadWithRefs;
  field: 'installTechCount' | 'truckCount' | 'salesPersonCount' | 'potentialValueCents';
  nextValue: number | undefined;
}) {
  if (input.nextValue === undefined) {
    return;
  }
  const currentValue = (input.current[input.field] ?? null) as number | null;
  if (currentValue !== null && currentValue !== undefined) {
    return;
  }
  (input.data as Record<string, number>)[input.field] = input.nextValue;
  input.beforeData[input.field] = null;
  input.afterData[input.field] = input.nextValue;
}

function normalizeManualDuplicateResolution(value: CreateLeadRequest['duplicateResolution']) {
  if (value === undefined) {
    return undefined;
  }

  if (value.decision !== 'create_new' && value.decision !== 'enrich_existing') {
    throw new Error(`Unsupported manual duplicate-resolution decision: ${value.decision}`);
  }

  const reason = requiredTrimmed(value.reason, 'duplicateResolution.reason');
  const targetEntityId = optionalTrimmed(value.targetEntityId);
  if (value.decision === 'enrich_existing' && !targetEntityId) {
    throw new Error('duplicateResolution.targetEntityId is required when enriching an existing lead');
  }
  return {
    decision: value.decision,
    reason,
    ...(targetEntityId ? { targetEntityId } : {}),
  };
}

function buildAccountDuplicateSignals(input: LeadInputSource): Prisma.AccountWhereInput[] {
  const email = optionalTrimmed(asString(input.email))?.toLowerCase();
  const phone = optionalTrimmed(asString(input.phone));
  const companyName = optionalTrimmed(asString(input.companyName));
  const duplicateSignals: Prisma.AccountWhereInput[] = [];

  if (companyName) {
    duplicateSignals.push({
      displayName: {
        equals: companyName,
        mode: Prisma.QueryMode.insensitive,
      },
    });
    duplicateSignals.push({
      legalName: {
        equals: companyName,
        mode: Prisma.QueryMode.insensitive,
      },
    });
  }

  if (email) {
    duplicateSignals.push({
      contacts: {
        some: {
          email: {
            equals: email,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      },
    });
  }

  if (phone) {
    duplicateSignals.push({
      contacts: {
        some: {
          OR: [
            { phone },
            { mobilePhone: phone },
          ],
        },
      },
    });
  }

  return duplicateSignals;
}

function toLeadImportDuplicateCandidate(lead: LeadWithRefs): LeadImportDuplicateCandidate {
  return {
    entityType: 'lead',
    entityId: lead.id,
    title: lead.companyName,
    subtitle: `${lead.contactDisplayName} · ${toLeadStageKey(lead.stage)} · ${toLeadLifecycleStatusKey(lead.lifecycleStatus)}`,
    detail: [lead.email, lead.phone, lead.state].filter(Boolean).join(' · '),
  };
}

function toAccountImportDuplicateCandidate(
  account: Prisma.AccountGetPayload<{
    include: {
      contacts: true;
    };
  }>,
): LeadImportDuplicateCandidate {
  const primaryContact = account.contacts[0];
  return {
    entityType: 'account',
    entityId: account.id,
    title: account.displayName,
    subtitle: account.accountNumber ? `Account ${account.accountNumber}` : 'Existing customer account',
    detail: [
      account.legalName,
      primaryContact ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim() : null,
      primaryContact?.email ?? null,
      primaryContact?.phone ?? primaryContact?.mobilePhone ?? null,
    ].filter(Boolean).join(' · '),
  };
}

function buildImportLeadRowInput(input: ImportLeadFileRequest, row: ImportLeadRowInput): LeadInputSource {
  return {
    ...row,
    ...(input.businessSegmentCode !== undefined ? { businessSegmentCode: input.businessSegmentCode } : {}),
    ...(input.leadSourceCode !== undefined ? { leadSourceCode: input.leadSourceCode } : {}),
    ...(input.sourceSiteId !== undefined ? { sourceSiteId: input.sourceSiteId } : {}),
    ...(input.sourceSiteName !== undefined ? { sourceSiteName: input.sourceSiteName } : {}),
    ...(input.sourceBrandTag !== undefined ? { sourceBrandTag: input.sourceBrandTag } : {}),
  };
}

function resolveRoutingDecision(input: NormalizedLeadInput, policy: Prisma.LeadRoutingPolicyGetPayload<{}>): RoutingDecision {
  const threshold = policy.strategicGrowthMax;
  let metricValue: number | undefined;

  if (policy.routingBasis === LeadRoutingBasis.SERVICE_TECH_COUNT) {
    metricValue = input.serviceTechCount;
  } else if (policy.routingBasis === LeadRoutingBasis.TRUCK_COUNT) {
    metricValue = input.truckCount;
  }

  if (metricValue === undefined) {
    throw new Error(
      policy.routingBasis === LeadRoutingBasis.SERVICE_TECH_COUNT
        ? 'serviceTechCount is required for the active routing policy'
        : 'truckCount is required for the active routing policy',
    );
  }

  const routingTeam = metricValue <= threshold ? LeadRoutingTeam.STRATEGIC_GROWTH : LeadRoutingTeam.NATIONAL_TM;

  return {
    routingBasis: policy.routingBasis,
    threshold,
    routingTeam,
    leadOwnerName: routingTeam === LeadRoutingTeam.STRATEGIC_GROWTH ? 'Strategic Growth Team' : 'Territory Manager Queue',
  };
}

function buildLeadStageTimestampPatch(fromStage: LeadStage, toStage: LeadStage, occurredAt: Date) {
  const data: Prisma.LeadUpdateInput = {};

  if (LEAD_STAGE_ORDER[toStage] > LEAD_STAGE_ORDER[LeadStage.NEW]) {
    data.initialContactedAt = occurredAt;
  }

  switch (toStage) {
    case LeadStage.DISCOVERY_SCHEDULED:
      data.discoveryScheduledAt = occurredAt;
      break;
    case LeadStage.DISCOVERY_COMPLETED:
      data.discoveryCompletedAt = occurredAt;
      break;
    case LeadStage.CIS_SENT:
      data.cisSentAt = occurredAt;
      break;
    case LeadStage.CIS_SIGNED:
      data.cisSignedAt = occurredAt;
      break;
    case LeadStage.ONBOARDING_COMPLETED:
      data.onboardingCompletedAt = occurredAt;
      break;
    case LeadStage.CUSTOMER_ACTIVE:
      data.firstOrderAt = occurredAt;
      break;
    default:
      break;
  }

  if (fromStage === LeadStage.CIS_SENT && toStage === LeadStage.CIS_SIGNED) {
    data.cisSubmittedAt = occurredAt;
  }

  return data;
}

function normalizeDiscoveryCompletionInput(
  input: CompleteLeadDiscoveryRequest | SkipLeadDiscoveryRequest,
  requireFastTrackReason: boolean,
) {
  const painPoints = Array.from(
    new Set(
      (Array.isArray(input.painPoints) ? input.painPoints : [])
        .map((value) => optionalTrimmed(value))
        .filter((value): value is string => Boolean(value)),
    ),
  ).slice(0, 12);

  const currentIaqSetup = optionalTrimmed(input.currentIaqSetup);
  const decisionMaker = optionalTrimmed(input.decisionMaker);
  const buyingIntent = optionalTrimmed(input.buyingIntent);
  const summary = optionalTrimmed(input.summary);
  const note = optionalTrimmed(input.note);
  const fastTrackReason =
    'fastTrackReason' in input ? optionalTrimmed(input.fastTrackReason) : undefined;

  if (requireFastTrackReason && !fastTrackReason) {
    throw new Error('A fast-track reason is required when discovery is skipped');
  }

  if (!requireFastTrackReason && (!summary || summary.length < 10)) {
    throw new Error('Discovery summary must be at least 10 characters before discovery can be completed');
  }

  const consignmentInterestStatus = input.consignmentInterestStatus;
  const consignmentEntryTiming = input.consignmentEntryTiming;

  if (
    consignmentInterestStatus
    && consignmentInterestStatus !== 'not_discussed'
    && consignmentInterestStatus !== 'declined'
    && !consignmentEntryTiming
  ) {
    throw new Error('Consignment entry timing is required when consignment interest is active');
  }

  if (
    (consignmentInterestStatus === 'not_discussed' || consignmentInterestStatus === 'declined')
    && consignmentEntryTiming
  ) {
    throw new Error('Consignment entry timing can only be set for interested or approved leads');
  }

  return {
    painPoints,
    ...(currentIaqSetup ? { currentIaqSetup } : {}),
    ...(decisionMaker ? { decisionMaker } : {}),
    ...(buyingIntent ? { buyingIntent } : {}),
    ...(consignmentInterestStatus ? { consignmentInterestStatus } : {}),
    ...(consignmentEntryTiming ? { consignmentEntryTiming } : {}),
    ...(summary ? { summary } : {}),
    ...(fastTrackReason ? { fastTrackReason } : {}),
    ...(note ? { note } : {}),
  };
}

function assertConsignmentLeadActionAccess(
  actor: AuthenticatedActor,
  consignmentInterestStatus: LeadConsignmentInterestStatusKey | undefined,
) {
  if (consignmentInterestStatus === 'approved') {
    assertActionAccess(actor.role, 'lead.consignment_approve');
  }
}

async function auditConsignmentLeadCapture(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  current: {
    id: string;
    consignmentInterestStatus: LeadConsignmentInterestStatus | null;
    consignmentEntryTiming: LeadConsignmentEntryTiming | null;
  },
  normalized: {
    consignmentInterestStatus?: LeadConsignmentInterestStatusKey;
    consignmentEntryTiming?: LeadConsignmentEntryTimingKey;
    note?: string;
  },
  workflowAction: 'complete_discovery' | 'skip_discovery',
) {
  if (!normalized.consignmentInterestStatus) {
    return;
  }

  await tx.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'CONSIGNMENT_LEAD_INTAKE',
      entityId: current.id,
      sourceSystem: 'pulse-consignment',
      beforeData: {
        consignmentInterestStatus: current.consignmentInterestStatus
          ? toLeadConsignmentInterestStatusKey(current.consignmentInterestStatus)
          : null,
        consignmentEntryTiming: current.consignmentEntryTiming
          ? toLeadConsignmentEntryTimingKey(current.consignmentEntryTiming)
          : null,
      },
      afterData: {
        consignmentInterestStatus: normalized.consignmentInterestStatus,
        consignmentEntryTiming: normalized.consignmentEntryTiming ?? null,
      },
      metadata: {
        actorRole: actor.role,
        actorType: actor.actorType,
        sessionId: actor.sessionId,
        note: normalized.note,
        workflowAction,
        acumaticaSyncStatus: 'parked',
      },
    }),
  });
}

function normalizeEditableLeadText(
  value: string | null | undefined,
  mode: 'required' | 'nullable' | 'email',
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    if (mode === 'required') {
      throw new Error('Value is required');
    }
    return null;
  }

  if (mode === 'required') {
    return requiredTrimmed(value, 'value');
  }

  if (mode === 'email') {
    return optionalTrimmed(value) ? normalizeEmailAddress(value) : null;
  }

  return optionalTrimmed(value) ?? null;
}

function applyLeadEditableTextPatch(input: {
  data: Prisma.LeadUpdateInput;
  beforeData: Record<string, unknown>;
  afterData: Record<string, unknown>;
  current: LeadWithDetailRefs;
  field:
    | 'contactFirstName'
    | 'contactLastName'
    | 'companyName'
    | 'contactDisplayName'
    | 'email'
    | 'phone'
    | 'sourceDetail'
    | 'sourceSiteId'
    | 'sourceSiteName'
    | 'sourceBrandTag'
    | 'sourceCampaign'
    | 'leadRating'
    | 'privateLabelName'
    | 'notes';
  nextValue: string | null | undefined;
  mode: 'required' | 'nullable' | 'email';
}) {
  if (input.nextValue === undefined) {
    return;
  }

  const normalized = normalizeEditableLeadText(input.nextValue, input.mode) as string | null;
  const currentValue = (input.current[input.field] ?? null) as string | null;

  if (currentValue === normalized) {
    return;
  }

  (input.data as Record<string, string | null>)[input.field] = normalized;
  input.beforeData[input.field] = currentValue;
  input.afterData[input.field] = normalized;
}

function normalizeEditableLeadNumber(
  value: number | null | undefined,
  field: string,
  mode: 'required' | 'nullable',
) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    if (mode === 'required') {
      throw new Error(`${field} is required`);
    }
    return null;
  }

  return normalizePositiveInteger(value, field, true);
}

function applyLeadEditableNumberPatch(input: {
  data: Prisma.LeadUpdateInput;
  beforeData: Record<string, unknown>;
  afterData: Record<string, unknown>;
  current: LeadWithDetailRefs;
  field:
    | 'serviceTechCount'
    | 'installTechCount'
    | 'truckCount'
    | 'salesPersonCount'
    | 'potentialValueCents';
  nextValue: number | null | undefined;
  mode: 'required' | 'nullable';
}) {
  if (input.nextValue === undefined) {
    return;
  }

  const normalized = normalizeEditableLeadNumber(input.nextValue, input.field, input.mode);
  const currentValue = (input.current[input.field] ?? null) as number | null;

  if (currentValue === normalized) {
    return;
  }

  (input.data as Record<string, number | null>)[input.field] = normalized as number | null;
  input.beforeData[input.field] = currentValue;
  input.afterData[input.field] = normalized;
}

async function createLeadStageEvent(
  tx: Prisma.TransactionClient,
  input: {
    leadId: string;
    actorUserId?: string;
    fromStage?: LeadStage;
    toStage: LeadStage;
    note?: string;
    metadata?: Record<string, unknown>;
    occurredAt: Date;
  },
) {
  await tx.leadStageEvent.create({
    data: {
      leadId: input.leadId,
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      ...(input.fromStage ? { fromStage: input.fromStage } : {}),
      toStage: input.toStage,
      ...(input.note ? { note: input.note } : {}),
      ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
      occurredAt: input.occurredAt,
    },
  });
}

function normalizeLeadInput(
  input: LeadInputSource,
  defaults: {
    defaultBusinessSegmentCode: string;
    defaultLeadSourceCode: string;
    leadCaptureMethod: LeadCaptureMethod;
  },
): NormalizedLeadInput {
  const companyName = requiredTrimmed(input.companyName, 'companyName');
  const contactFirstName = optionalTrimmed(asString(input.contactFirstName));
  const contactLastName = optionalTrimmed(asString(input.contactLastName));
  const contactDisplayName = resolveContactDisplayName({
    contactDisplayName: optionalTrimmed(asString(input.contactDisplayName)),
    contactFirstName,
    contactLastName,
    companyName,
  });
  const serviceTechCount = normalizePositiveInteger(input.serviceTechCount, 'serviceTechCount');
  const email = normalizeOptionalEmail(asString(input.email));
  const phone = normalizeOptionalPhone(asString(input.phone));
  const state = normalizeState(asString(input.state));
  const countryCode = normalizeCountryCode(asString(input.countryCode), state);
  const sourceDetail = optionalTrimmed(asString(input.sourceDetail));
  const leadType = normalizeOptionalWebsiteLeadType(input.leadType);
  const sourceSiteId = optionalTrimmed(asString(input.sourceSiteId));
  const sourceSiteName = optionalTrimmed(asString(input.sourceSiteName));
  const sourceBrandTag = optionalTrimmed(asString(input.sourceBrandTag));
  const sourceCampaign = optionalTrimmed(asString(input.sourceCampaign));
  const leadRating = optionalTrimmed(asString(input.leadRating));
  const affinityGroupSelection = normalizeOptionalGroupAxisSelection(asString(input.affinityGroupSelection), 'affinityGroupSelection');
  const affinityGroupId = optionalTrimmed(asString(input.affinityGroupId));
  const affinityGroupCode = optionalTrimmed(asString(input.affinityGroupCode));
  const affinityGroupName = optionalTrimmed(asString(input.affinityGroupName));
  const ownershipGroupSelection = normalizeOptionalGroupAxisSelection(asString(input.ownershipGroupSelection), 'ownershipGroupSelection');
  const ownershipGroupId = optionalTrimmed(asString(input.ownershipGroupId));
  const ownershipGroupCode = optionalTrimmed(asString(input.ownershipGroupCode));
  const ownershipGroupName = optionalTrimmed(asString(input.ownershipGroupName));
  const privateLabelName = optionalTrimmed(asString(input.privateLabelName));
  const leadOwnerName = optionalTrimmed(asString(input.leadOwnerName));
  const assignedTmName = optionalTrimmed(asString(input.assignedTmName));
  const notes = optionalTrimmed(asString(input.notes));
  assertNoRawPaymentCardData(notes, 'Lead notes');
  const installTechCount =
    input.installTechCount !== undefined
      ? normalizePositiveInteger(input.installTechCount, 'installTechCount', true)
      : undefined;
  const truckCount =
    input.truckCount !== undefined ? normalizePositiveInteger(input.truckCount, 'truckCount', true) : undefined;
  const salesPersonCount =
    input.salesPersonCount !== undefined
      ? normalizePositiveInteger(input.salesPersonCount, 'salesPersonCount', true)
      : undefined;
  const potentialValueCents =
    input.potentialValueCents !== undefined
      ? normalizePositiveInteger(input.potentialValueCents, 'potentialValueCents', true)
      : undefined;

  return {
    companyName,
    ...(contactFirstName !== undefined ? { contactFirstName } : {}),
    ...(contactLastName !== undefined ? { contactLastName } : {}),
    contactDisplayName,
    ...(email !== undefined ? { email } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(state !== undefined ? { state } : {}),
    ...(countryCode !== undefined ? { countryCode } : {}),
    businessSegmentCode: normalizeCode(asString(input.businessSegmentCode) ?? defaults.defaultBusinessSegmentCode),
    leadSourceCode: normalizeCode(asString(input.leadSourceCode) ?? defaults.defaultLeadSourceCode),
    leadCaptureMethod: defaults.leadCaptureMethod,
    ...(leadType !== undefined ? { leadType } : {}),
    ...(sourceDetail !== undefined ? { sourceDetail } : {}),
    ...(sourceSiteId !== undefined ? { sourceSiteId } : {}),
    ...(sourceSiteName !== undefined ? { sourceSiteName } : {}),
    ...(sourceBrandTag !== undefined ? { sourceBrandTag } : {}),
    ...(sourceCampaign !== undefined ? { sourceCampaign } : {}),
    ...(leadRating !== undefined ? { leadRating } : {}),
    serviceTechCount,
    ...(installTechCount !== undefined ? { installTechCount } : {}),
    ...(truckCount !== undefined ? { truckCount } : {}),
    ...(salesPersonCount !== undefined ? { salesPersonCount } : {}),
    ...(potentialValueCents !== undefined ? { potentialValueCents } : {}),
    ...(affinityGroupSelection !== undefined ? { affinityGroupSelection } : {}),
    ...(affinityGroupId !== undefined ? { affinityGroupId } : {}),
    ...(affinityGroupCode !== undefined ? { affinityGroupCode } : {}),
    ...(affinityGroupName !== undefined ? { affinityGroupName } : {}),
    ...(ownershipGroupSelection !== undefined ? { ownershipGroupSelection } : {}),
    ...(ownershipGroupId !== undefined ? { ownershipGroupId } : {}),
    ...(ownershipGroupCode !== undefined ? { ownershipGroupCode } : {}),
    ...(ownershipGroupName !== undefined ? { ownershipGroupName } : {}),
    ...(privateLabelName !== undefined ? { privateLabelName } : {}),
    ...(leadOwnerName !== undefined ? { leadOwnerName } : {}),
    ...(assignedTmName !== undefined ? { assignedTmName } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
}

function buildWebsiteLeadSearchClauses(search: string): Prisma.LeadWhereInput[] {
  return [
    { companyName: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { contactDisplayName: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { phone: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { sourceSiteId: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { sourceSiteName: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { sourceBrandTag: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { sourceCampaign: { contains: search, mode: Prisma.QueryMode.insensitive } },
  ];
}

function buildWebsiteLeadSubmissionSearchClauses(search: string): Prisma.WebsiteLeadSubmissionWhereInput[] {
  return [
    { contactDisplayName: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { companyName: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { phone: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { inquiryTopic: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { referralSource: { contains: search, mode: Prisma.QueryMode.insensitive } },
    {
      websiteLeadSite: {
        is: {
          siteName: { contains: search, mode: Prisma.QueryMode.insensitive },
        },
      },
    },
    {
      websiteLeadSite: {
        is: {
          brandTag: { contains: search, mode: Prisma.QueryMode.insensitive },
        },
      },
    },
    {
      linkedLead: {
        is: {
          companyName: { contains: search, mode: Prisma.QueryMode.insensitive },
        },
      },
    },
  ];
}

function buildWorkflowLeadSearchClauses(search: string): Prisma.LeadWhereInput[] {
  return [
    { companyName: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { contactDisplayName: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { phone: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { leadOwnerName: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { assignedTmName: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { sourceSiteName: { contains: search, mode: Prisma.QueryMode.insensitive } },
    { sourceBrandTag: { contains: search, mode: Prisma.QueryMode.insensitive } },
  ];
}

function toWebsiteFormLeadSummary(lead: LeadWithRefs): WebsiteFormLeadSummary {
  const now = Date.now();
  const intakeAgeHours = Math.max(0, Math.floor((now - lead.createdAt.getTime()) / (60 * 60 * 1000)));

  return {
    ...toLeadSummary(lead),
    intakeAgeHours,
    activePipeline: lead.stage !== LeadStage.CUSTOMER_ACTIVE && lead.lifecycleStatus === LeadLifecycleStatus.ACTIVE,
    ...(lead.sourceCampaign ? { sourceCampaign: lead.sourceCampaign } : {}),
  };
}

function toWebsiteLeadSubmissionSummary(item: WebsiteLeadSubmissionWithRefs): WebsiteLeadSubmissionSummary {
  return {
    id: item.id,
    ...(item.websiteLeadSiteId ? { websiteLeadSiteId: item.websiteLeadSiteId } : {}),
    ...(item.websiteLeadSite?.siteId ? { siteId: item.websiteLeadSite.siteId } : {}),
    ...(item.websiteLeadSite?.siteName ? { siteName: item.websiteLeadSite.siteName } : {}),
    ...(item.websiteLeadSite?.brandTag ? { brandTag: item.websiteLeadSite.brandTag } : {}),
    ...(item.linkedLeadId ? { linkedLeadId: item.linkedLeadId } : {}),
    ...(item.linkedLead?.companyName ? { linkedLeadCompanyName: item.linkedLead.companyName } : {}),
    ...(item.linkedLead?.stage ? { linkedLeadStage: toLeadStageKey(item.linkedLead.stage) } : {}),
    ...(item.linkedLead?.lifecycleStatus
      ? { linkedLeadLifecycleStatus: toLeadLifecycleStatusKey(item.linkedLead.lifecycleStatus) }
      : {}),
    leadType: toWebsiteLeadTypeKey(item.leadType),
    outcome: toWebsiteLeadSubmissionOutcomeKey(item.outcome),
    reviewStatus: toWebsiteLeadSubmissionReviewStatusKey(item.reviewStatus),
    ...(item.reviewedByUserId ? { reviewedByUserId: item.reviewedByUserId } : {}),
    ...(item.reviewedBy?.displayName ? { reviewedByDisplayName: item.reviewedBy.displayName } : {}),
    ...(item.reviewedAt ? { reviewedAt: item.reviewedAt.toISOString() } : {}),
    ...(item.reviewNote ? { reviewNote: item.reviewNote } : {}),
    contactDisplayName: item.contactDisplayName,
    ...(item.companyName ? { companyName: item.companyName } : {}),
    ...(item.email ? { email: item.email } : {}),
    ...(item.phone ? { phone: item.phone } : {}),
    ...(item.state ? { state: item.state } : {}),
    ...(item.countryCode ? { countryCode: item.countryCode } : {}),
    ...(item.serviceTechCount !== null && item.serviceTechCount !== undefined ? { serviceTechCount: item.serviceTechCount } : {}),
    ...(item.installTechCount !== null && item.installTechCount !== undefined ? { installTechCount: item.installTechCount } : {}),
    ...(item.truckCount !== null && item.truckCount !== undefined ? { truckCount: item.truckCount } : {}),
    ...(item.salesPersonCount !== null && item.salesPersonCount !== undefined ? { salesPersonCount: item.salesPersonCount } : {}),
    ...(getJsonRecordNumber(item.payload, 'potentialValueCents') !== undefined
      ? { potentialValueCents: getJsonRecordNumber(item.payload, 'potentialValueCents') }
      : {}),
    ...(item.inquiryTopic ? { inquiryTopic: item.inquiryTopic } : {}),
    ...(item.referralSource ? { referralSource: item.referralSource } : {}),
    ...(item.referralDetail ? { referralDetail: item.referralDetail } : {}),
    createdAt: item.createdAt.toISOString(),
  };
}

function buildLeadInputFromWebsiteSubmission(submission: WebsiteLeadSubmissionWithRefs): LeadInputSource {
  const affinityGroupSelection = normalizeOptionalGroupAxisSelection(
    getJsonRecordString(submission.payload, 'affinityGroupSelection'),
    'affinityGroupSelection',
  );
  const ownershipGroupSelection = normalizeOptionalGroupAxisSelection(
    getJsonRecordString(submission.payload, 'ownershipGroupSelection'),
    'ownershipGroupSelection',
  );

  return {
    ...(submission.companyName ? { companyName: submission.companyName } : {}),
    ...(submission.contactFirstName ? { contactFirstName: submission.contactFirstName } : {}),
    ...(submission.contactLastName ? { contactLastName: submission.contactLastName } : {}),
    contactDisplayName: submission.contactDisplayName,
    ...(submission.email ? { email: submission.email } : {}),
    ...(submission.phone ? { phone: submission.phone } : {}),
    ...(submission.state ? { state: submission.state } : {}),
    ...(submission.countryCode ? { countryCode: submission.countryCode } : {}),
    businessSegmentCode: DEFAULT_BUSINESS_SEGMENT_CODE,
    leadSourceCode: DEFAULT_WEBSITE_LEAD_SOURCE_CODE,
    leadType: toWebsiteLeadTypeKey(submission.leadType),
    ...(submission.websiteLeadSite?.siteName ? { sourceDetail: submission.websiteLeadSite.siteName } : {}),
    ...(submission.websiteLeadSite?.siteId ? { sourceSiteId: submission.websiteLeadSite.siteId } : {}),
    ...(submission.websiteLeadSite?.siteName ? { sourceSiteName: submission.websiteLeadSite.siteName } : {}),
    ...(submission.websiteLeadSite?.brandTag ? { sourceBrandTag: submission.websiteLeadSite.brandTag } : {}),
    serviceTechCount: submission.serviceTechCount ?? 0,
    ...(submission.installTechCount !== null && submission.installTechCount !== undefined ? { installTechCount: submission.installTechCount } : {}),
    ...(submission.truckCount !== null && submission.truckCount !== undefined ? { truckCount: submission.truckCount } : {}),
    ...(submission.salesPersonCount !== null && submission.salesPersonCount !== undefined ? { salesPersonCount: submission.salesPersonCount } : {}),
    ...(getJsonRecordNumber(submission.payload, 'potentialValueCents') !== undefined
      ? { potentialValueCents: getJsonRecordNumber(submission.payload, 'potentialValueCents') }
      : {}),
    ...(affinityGroupSelection !== undefined ? { affinityGroupSelection } : {}),
    ...(getJsonRecordString(submission.payload, 'affinityGroupId') ? { affinityGroupId: getJsonRecordString(submission.payload, 'affinityGroupId') } : {}),
    ...(getJsonRecordString(submission.payload, 'affinityGroupCode') ? { affinityGroupCode: getJsonRecordString(submission.payload, 'affinityGroupCode') } : {}),
    ...(getJsonRecordString(submission.payload, 'affinityGroupName') ? { affinityGroupName: getJsonRecordString(submission.payload, 'affinityGroupName') } : {}),
    ...(ownershipGroupSelection !== undefined ? { ownershipGroupSelection } : {}),
    ...(getJsonRecordString(submission.payload, 'ownershipGroupId') ? { ownershipGroupId: getJsonRecordString(submission.payload, 'ownershipGroupId') } : {}),
    ...(getJsonRecordString(submission.payload, 'ownershipGroupCode') ? { ownershipGroupCode: getJsonRecordString(submission.payload, 'ownershipGroupCode') } : {}),
    ...(getJsonRecordString(submission.payload, 'ownershipGroupName') ? { ownershipGroupName: getJsonRecordString(submission.payload, 'ownershipGroupName') } : {}),
    ...(getJsonRecordString(submission.payload, 'campaign') ? { sourceCampaign: getJsonRecordString(submission.payload, 'campaign') } : {}),
    ...(submission.message ? { notes: submission.message } : {}),
  };
}

function buildWebsiteLeadSubmissionSourceMetadata(submission: WebsiteLeadSubmissionWithRefs) {
  const streetAddress = getJsonRecordString(submission.payload, 'streetAddress');
  const city = getJsonRecordString(submission.payload, 'city');
  const state = submission.state ?? getJsonRecordString(submission.payload, 'state');
  const postalCode = getJsonRecordString(submission.payload, 'postalCode');
  const countryCode = submission.countryCode ?? getJsonRecordString(submission.payload, 'countryCode');
  const customerStatus = getJsonRecordString(submission.payload, 'customerStatus');
  const payloadRecord = isRecord(submission.payload)
    ? (submission.payload as Record<string, unknown>)
    : null;
  const marketingConsent = payloadRecord && typeof payloadRecord.marketingConsent === 'boolean'
    ? payloadRecord.marketingConsent
    : undefined;

  return {
    captureChannel: 'branded_website',
    ...(submission.inquiryTopic ? { inquiryTopic: submission.inquiryTopic } : {}),
    ...(submission.referralSource ? { referralSource: submission.referralSource } : {}),
    ...(submission.referralDetail ? { referralDetail: submission.referralDetail } : {}),
    ...(customerStatus ? { customerStatus } : {}),
    ...(marketingConsent !== undefined ? { marketingConsent } : {}),
    ...(streetAddress || city || state || postalCode || countryCode
      ? {
          submittedAddress: {
            ...(streetAddress ? { line1: streetAddress } : {}),
            ...(city ? { city } : {}),
            ...(state ? { state } : {}),
            ...(postalCode ? { postalCode } : {}),
            ...(countryCode ? { countryCode } : {}),
          },
        }
      : {}),
  };
}

function toLeadHistoryFeedEntry(
  entry: Prisma.AuditEntryGetPayload<{
    include: {
      actor: {
        select: {
          id: true;
          email: true;
          displayName: true;
          roleCode: true;
        };
      };
    };
  }>,
  lead: LeadWithRefs,
): LeadHistoryFeedEntry | null {
  if (!entry.entityId) {
    return null;
  }

  const title = summarizeLeadHistoryTitle(entry.action, entry.beforeData, entry.afterData, entry.metadata);
  const summary = summarizeLeadHistoryDetail(entry.action, entry.beforeData, entry.afterData, entry.metadata);

  return {
    id: entry.id,
    leadId: entry.entityId,
    companyName: lead.companyName,
    contactDisplayName: lead.contactDisplayName,
    stage: toLeadStageKey(lead.stage),
    lifecycleStatus: toLeadLifecycleStatusKey(lead.lifecycleStatus),
    title,
    summary,
    occurredAt: entry.createdAt.toISOString(),
    ...(entry.actor ? { actor: toLeadHistoryFeedActor(entry.actor) } : {}),
  };
}

function toLeadHistoryFeedActor(actor: {
  id: string;
  displayName: string;
  email: string;
  roleCode: string;
}): LeadHistoryFeedActorSummary {
  return {
    userId: actor.id,
    displayName: actor.displayName,
    email: actor.email,
    role: normalizeRole(actor.roleCode),
  };
}

function summarizeLeadHistoryTitle(
  action: AuditAction,
  beforeData: Prisma.JsonValue | null,
  afterData: Prisma.JsonValue | null,
  metadata: Prisma.JsonValue | null,
) {
  const workflowAction = getJsonRecordString(metadata, 'workflowAction');
  const manualDuplicateResolution = getJsonRecord(metadata, 'manualDuplicateResolution');
  if (action === AuditAction.CREATE) {
    return manualDuplicateResolution ? 'Lead Created From Duplicate Override' : 'Lead Created';
  }

  const lifecycleStatus = getJsonRecordString(afterData, 'lifecycleStatus');
  const beforeStage = getJsonRecordString(beforeData, 'stage');
  const afterStage = getJsonRecordString(afterData, 'stage');

  switch (workflowAction) {
    case 'log_initial_contact':
      return 'Initial Contact Logged';
    case 'schedule_discovery':
      return 'Discovery Scheduled';
    case 'complete_discovery':
      return 'Discovery Completed';
    case 'skip_discovery':
      return 'Discovery Fast-Tracked';
    case 'duplicate_enrich_existing':
      return 'Lead Enriched From Duplicate Intake';
    case 'duplicate_use_existing':
      return 'Duplicate Intake Linked to Existing Record';
    case 'reopen_lead':
      return 'Lead Reopened';
    case 'update_lead_lifecycle':
      return lifecycleStatus === 'closed' ? 'Lead Closed' : 'Lead Parked';
    default:
      if (typeof afterStage === 'string' && afterStage !== beforeStage) {
        return `Stage Changed to ${toLeadStageLabel(toLeadStageEnum(afterStage as LeadStageKey))}`;
      }
      return 'Lead Updated';
  }
}

function summarizeLeadHistoryDetail(
  action: AuditAction,
  beforeData: Prisma.JsonValue | null,
  afterData: Prisma.JsonValue | null,
  metadata: Prisma.JsonValue | null,
) {
  const workflowAction = getJsonRecordString(metadata, 'workflowAction');
  const manualDuplicateResolution = getJsonRecord(metadata, 'manualDuplicateResolution');
  if (action === AuditAction.CREATE) {
    if (manualDuplicateResolution) {
      const reason = getJsonRecordString(manualDuplicateResolution, 'reason');
      const selectedCandidate = getJsonRecord(manualDuplicateResolution, 'selectedCandidate');
      const entityType = getJsonRecordString(selectedCandidate, 'entityType');
      const title = getJsonRecordString(selectedCandidate, 'title');
      const targetSummary = title
        ? ` Reviewed against existing ${entityType === 'account' ? 'customer account' : 'lead'} ${title}.`
        : '';
      return `${reason || 'Operator confirmed this duplicate candidate should create a separate lead.'}${targetSummary}`;
    }

    return 'Lead entered Pulse CRM and started the governed workflow.';
  }

  const note = getJsonRecordString(metadata, 'note')?.trim() ?? '';
  const reasonCode = getJsonRecordString(afterData, 'lifecycleReasonCode');
  const reasonNote = getJsonRecordString(afterData, 'lifecycleReasonNote');
  const beforeStage = getJsonRecordString(beforeData, 'stage');
  const afterStage = getJsonRecordString(afterData, 'stage');

  switch (workflowAction) {
    case 'log_initial_contact':
      return note || 'Initial outreach was logged against the lead.';
    case 'schedule_discovery':
      return note || 'Discovery was scheduled and the lead moved into the next workflow gate.';
    case 'complete_discovery':
      return note || 'Discovery details were captured and the lead was advanced.';
    case 'skip_discovery':
      return note || 'Discovery was intentionally fast-tracked with a recorded reason.';
    case 'duplicate_enrich_existing': {
      const duplicateResolution = getJsonRecord(metadata, 'duplicateResolution');
      const reason = getJsonRecordString(duplicateResolution, 'reason');
      const fields = getJsonRecordStringArray(duplicateResolution, 'enrichedFields');
      const fieldSummary = fields.length > 0 ? ` Fields added: ${fields.join(', ')}.` : '';
      return `${reason || 'Duplicate intake values were applied without overwriting existing lead data.'}${fieldSummary}`;
    }
    case 'duplicate_use_existing': {
      const duplicateResolution = getJsonRecord(metadata, 'duplicateResolution');
      const rowNumber = getJsonRecordNumber(duplicateResolution, 'rowNumber');
      const selectedCandidate = getJsonRecord(duplicateResolution, 'selectedCandidate');
      const title = getJsonRecordString(selectedCandidate, 'title');
      const entityType = getJsonRecordString(selectedCandidate, 'entityType');
      const rowSummary = rowNumber ? `Import row ${rowNumber}` : 'Duplicate import row';
      const targetSummary = title
        ? ` was linked to existing ${entityType === 'account' ? 'customer account' : 'lead'} ${title}.`
        : ' was linked to an existing record.';
      return `${rowSummary}${targetSummary}`;
    }
    case 'reopen_lead':
      return 'Lead was moved back into the active pipeline.';
    case 'update_lead_lifecycle':
      return formatLifecycleReason(reasonCode, reasonNote) ?? 'Lead lifecycle status changed.';
    default:
      if (typeof afterStage === 'string' && afterStage !== beforeStage) {
        return note || `Workflow advanced to ${toLeadStageLabel(toLeadStageEnum(afterStage as LeadStageKey))}.`;
      }
      return note || 'Lead details were updated in Pulse CRM.';
  }
}

function toWorkflowQueueComputation(lead: LeadWithWorkflowRefs, now: Date): WorkflowQueueComputation {
  return toWorkflowQueueComputationWithPolicy(lead, now, null);
}

function toWorkflowQueueComputationWithPolicy(
  lead: LeadWithWorkflowRefs,
  now: Date,
  policy: LeadRoutingPolicyRecord | null,
): WorkflowQueueComputation {
  const stageAnchorAt = getWorkflowStageAnchorAt(lead);
  const daysInStage = daysSinceStageAnchor(now, stageAnchorAt);
  const fallbackPolicy = policy ?? buildInMemoryLeadRoutingPolicy();
  const initialContactSla = getInitialContactSlaState(lead, now, fallbackPolicy);
  const discoverySchedulingSla = getDiscoverySchedulingSlaState(lead, now, fallbackPolicy);
  const cisFollowUpSla = getCisFollowUpSlaState(lead, now, fallbackPolicy);
  const task = buildWorkflowTask(lead, fallbackPolicy, initialContactSla, discoverySchedulingSla, cisFollowUpSla);
  const assignedTmName = lead.assignedTmUser?.displayName ?? lead.assignedTmName ?? undefined;
  const assignedRdName = lead.assignedRdUser?.displayName ?? undefined;

  return {
    item: {
      leadId: lead.id,
      companyName: lead.companyName,
      contactDisplayName: lead.contactDisplayName,
      leadSourceCode: lead.leadSource.code,
      leadSourceName: lead.leadSource.name,
      lifecycleStatus: toLeadLifecycleStatusKey(lead.lifecycleStatus),
      stage: toLeadStageKey(lead.stage),
      stageLabel: toLeadStageLabel(lead.stage),
      routingTeam: toLeadRoutingTeamKey(lead.routingTeam),
      nextAction: task.nextAction,
      actionType: task.actionType,
      urgency: task.urgency,
      colorToken: task.colorToken,
      reason: task.reason,
      daysInStage,
      slaRisk: (
        (!initialContactSla.hasInitialContact && (initialContactSla.overdue || initialContactSla.urgent))
        || discoverySchedulingSla.overdue
        || discoverySchedulingSla.urgent
        || cisFollowUpSla.overdue
        || cisFollowUpSla.reminderDue
      ),
      ...(lead.email ? { email: lead.email } : {}),
      ...(lead.phone ? { phone: lead.phone } : {}),
      ...(lead.state ? { state: lead.state } : {}),
      ...(lead.sourceSiteId ? { sourceSiteId: lead.sourceSiteId } : {}),
      ...(lead.sourceSiteName ? { sourceSiteName: lead.sourceSiteName } : {}),
      ...(lead.sourceBrandTag ? { sourceBrandTag: lead.sourceBrandTag } : {}),
      ...(lead.lifecycleChangedAt ? { lifecycleChangedAt: lead.lifecycleChangedAt.toISOString() } : {}),
      ...(lead.lifecycleReasonCode ? { lifecycleReasonCode: toLeadLifecycleReasonCodeKey(lead.lifecycleReasonCode) } : {}),
      ...(lead.lifecycleReasonNote ? { lifecycleReasonNote: lead.lifecycleReasonNote } : {}),
      ...(lead.leadOwnerName ? { leadOwnerName: lead.leadOwnerName } : {}),
      ...(lead.territoryId ? { territoryId: lead.territoryId } : {}),
      ...(lead.territory?.code ? { territoryCode: lead.territory.code } : {}),
      ...(lead.territory?.name ? { territoryName: lead.territory.name } : {}),
      ...(lead.territory?.regionId ? { regionId: lead.territory.regionId } : {}),
      ...(lead.territory?.region.code ? { regionCode: lead.territory.region.code } : {}),
      ...(lead.territory?.region.name ? { regionName: lead.territory.region.name } : {}),
      ...(lead.shippingCenterId ? { shippingCenterId: lead.shippingCenterId } : {}),
      ...(lead.shippingCenter?.code ? { shippingCenterCode: lead.shippingCenter.code } : {}),
      ...(lead.shippingCenter?.name ? { shippingCenterName: lead.shippingCenter.name } : {}),
      ...(lead.assignedTmUserId ? { assignedTmUserId: lead.assignedTmUserId } : {}),
      ...(assignedTmName ? { assignedTmName } : {}),
      ...(lead.assignedRdUserId ? { assignedRdUserId: lead.assignedRdUserId } : {}),
      ...(assignedRdName ? { assignedRdName } : {}),
      ...(lead.territoryAssignmentMethod
        ? { territoryAssignmentMethod: toLeadTerritoryAssignmentMethodKey(lead.territoryAssignmentMethod) }
        : {}),
      ...(lead.territoryAssignedAt ? { territoryAssignedAt: lead.territoryAssignedAt.toISOString() } : {}),
      ...(lead.initialContactDueAt ? { initialContactDueAt: lead.initialContactDueAt.toISOString() } : {}),
      ...((lead.stage === LeadStage.NEW || lead.initialContactDueAt) ? { hoursUntilInitialContactDue: initialContactSla.hoursUntilDue } : {}),
      ...(task.financeDecisionStatus ? { financeDecisionStatus: task.financeDecisionStatus } : {}),
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    },
    stageAnchorAt,
  };
}

function filterWorkflowQueueItems(
  items: LeadWorkflowQueueItem[],
  view: LeadWorkflowQueueViewKey | undefined,
  staleThresholdDays: number,
) {
  if (view === 'urgent') {
    return items.filter((item) => item.urgency === 'high');
  }
  if (view === 'stagnant') {
    return items.filter((item) => item.daysInStage > staleThresholdDays);
  }

  return items;
}

function summarizeWorkflowQueue(items: LeadWorkflowQueueItem[], staleThresholdDays: number): LeadWorkflowQueueSummary {
  return {
    openActionCount: items.length,
    urgentCount: items.filter((item) => item.urgency === 'high').length,
    stagnantCount: items.filter((item) => item.daysInStage > staleThresholdDays).length,
    slaRiskCount: items.filter((item) => item.slaRisk).length,
  };
}

// The minimal timestamp surface the stage anchor reads — lets non-lead callers (e.g. the reports
// dashboard aging rollup) pass a narrow select instead of a full LeadWithWorkflowRefs payload.
export interface LeadStageAnchorFields {
  lifecycleStatus: LeadLifecycleStatus;
  lifecycleChangedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  stage: LeadStage;
  discoveryScheduledAt: Date | null;
  discoveryCompletedAt: Date | null;
  cisSentAt: Date | null;
  cisSignedAt: Date | null;
  cisSubmittedAt: Date | null;
  onboardingCompletedAt: Date | null;
  firstOrderAt: Date | null;
}

export interface LeadStageAgingStats {
  avgDaysInStage: number;
  maxDaysInStage: number;
  staleCount: number;
}

function getWorkflowStageAnchorAt(lead: LeadStageAnchorFields) {
  if (lead.lifecycleStatus !== LeadLifecycleStatus.ACTIVE) {
    return lead.lifecycleChangedAt ?? lead.updatedAt;
  }

  switch (lead.stage) {
    case LeadStage.DISCOVERY_SCHEDULED:
      return lead.discoveryScheduledAt ?? lead.updatedAt;
    case LeadStage.DISCOVERY_COMPLETED:
      return lead.discoveryCompletedAt ?? lead.updatedAt;
    case LeadStage.CIS_SENT:
      return lead.cisSentAt ?? lead.updatedAt;
    case LeadStage.CIS_SIGNED:
      return lead.cisSignedAt ?? lead.cisSubmittedAt ?? lead.updatedAt;
    case LeadStage.ONBOARDING_COMPLETED:
      return lead.onboardingCompletedAt ?? lead.updatedAt;
    case LeadStage.CUSTOMER_ACTIVE:
      return lead.firstOrderAt ?? lead.updatedAt;
    case LeadStage.NEW:
    default:
      return lead.createdAt;
  }
}

// Whole days a lead has sat since its stage anchor. Shared by the workflow queue and the dashboard
// aging rollup so "days in stage" is identical across surfaces. Clamped at 0: for stages whose anchor
// is a scheduled/future milestone (e.g. DISCOVERY_SCHEDULED -> discoveryScheduledAt) this reads 0
// until the milestone passes rather than going negative.
function daysSinceStageAnchor(now: Date, anchorAt: Date): number {
  return Math.max(0, Math.floor((now.getTime() - anchorAt.getTime()) / (24 * 60 * 60 * 1000)));
}

// FR-RPT-022: per-stage aging for the lead dashboard. Aggregated server-side in a single GROUP BY so the
// cost is constant in returned rows regardless of how large the active pipeline grows (CUSTOMER_ACTIVE
// leads stay lifecycleStatus=ACTIVE and accumulate without bound). The per-stage entry anchor and the
// stale threshold (policy.stagnantStageDays) mirror the workflow queue's getWorkflowStageAnchorAt /
// daysSinceStageAnchor, so "days in stage" is consistent across surfaces — the SQL CASE below MUST stay
// in step with getWorkflowStageAnchorAt (ACTIVE branch). The record-scope predicate mirrors
// resolveLeadRecordScope via resolveLeadRecordScopeSql (parity-tested). No stageEnteredAt column needed.
export async function computeLeadStageAging(
  actor: AuthenticatedActor,
): Promise<Map<LeadStage, LeadStageAgingStats>> {
  const policy = await getRoutingPolicy(prisma);
  const scopeSql = await resolveLeadRecordScopeSql(actor);

  // Mirrors getWorkflowStageAnchorAt for ACTIVE leads (the only rows queried).
  const anchorSql = Prisma.sql`CASE l."stage"
        WHEN 'DISCOVERY_SCHEDULED' THEN COALESCE(l."discoveryScheduledAt", l."updatedAt")
        WHEN 'DISCOVERY_COMPLETED' THEN COALESCE(l."discoveryCompletedAt", l."updatedAt")
        WHEN 'CIS_SENT' THEN COALESCE(l."cisSentAt", l."updatedAt")
        WHEN 'CIS_SIGNED' THEN COALESCE(l."cisSignedAt", l."cisSubmittedAt", l."updatedAt")
        WHEN 'ONBOARDING_COMPLETED' THEN COALESCE(l."onboardingCompletedAt", l."updatedAt")
        WHEN 'CUSTOMER_ACTIVE' THEN COALESCE(l."firstOrderAt", l."updatedAt")
        ELSE l."createdAt"
      END`;

  // GREATEST(0, FLOOR(...)) matches daysSinceStageAnchor's clamp-at-0. DateTime columns are timestamp(3)
  // holding UTC, so compare against the current UTC wall-clock.
  const rows = await prisma.$queryRaw<Array<{ stage: LeadStage; avg_days: number; max_days: number; stale_count: number }>>(Prisma.sql`
    SELECT sub.stage AS stage,
      AVG(sub.days)::float8 AS avg_days,
      MAX(sub.days)::int AS max_days,
      COUNT(*) FILTER (WHERE sub.days > ${policy.stagnantStageDays})::int AS stale_count
    FROM (
      SELECT l."stage" AS stage,
        GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ((now() AT TIME ZONE 'UTC') - (${anchorSql}))) / 86400))::int AS days
      FROM "Lead" l
      LEFT JOIN "Territory" t ON t."id" = l."territoryId"
      LEFT JOIN "Region" r ON r."id" = t."regionId"
      WHERE l."lifecycleStatus" = 'ACTIVE' AND (${scopeSql})
    ) sub
    GROUP BY sub.stage
  `);

  const result = new Map<LeadStage, LeadStageAgingStats>();
  for (const row of rows) {
    result.set(row.stage, {
      avgDaysInStage: Math.round(row.avg_days),
      maxDaysInStage: row.max_days,
      staleCount: row.stale_count,
    });
  }
  return result;
}

function getInitialContactSlaState(
  lead: LeadWithWorkflowRefs,
  now: Date,
  policy: LeadRoutingPolicyRecord,
): InitialContactSlaState {
  const dueAt = lead.initialContactDueAt ?? addHours(lead.createdAt, policy.initialContactSlaHours);
  const hoursUntilDue = Math.floor((dueAt.getTime() - now.getTime()) / (60 * 60 * 1000));
  const hasInitialContact = Boolean(lead.initialContactedAt) || lead.stage !== LeadStage.NEW;

  return {
    dueAt,
    hoursUntilDue,
    hasInitialContact,
    overdue: !hasInitialContact && dueAt.getTime() < now.getTime(),
    urgent: !hasInitialContact && dueAt.getTime() >= now.getTime() && hoursUntilDue < policy.initialContactUrgentWindowHours,
  };
}

function getDiscoverySchedulingSlaState(
  lead: LeadWithWorkflowRefs,
  now: Date,
  policy: LeadRoutingPolicyRecord,
): DiscoverySchedulingSlaState {
  if (lead.stage !== LeadStage.NEW || !lead.initialContactedAt) {
    return {
      applicable: false,
      overdue: false,
      urgent: false,
    };
  }

  const dueAt = addHours(lead.initialContactedAt, policy.discoverySchedulingSlaHours);
  const hoursUntilDue = Math.floor((dueAt.getTime() - now.getTime()) / (60 * 60 * 1000));
  const urgentWindowHours = Math.max(1, Math.min(policy.initialContactUrgentWindowHours, policy.discoverySchedulingSlaHours));

  return {
    applicable: true,
    dueAt,
    hoursUntilDue,
    overdue: dueAt.getTime() < now.getTime(),
    urgent: dueAt.getTime() >= now.getTime() && hoursUntilDue < urgentWindowHours,
  };
}

function getCisFollowUpSlaState(
  lead: LeadWithWorkflowRefs,
  now: Date,
  policy: LeadRoutingPolicyRecord,
): CisFollowUpSlaState {
  if (lead.stage !== LeadStage.CIS_SENT || !lead.cisSentAt || lead.cisSubmittedAt) {
    return {
      applicable: false,
      overdue: false,
      reminderDue: false,
    };
  }

  const reminderAt = addBusinessDays(lead.cisSentAt, policy.cisFollowUpProspectReminderDelayBusinessDays);
  const dueAt = addBusinessDays(lead.cisSentAt, policy.cisFollowUpBusinessDays);
  const businessDaysUntilDue = diffBusinessDaysCeil(now, dueAt);

  return {
    applicable: true,
    dueAt,
    reminderAt,
    businessDaysUntilDue,
    overdue: dueAt.getTime() < now.getTime(),
    reminderDue: reminderAt.getTime() <= now.getTime() && dueAt.getTime() >= now.getTime(),
  };
}

function buildWorkflowTask(
  lead: LeadWithWorkflowRefs,
  policy: LeadRoutingPolicyRecord,
  initialContactSla: InitialContactSlaState,
  discoverySchedulingSla: DiscoverySchedulingSlaState,
  cisFollowUpSla: CisFollowUpSlaState,
): WorkflowTask {
  if (lead.lifecycleStatus === LeadLifecycleStatus.PARKED) {
    return {
      nextAction: 'Resume Lead',
      actionType: 'task',
      urgency: 'low',
      colorToken: 'gray',
      reason: buildLifecycleReasonLabel(lead, 'Lead is parked outside the active pipeline. Resume it when follow-up should restart.'),
    };
  }

  if (lead.lifecycleStatus === LeadLifecycleStatus.CLOSED) {
    return {
      nextAction: 'Reopen Lead',
      actionType: 'task',
      urgency: 'low',
      colorToken: 'dark',
      reason: buildLifecycleReasonLabel(lead, 'Lead is closed and retained for history. Reopen it if the opportunity becomes active again.'),
    };
  }

  if (!initialContactSla.hasInitialContact && initialContactSla.overdue) {
    return {
      nextAction: 'Make Initial Contact',
      actionType: 'call',
      urgency: 'high',
      colorToken: 'red',
      reason: `${policy.initialContactSlaHours}-hour initial contact SLA is overdue. Immediate outreach is required.`,
    };
  }

  if (!initialContactSla.hasInitialContact && initialContactSla.urgent) {
    return {
      nextAction: 'Make Initial Contact',
      actionType: 'call',
      urgency: 'high',
      colorToken: 'orange',
      reason: `${Math.max(initialContactSla.hoursUntilDue, 0)} hours remain in the ${policy.initialContactSlaHours}-hour initial contact SLA.`,
    };
  }

  switch (lead.stage) {
    case LeadStage.NEW:
      if (!initialContactSla.hasInitialContact) {
        return {
          nextAction: 'Make Initial Contact',
          actionType: 'call',
          urgency: 'high',
          colorToken: 'blue',
          reason: 'New lead is waiting for the first outreach before discovery can be scheduled.',
        };
      }

      if (discoverySchedulingSla.overdue) {
        return {
          nextAction: 'Schedule Discovery Call',
          actionType: 'call',
          urgency: 'high',
          colorToken: 'red',
          reason: `Discovery scheduling is overdue. The lead has been waiting more than ${policy.discoverySchedulingSlaHours} hours since initial contact.`,
        };
      }

      if (discoverySchedulingSla.urgent) {
        return {
          nextAction: 'Schedule Discovery Call',
          actionType: 'call',
          urgency: 'medium',
          colorToken: 'orange',
          reason: `Discovery should be scheduled within ${Math.max(discoverySchedulingSla.hoursUntilDue ?? 0, 0)} hours to stay inside policy.`,
        };
      }

      return {
        nextAction: 'Schedule Discovery Call',
        actionType: 'call',
        urgency: 'medium',
        colorToken: 'blue',
        reason: `Initial contact is recorded. Discovery should be scheduled within ${policy.discoverySchedulingSlaHours} hours.`,
      };
    case LeadStage.DISCOVERY_SCHEDULED:
      return {
        nextAction: 'Complete Discovery',
        actionType: 'task',
        urgency: 'medium',
        colorToken: 'indigo',
        reason: 'Discovery is scheduled. Capture the discovery outcome to unlock CIS.',
      };
    case LeadStage.DISCOVERY_COMPLETED:
      return {
        nextAction: 'Send CIS Link',
        actionType: 'email',
        urgency: 'high',
        colorToken: 'teal',
        reason: 'Discovery is complete. The CIS package is the next required workflow step.',
      };
    case LeadStage.CIS_SENT:
      if (lead.cisSubmittedAt) {
        return {
          nextAction: 'Review Returned CIS',
          actionType: 'task',
          urgency: 'high',
          colorToken: 'grape',
          reason: 'The prospect submitted the CIS package. Internal review and sign-off should happen before finance handoff.',
        };
      }

      if (cisFollowUpSla.overdue) {
        return {
          nextAction: 'Follow Up CIS',
          actionType: 'call',
          urgency: 'high',
          colorToken: 'red',
          reason: `CIS follow-up is overdue. The package has been out for more than ${policy.cisFollowUpBusinessDays} business days.`,
        };
      }

      if (cisFollowUpSla.reminderDue) {
        return {
          nextAction: 'Follow Up CIS',
          actionType: 'call',
          urgency: 'medium',
          colorToken: 'orange',
          reason: `The CIS follow-up reminder window is open after ${policy.cisFollowUpProspectReminderDelayBusinessDays} business days.`,
        };
      }

      return {
        nextAction: 'Follow Up CIS',
        actionType: 'call',
        urgency: 'medium',
        colorToken: 'cyan',
        reason: `CIS was sent and is still awaiting submission. Pulse will flag it once the ${policy.cisFollowUpBusinessDays}-business-day follow-up window is reached.`,
      };
    case LeadStage.CIS_SIGNED:
      return buildPostCisSignedWorkflowTask(lead);
    case LeadStage.ONBOARDING_COMPLETED:
      return {
        nextAction: 'Secure First Order',
        actionType: 'call',
        urgency: 'high',
        colorToken: 'green',
        reason: 'Onboarding is complete. First-order activation is the final lead milestone.',
      };
    case LeadStage.CUSTOMER_ACTIVE:
    default:
      return {
        nextAction: 'Review Lead',
        actionType: 'task',
        urgency: 'low',
        colorToken: 'gray',
        reason: 'Review the lead record and confirm the next workflow action.',
      };
  }
}

function buildPostCisSignedWorkflowTask(lead: LeadWithWorkflowRefs): WorkflowTask {
  const latestCisPackage = lead.cisPackages[0];
  const financeDecisionStatus = toWorkflowFinanceDecisionStatus(latestCisPackage?.financeDecision?.status);

  switch (financeDecisionStatus) {
    case 'pending':
      return {
        nextAction: 'Track Finance Decision',
        actionType: 'task',
        urgency: 'medium',
        colorToken: 'yellow',
        reason: 'Finance review is in progress. Monitor the decision outcome before onboarding can continue.',
        financeDecisionStatus,
      };
    case 'info_requested':
      return {
        nextAction: 'Resolve Finance Info Request',
        actionType: 'task',
        urgency: 'high',
        colorToken: 'orange',
        reason: 'Finance requested more information. Resolve the open package questions before resubmission.',
        financeDecisionStatus,
      };
    case 'declined':
      return {
        nextAction: 'Resolve Credit Decline',
        actionType: 'call',
        urgency: 'high',
        colorToken: 'red',
        reason: 'Finance declined open credit. Realign on terms or alternate payment handling before setup can continue.',
        financeDecisionStatus,
      };
    case 'approved':
    case 'conditional':
      return {
        nextAction: 'Complete Onboarding',
        actionType: 'task',
        urgency: 'high',
        colorToken: 'green',
        reason: 'Finance approved the package. Portal setup and onboarding are the next required steps.',
        financeDecisionStatus,
      };
    case 'not_submitted':
    default:
      return {
        nextAction: 'Submit for Credit Approval',
        actionType: 'task',
        urgency: 'high',
        colorToken: 'orange',
        reason: 'Signed CIS is complete. Finance submission is the next required gate before onboarding.',
        financeDecisionStatus,
      };
  }
}

function getWorkflowUrgencyWeight(urgency: LeadWorkflowUrgencyKey) {
  switch (urgency) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
    default:
      return 1;
  }
}

function toLeadStageLabel(stage: LeadStage) {
  switch (stage) {
    case LeadStage.NEW:
      return 'New Lead';
    case LeadStage.DISCOVERY_SCHEDULED:
      return 'Discovery Scheduled';
    case LeadStage.DISCOVERY_COMPLETED:
      return 'Discovery Completed';
    case LeadStage.CIS_SENT:
      return 'CIS Sent';
    case LeadStage.CIS_SIGNED:
      return 'CIS Signed';
    case LeadStage.ONBOARDING_COMPLETED:
      return 'Onboarding Completed';
    case LeadStage.CUSTOMER_ACTIVE:
      return 'Customer Active';
  }
}

function toWorkflowFinanceDecisionStatus(
  status: CisFinanceDecisionStatus | null | undefined,
): NonNullable<LeadWorkflowQueueItem['financeDecisionStatus']> {
  switch (status) {
    case CisFinanceDecisionStatus.PENDING:
      return 'pending';
    case CisFinanceDecisionStatus.INFO_REQUESTED:
      return 'info_requested';
    case CisFinanceDecisionStatus.APPROVED:
      return 'approved';
    case CisFinanceDecisionStatus.CONDITIONAL:
      return 'conditional';
    case CisFinanceDecisionStatus.DECLINED:
      return 'declined';
    case CisFinanceDecisionStatus.NOT_SUBMITTED:
    default:
      return 'not_submitted';
  }
}

function toLeadSummary(lead: LeadWithRefs): LeadSummary {
  const initialContactDueAt = lead.initialContactDueAt?.toISOString();
  const lifecycleChangedAt = lead.lifecycleChangedAt?.toISOString();
  const territoryAssignedAt = lead.territoryAssignedAt?.toISOString();
  const assignedTmName = lead.assignedTmUser?.displayName ?? lead.assignedTmName ?? undefined;
  const assignedRdName = lead.assignedRdUser?.displayName ?? undefined;

  return {
    id: lead.id,
    companyName: lead.companyName,
    contactDisplayName: lead.contactDisplayName,
    businessSegmentCode: lead.businessSegment.code,
    leadSourceCode: lead.leadSource.code,
    leadSourceName: lead.leadSource.name,
    leadCaptureMethod: toLeadCaptureMethodKey(lead.leadCaptureMethod),
    ...(lead.leadType ? { leadType: toWebsiteLeadTypeKey(lead.leadType) } : {}),
    serviceTechCount: lead.serviceTechCount,
    stage: toLeadStageKey(lead.stage),
    routingBasis: toLeadRoutingBasisKey(lead.routingBasisSnapshot),
    routingThreshold: lead.routingThresholdSnapshot,
    routingTeam: toLeadRoutingTeamKey(lead.routingTeam),
    ...(lead.email ? { email: lead.email } : {}),
    ...(lead.phone ? { phone: lead.phone } : {}),
    ...(lead.state ? { state: lead.state } : {}),
    ...(lead.countryCode ? { countryCode: lead.countryCode } : {}),
    ...(lead.sourceDetail ? { sourceDetail: lead.sourceDetail } : {}),
    ...(lead.sourceSiteId ? { sourceSiteId: lead.sourceSiteId } : {}),
    ...(lead.sourceSiteName ? { sourceSiteName: lead.sourceSiteName } : {}),
    ...(lead.sourceBrandTag ? { sourceBrandTag: lead.sourceBrandTag } : {}),
    ...(lead.leadRating ? { leadRating: lead.leadRating } : {}),
    ...(lead.installTechCount !== null && lead.installTechCount !== undefined ? { installTechCount: lead.installTechCount } : {}),
    ...(lead.truckCount !== null && lead.truckCount !== undefined ? { truckCount: lead.truckCount } : {}),
    ...(lead.salesPersonCount !== null && lead.salesPersonCount !== undefined ? { salesPersonCount: lead.salesPersonCount } : {}),
    ...(lead.potentialValueCents !== null && lead.potentialValueCents !== undefined ? { potentialValueCents: lead.potentialValueCents } : {}),
    affinityGroupSelection: toGroupAxisSelectionKey(lead.affinityGroupSelection),
    ...(lead.affinityGroupId ? { affinityGroupId: lead.affinityGroupId } : {}),
    ...(lead.affinityGroup?.code ? { affinityGroupCode: lead.affinityGroup.code } : {}),
    lifecycleStatus: toLeadLifecycleStatusKey(lead.lifecycleStatus),
    ...(lifecycleChangedAt ? { lifecycleChangedAt } : {}),
    ...(lead.lifecycleReasonCode ? { lifecycleReasonCode: toLeadLifecycleReasonCodeKey(lead.lifecycleReasonCode) } : {}),
    ...(lead.lifecycleReasonNote ? { lifecycleReasonNote: lead.lifecycleReasonNote } : {}),
    ...(lead.affinityGroup?.name ? { affinityGroupName: lead.affinityGroup.name } : {}),
    ownershipGroupSelection: toGroupAxisSelectionKey(lead.ownershipGroupSelection),
    ...(lead.ownershipGroupId ? { ownershipGroupId: lead.ownershipGroupId } : {}),
    ...(lead.ownershipGroup?.code ? { ownershipGroupCode: lead.ownershipGroup.code } : {}),
    ...(lead.ownershipGroup?.name ? { ownershipGroupName: lead.ownershipGroup.name } : {}),
    ...(lead.groupClassification ? { groupClassification: toGroupClassificationKey(lead.groupClassification) } : {}),
    ...(lead.privateLabelName ? { privateLabelName: lead.privateLabelName } : {}),
    ...(lead.leadOwnerName ? { leadOwnerName: lead.leadOwnerName } : {}),
    ...(lead.territoryId ? { territoryId: lead.territoryId } : {}),
    ...(lead.territory?.code ? { territoryCode: lead.territory.code } : {}),
    ...(lead.territory?.name ? { territoryName: lead.territory.name } : {}),
    ...(lead.territory?.regionId ? { regionId: lead.territory.regionId } : {}),
    ...(lead.territory?.region.code ? { regionCode: lead.territory.region.code } : {}),
    ...(lead.territory?.region.name ? { regionName: lead.territory.region.name } : {}),
    ...(lead.shippingCenterId ? { shippingCenterId: lead.shippingCenterId } : {}),
    ...(lead.shippingCenter?.code ? { shippingCenterCode: lead.shippingCenter.code } : {}),
    ...(lead.shippingCenter?.name ? { shippingCenterName: lead.shippingCenter.name } : {}),
    ...(lead.assignedTmUserId ? { assignedTmUserId: lead.assignedTmUserId } : {}),
    ...(assignedTmName ? { assignedTmName } : {}),
    ...(lead.assignedRdUserId ? { assignedRdUserId: lead.assignedRdUserId } : {}),
    ...(assignedRdName ? { assignedRdName } : {}),
    ...(lead.territoryAssignmentMethod
      ? { territoryAssignmentMethod: toLeadTerritoryAssignmentMethodKey(lead.territoryAssignmentMethod) }
      : {}),
    ...(territoryAssignedAt ? { territoryAssignedAt } : {}),
    ...(initialContactDueAt ? { initialContactDueAt } : {}),
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

function toLeadSummaryWithWorkflowTask(lead: LeadWithWorkflowRefs, policy: LeadRoutingPolicyRecord): LeadSummary {
  const now = new Date();
  const initialContactSla = getInitialContactSlaState(lead, now, policy);
  const discoverySchedulingSla = getDiscoverySchedulingSlaState(lead, now, policy);
  const cisFollowUpSla = getCisFollowUpSlaState(lead, now, policy);
  const workflowTask = buildWorkflowTask(lead, policy, initialContactSla, discoverySchedulingSla, cisFollowUpSla);

  return {
    ...toLeadSummary(lead),
    workflowTask: toLeadWorkflowTaskSummary(workflowTask),
  };
}

function toLeadDetail(lead: LeadWithDetailRefs, policy: LeadRoutingPolicyRecord): LeadDetail {
  const initialContactedAt = lead.initialContactedAt?.toISOString();
  const discoveryScheduledAt = lead.discoveryScheduledAt?.toISOString();
  const discoveryCompletedAt = lead.discoveryCompletedAt?.toISOString();
  const cisSentAt = lead.cisSentAt?.toISOString();
  const cisSubmittedAt = lead.cisSubmittedAt?.toISOString();
  const cisSignedAt = lead.cisSignedAt?.toISOString();
  const onboardingCompletedAt = lead.onboardingCompletedAt?.toISOString();
  const firstOrderAt = lead.firstOrderAt?.toISOString();
  const now = new Date();
  const initialContactSla = getInitialContactSlaState(lead, now, policy);
  const discoverySchedulingSla = getDiscoverySchedulingSlaState(lead, now, policy);
  const cisFollowUpSla = getCisFollowUpSlaState(lead, now, policy);
  const workflowTask = buildWorkflowTask(lead, policy, initialContactSla, discoverySchedulingSla, cisFollowUpSla);

  return {
    ...toLeadSummary(lead),
    ...(lead.contactFirstName ? { contactFirstName: lead.contactFirstName } : {}),
    ...(lead.contactLastName ? { contactLastName: lead.contactLastName } : {}),
    ...(lead.sourceCampaign ? { sourceCampaign: lead.sourceCampaign } : {}),
    ...(lead.leadRating ? { leadRating: lead.leadRating } : {}),
    ...(lead.notes ? { notes: lead.notes } : {}),
    ...(initialContactedAt ? { initialContactedAt } : {}),
    ...(lead.discoveryCallSkipped ? { discoveryCallSkipped: lead.discoveryCallSkipped } : {}),
    ...(discoveryScheduledAt ? { discoveryScheduledAt } : {}),
    ...(discoveryCompletedAt ? { discoveryCompletedAt } : {}),
    ...(lead.discoveryPainPoints.length > 0 ? { discoveryPainPoints: lead.discoveryPainPoints } : {}),
    ...(lead.discoveryCurrentIaqSetup ? { discoveryCurrentIaqSetup: lead.discoveryCurrentIaqSetup } : {}),
    ...(lead.discoveryDecisionMaker ? { discoveryDecisionMaker: lead.discoveryDecisionMaker } : {}),
    ...(lead.discoveryBuyingIntent ? { discoveryBuyingIntent: lead.discoveryBuyingIntent } : {}),
    ...(lead.consignmentInterestStatus ? { consignmentInterestStatus: toLeadConsignmentInterestStatusKey(lead.consignmentInterestStatus) } : {}),
    ...(lead.consignmentEntryTiming ? { consignmentEntryTiming: toLeadConsignmentEntryTimingKey(lead.consignmentEntryTiming) } : {}),
    ...(lead.discoveryFastTrackReason ? { discoveryFastTrackReason: lead.discoveryFastTrackReason } : {}),
    ...(lead.discoverySummary ? { discoverySummary: lead.discoverySummary } : {}),
    ...(cisSentAt ? { cisSentAt } : {}),
    ...(cisSubmittedAt ? { cisSubmittedAt } : {}),
    ...(cisSignedAt ? { cisSignedAt } : {}),
    ...(onboardingCompletedAt ? { onboardingCompletedAt } : {}),
    ...(firstOrderAt ? { firstOrderAt } : {}),
    workflowTask: toLeadWorkflowTaskSummary(workflowTask),
    stageHistory: lead.stageEvents.map(toLeadStageEventSummary),
    fieldActivity: lead.mobileVoiceNotes.map((note) => ({
      id: note.id,
      title: note.title,
      summary: note.structuredSummary ?? note.rawTranscript ?? 'Reviewed field note.',
      tags: note.structuredTags,
      occurredAt: (note.reviewedAt ?? note.recordedAt).toISOString(),
      ...(note.structuredNextStep ? { nextStep: note.structuredNextStep } : {}),
      ...(note.structuredSentiment ? { sentiment: note.structuredSentiment } : {}),
      ...(note.createdBy ? { capturedByName: note.createdBy.displayName || note.createdBy.email } : {}),
      ...(note.reviewedBy ? { reviewedByName: note.reviewedBy.displayName || note.reviewedBy.email } : {}),
    })),
  };
}

function toLeadStageEventSummary(event: Prisma.LeadStageEventGetPayload<{}>): LeadStageEventSummary {
  return {
    id: event.id,
    toStage: toLeadStageKey(event.toStage),
    ...(event.fromStage ? { fromStage: toLeadStageKey(event.fromStage) } : {}),
    ...(event.note ? { note: event.note } : {}),
    ...(event.actorUserId ? { actorUserId: event.actorUserId } : {}),
    occurredAt: event.occurredAt.toISOString(),
  };
}

function toLeadRoutingPolicySummary(policy: Prisma.LeadRoutingPolicyGetPayload<{}>): LeadRoutingPolicySummary {
  return {
    routingBasis: toLeadRoutingBasisKey(policy.routingBasis),
    strategicGrowthMax: policy.strategicGrowthMax,
    nationalTmMin: policy.strategicGrowthMax + 1,
    initialContactSlaHours: policy.initialContactSlaHours,
    initialContactUrgentWindowHours: policy.initialContactUrgentWindowHours,
    initialContactManagerEscalationDelayHours: policy.initialContactManagerEscalationDelayHours,
    initialContactLeadershipEscalationDelayHours: policy.initialContactLeadershipEscalationDelayHours,
    discoverySchedulingSlaHours: policy.discoverySchedulingSlaHours,
    discoverySchedulingManagerEscalationDelayHours: policy.discoverySchedulingManagerEscalationDelayHours,
    cisFollowUpBusinessDays: policy.cisFollowUpBusinessDays,
    cisFollowUpProspectReminderDelayBusinessDays: policy.cisFollowUpProspectReminderDelayBusinessDays,
    cisFollowUpOwnerAlertDelayBusinessDays: policy.cisFollowUpOwnerAlertDelayBusinessDays,
    stagnantStageDays: policy.stagnantStageDays,
    operationalAlertQuietHours: toLeadOperationalAlertQuietHoursPolicy(policy),
    ...(policy.notes ? { notes: policy.notes } : {}),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

function toLeadOperationalAlertQuietHoursPolicy(policy: Pick<
  Prisma.LeadRoutingPolicyGetPayload<{}>,
  | 'operationalAlertQuietHoursEnabled'
  | 'operationalAlertQuietHoursStartLocal'
  | 'operationalAlertQuietHoursEndLocal'
  | 'operationalAlertQuietHoursTimeZone'
>) {
  return {
    enabled: policy.operationalAlertQuietHoursEnabled,
    startLocal: policy.operationalAlertQuietHoursStartLocal,
    endLocal: policy.operationalAlertQuietHoursEndLocal,
    timeZone: policy.operationalAlertQuietHoursTimeZone,
  };
}

function normalizeLeadOperationalAlertQuietHours(
  input: UpdateLeadOperationalAlertQuietHoursRequest,
  current: ReturnType<typeof toLeadOperationalAlertQuietHoursPolicy>,
) {
  return {
    enabled: input.enabled ?? current.enabled,
    startLocal: input.startLocal !== undefined
      ? normalizeLeadOperationalAlertQuietTime(input.startLocal, 'startLocal')
      : current.startLocal,
    endLocal: input.endLocal !== undefined
      ? normalizeLeadOperationalAlertQuietTime(input.endLocal, 'endLocal')
      : current.endLocal,
    timeZone: input.timeZone !== undefined
      ? requiredTrimmed(input.timeZone, 'timeZone')
      : current.timeZone,
  };
}

function normalizeLeadOperationalAlertQuietTime(value: string, fieldName: string) {
  const normalized = requiredTrimmed(value, fieldName);
  if (!/^\d{2}:\d{2}$/.test(normalized)) {
    throw new Error(`${fieldName} must use HH:mm format`);
  }

  const [hours = 0, minutes = 0] = normalized.split(':').map(Number);
  if (hours > 23 || minutes > 59) {
    throw new Error(`${fieldName} must be a valid local time`);
  }

  return normalized;
}

function toLeadOperationalAlertRecipientSummary(
  recipient: Prisma.LeadOperationalAlertRecipientGetPayload<{}>,
): LeadOperationalAlertRecipientSummary {
  return {
    id: recipient.id,
    code: recipient.code,
    routingTeam: toLeadRoutingTeamKey(recipient.routingTeam),
    name: recipient.name,
    ...(recipient.email ? { email: recipient.email } : {}),
    ...(recipient.roleTitle ? { roleTitle: recipient.roleTitle } : {}),
    isActive: recipient.isActive,
    sortOrder: recipient.sortOrder,
    updatedAt: recipient.updatedAt.toISOString(),
  };
}

function toLeadOperationalAlertRecipientAuditData(
  recipient: Prisma.LeadOperationalAlertRecipientGetPayload<{}>,
) {
  return {
    code: recipient.code,
    routingTeam: toLeadRoutingTeamKey(recipient.routingTeam),
    name: recipient.name,
    email: recipient.email ?? undefined,
    roleTitle: recipient.roleTitle ?? undefined,
    isActive: recipient.isActive,
    sortOrder: recipient.sortOrder,
  };
}

function toLeadTerritoryAssignmentMethodKey(value: TerritoryAssignmentMethod): TerritoryAssignmentMethodKey {
  switch (value) {
    case TerritoryAssignmentMethod.DEFAULT_STATE:
      return 'default_state';
    case TerritoryAssignmentMethod.MANUAL_OVERRIDE:
      return 'manual_override';
    case TerritoryAssignmentMethod.SYSTEM:
      return 'system';
  }
}

function toLeadStageKey(stage: LeadStage): LeadStageKey {
  switch (stage) {
    case LeadStage.NEW:
      return 'new';
    case LeadStage.DISCOVERY_SCHEDULED:
      return 'discovery_scheduled';
    case LeadStage.DISCOVERY_COMPLETED:
      return 'discovery_completed';
    case LeadStage.CIS_SENT:
      return 'cis_sent';
    case LeadStage.CIS_SIGNED:
      return 'cis_signed';
    case LeadStage.ONBOARDING_COMPLETED:
      return 'onboarding_completed';
    case LeadStage.CUSTOMER_ACTIVE:
      return 'customer_active';
  }
}

function toLeadStageEnum(stage: LeadStageKey): LeadStage {
  switch (stage) {
    case 'new':
      return LeadStage.NEW;
    case 'discovery_scheduled':
      return LeadStage.DISCOVERY_SCHEDULED;
    case 'discovery_completed':
      return LeadStage.DISCOVERY_COMPLETED;
    case 'cis_sent':
      return LeadStage.CIS_SENT;
    case 'cis_signed':
      return LeadStage.CIS_SIGNED;
    case 'onboarding_completed':
      return LeadStage.ONBOARDING_COMPLETED;
    case 'customer_active':
      return LeadStage.CUSTOMER_ACTIVE;
  }
}

function toLeadLifecycleStatusKey(status: LeadLifecycleStatus): LeadLifecycleStatusKey {
  switch (status) {
    case LeadLifecycleStatus.ACTIVE:
      return 'active';
    case LeadLifecycleStatus.PARKED:
      return 'parked';
    case LeadLifecycleStatus.CLOSED:
      return 'closed';
    default:
      throw new Error(`Unsupported lead lifecycle status: ${String(status)}`);
  }
}

function toLeadLifecycleStatusEnum(status: LeadLifecycleStatusKey): LeadLifecycleStatus {
  switch (status) {
    case 'active':
      return LeadLifecycleStatus.ACTIVE;
    case 'parked':
      return LeadLifecycleStatus.PARKED;
    case 'closed':
      return LeadLifecycleStatus.CLOSED;
    default:
      throw new Error(`Unsupported lead lifecycle status: ${status}`);
  }
}

function toLeadLifecycleReasonCodeKey(value: string): LeadLifecycleReasonCodeKey {
  if (!LEAD_LIFECYCLE_REASON_CODES.has(value as LeadLifecycleReasonCodeKey)) {
    throw new Error(`Unknown lead lifecycle reason code: ${value}`);
  }

  return value as LeadLifecycleReasonCodeKey;
}

function normalizeLeadLifecycleReasonCode(value: LeadLifecycleReasonCodeKey | undefined): LeadLifecycleReasonCodeKey | undefined {
  const normalized = optionalTrimmed(value);
  if (!normalized) {
    return undefined;
  }

  const code = normalizeCode(normalized);
  if (!LEAD_LIFECYCLE_REASON_CODES.has(code as LeadLifecycleReasonCodeKey)) {
    throw new Error(`Unsupported lead lifecycle reason code: ${normalized}`);
  }

  return code as LeadLifecycleReasonCodeKey;
}

function buildLifecycleReasonLabel(
  lead: { lifecycleReasonCode?: string | null; lifecycleReasonNote?: string | null },
  fallback: string,
) {
  if (!lead.lifecycleReasonCode) {
    return fallback;
  }

  const label = lead.lifecycleReasonCode
    .split('_')
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join(' ');

  return lead.lifecycleReasonNote
    ? `${label}: ${lead.lifecycleReasonNote}`
    : label;
}

function toLeadRoutingBasisKey(basis: LeadRoutingBasis): LeadRoutingBasisKey {
  switch (basis) {
    case LeadRoutingBasis.SERVICE_TECH_COUNT:
      return 'service_tech_count';
    case LeadRoutingBasis.TRUCK_COUNT:
      return 'truck_count';
  }
}

function toLeadRoutingBasisEnum(basis: LeadRoutingBasisKey): LeadRoutingBasis {
  switch (basis) {
    case 'service_tech_count':
      return LeadRoutingBasis.SERVICE_TECH_COUNT;
    case 'truck_count':
      return LeadRoutingBasis.TRUCK_COUNT;
  }
}

function toLeadRoutingTeamKey(team: LeadRoutingTeam): LeadRoutingTeamKey {
  switch (team) {
    case LeadRoutingTeam.STRATEGIC_GROWTH:
      return 'strategic_growth';
    case LeadRoutingTeam.NATIONAL_TM:
      return 'national_tm';
  }
}

function toLeadRoutingTeamEnum(team: LeadRoutingTeamKey): LeadRoutingTeam {
  switch (team) {
    case 'strategic_growth':
      return LeadRoutingTeam.STRATEGIC_GROWTH;
    case 'national_tm':
      return LeadRoutingTeam.NATIONAL_TM;
  }
}

function toLeadConsignmentInterestStatusKey(
  status: LeadConsignmentInterestStatus,
): LeadConsignmentInterestStatusKey {
  switch (status) {
    case LeadConsignmentInterestStatus.NOT_DISCUSSED:
      return 'not_discussed';
    case LeadConsignmentInterestStatus.INTERESTED:
      return 'interested';
    case LeadConsignmentInterestStatus.APPROVED:
      return 'approved';
    case LeadConsignmentInterestStatus.DECLINED:
      return 'declined';
  }
}

function toLeadConsignmentInterestStatusEnum(
  status: LeadConsignmentInterestStatusKey,
): LeadConsignmentInterestStatus {
  switch (status) {
    case 'not_discussed':
      return LeadConsignmentInterestStatus.NOT_DISCUSSED;
    case 'interested':
      return LeadConsignmentInterestStatus.INTERESTED;
    case 'approved':
      return LeadConsignmentInterestStatus.APPROVED;
    case 'declined':
      return LeadConsignmentInterestStatus.DECLINED;
  }
}

function toLeadConsignmentEntryTimingKey(
  value: LeadConsignmentEntryTiming,
): LeadConsignmentEntryTimingKey {
  switch (value) {
    case LeadConsignmentEntryTiming.AT_ONBOARDING:
      return 'at_onboarding';
    case LeadConsignmentEntryTiming.LATER:
      return 'later';
  }
}

function toLeadConsignmentEntryTimingEnum(
  value: LeadConsignmentEntryTimingKey,
): LeadConsignmentEntryTiming {
  switch (value) {
    case 'at_onboarding':
      return LeadConsignmentEntryTiming.AT_ONBOARDING;
    case 'later':
      return LeadConsignmentEntryTiming.LATER;
  }
}

function toLeadWorkflowTaskSummary(task: WorkflowTask): LeadWorkflowTaskSummary {
  return {
    nextAction: task.nextAction,
    actionType: task.actionType,
    urgency: task.urgency,
    colorToken: task.colorToken,
    reason: task.reason,
    ...(task.financeDecisionStatus ? { financeDecisionStatus: task.financeDecisionStatus } : {}),
  };
}

function toLeadCaptureMethodKey(method: LeadCaptureMethod) {
  switch (method) {
    case LeadCaptureMethod.DIRECT_WEB_FORM:
      return 'direct_web_form';
    case LeadCaptureMethod.MANUAL_ENTRY:
      return 'manual_entry';
    case LeadCaptureMethod.BULK_IMPORT:
      return 'bulk_import';
    case LeadCaptureMethod.LEGACY_IMPORT:
      return 'legacy_import';
  }
}

function toWebsiteLeadTypeKey(value: WebsiteLeadType): WebsiteLeadTypeKey {
  switch (value) {
    case WebsiteLeadType.HOMEOWNER:
      return 'homeowner';
    case WebsiteLeadType.CONTRACTOR:
      return 'contractor';
  }
}

function toWebsiteLeadTypeEnum(value: string) {
  switch (value) {
    case 'homeowner':
      return WebsiteLeadType.HOMEOWNER;
    case 'contractor':
      return WebsiteLeadType.CONTRACTOR;
    default:
      throw new Error(`Unknown website lead type: ${value}`);
  }
}

function toWebsiteLeadSubmissionOutcomeKey(value: WebsiteLeadSubmissionOutcome) {
  switch (value) {
    case WebsiteLeadSubmissionOutcome.CREATED_NEW_LEAD:
      return 'created_new_lead';
    case WebsiteLeadSubmissionOutcome.ATTACHED_TO_EXISTING_LEAD:
      return 'attached_to_existing_lead';
  }
}

function toWebsiteLeadSubmissionReviewStatusKey(value: WebsiteLeadSubmissionReviewStatus) {
  switch (value) {
    case WebsiteLeadSubmissionReviewStatus.NOT_REQUIRED:
      return 'not_required';
    case WebsiteLeadSubmissionReviewStatus.PENDING_REVIEW:
      return 'pending_review';
    case WebsiteLeadSubmissionReviewStatus.CONFIRMED_EXISTING:
      return 'confirmed_existing';
    case WebsiteLeadSubmissionReviewStatus.CREATED_NEW_LEAD:
      return 'created_new_lead';
    case WebsiteLeadSubmissionReviewStatus.RELINKED_EXISTING:
      return 'relinked_existing';
  }
}

function resolveContactDisplayName(input: {
  contactDisplayName: string | undefined;
  contactFirstName: string | undefined;
  contactLastName: string | undefined;
  companyName: string;
}) {
  if (input.contactDisplayName) {
    return input.contactDisplayName;
  }

  const pieces = [input.contactFirstName, input.contactLastName].filter(Boolean);
  if (pieces.length > 0) {
    return pieces.join(' ');
  }

  return input.companyName;
}

function resolvePublicWebsiteContactName(input: CaptureWebsiteLeadRequest) {
  const explicitDisplay = optionalTrimmed(input.contactDisplayName);
  const firstName = optionalTrimmed(input.contactFirstName);
  const lastName = optionalTrimmed(input.contactLastName);
  const fullName = optionalTrimmed(input.fullName);

  if (explicitDisplay) {
    return {
      contactDisplayName: explicitDisplay,
      ...(firstName ? { contactFirstName: firstName } : {}),
      ...(lastName ? { contactLastName: lastName } : {}),
    };
  }

  if (firstName || lastName) {
    return {
      contactDisplayName: [firstName, lastName].filter(Boolean).join(' '),
      ...(firstName ? { contactFirstName: firstName } : {}),
      ...(lastName ? { contactLastName: lastName } : {}),
    };
  }

  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    const resolvedFirstName = parts[0];
    const resolvedLastName = parts.slice(1).join(' ');

    return {
      contactDisplayName: fullName,
      ...(resolvedFirstName ? { contactFirstName: resolvedFirstName } : {}),
      ...(resolvedLastName ? { contactLastName: resolvedLastName } : {}),
    };
  }

  throw new Error('A contact name is required for website lead capture');
}

function resolveWebsiteLeadCompanyName(
  input: CaptureWebsiteLeadRequest,
  leadType: WebsiteLeadType,
  contactDisplayName: string,
  siteName: string,
) {
  const providedCompany = optionalTrimmed(input.companyName);

  if (leadType === WebsiteLeadType.CONTRACTOR) {
    if (!providedCompany) {
      throw new Error('companyName is required for contractor website leads');
    }

    return providedCompany;
  }

  return providedCompany ?? contactDisplayName ?? siteName;
}

function resolveWebsiteServiceTechCount(input: CaptureWebsiteLeadRequest, leadType: WebsiteLeadType) {
  if (leadType === WebsiteLeadType.HOMEOWNER) {
    return 1;
  }

  return normalizePositiveInteger(input.serviceTechCount, 'serviceTechCount');
}

function assertWebsiteLeadTypeAllowed(formType: WebsiteLeadFormType, leadType: WebsiteLeadType) {
  if (formType === WebsiteLeadFormType.BOTH) {
    return;
  }

  if (formType === WebsiteLeadFormType.HOMEOWNER && leadType === WebsiteLeadType.HOMEOWNER) {
    return;
  }

  if (formType === WebsiteLeadFormType.CONTRACTOR && leadType === WebsiteLeadType.CONTRACTOR) {
    return;
  }

  throw new Error('This website form is not configured for the selected lead type');
}

function validateWebsiteSubmissionMetadata(input: {
  leadType: WebsiteLeadType;
  inquiryTopic: string | undefined;
  referralSource: string | undefined;
  siteFormConfig: {
    homeownerInquiryOptions: string[];
    contractorInquiryOptions: string[];
    referralSourceOptions: string[];
  };
}) {
  if (input.inquiryTopic) {
    const allowedInquiryTopics = input.leadType === WebsiteLeadType.HOMEOWNER
      ? input.siteFormConfig.homeownerInquiryOptions
      : input.siteFormConfig.contractorInquiryOptions;

    if (!allowedInquiryTopics.includes(input.inquiryTopic)) {
      throw new Error('Inquiry topic is not configured for this website form');
    }
  }

  if (input.referralSource && !input.siteFormConfig.referralSourceOptions.includes(input.referralSource)) {
    throw new Error('Referral source is not configured for this website form');
  }
}

function buildWebsiteCaptureNotes(input: CaptureWebsiteLeadRequest) {
  const lines = [
    optionalTrimmed(input.message) ? `Website message: ${optionalTrimmed(input.message)}` : undefined,
    optionalTrimmed(input.inquiryTopic) ? `Inquiry topic: ${optionalTrimmed(input.inquiryTopic)}` : undefined,
    optionalTrimmed(input.referralSource) ? `Referral source: ${optionalTrimmed(input.referralSource)}` : undefined,
    optionalTrimmed(input.referralDetail) ? `Referral detail: ${optionalTrimmed(input.referralDetail)}` : undefined,
    optionalTrimmed(input.notes),
  ].filter((value): value is string => Boolean(value));

  return lines.length > 0 ? lines.join('\n') : undefined;
}

function normalizeOptionalWebsiteLeadType(value: unknown) {
  const normalized = optionalTrimmed(asString(value));
  return normalized ? toWebsiteLeadTypeEnum(normalized) : undefined;
}

function normalizeOptionalWebsiteCustomerStatus(value: unknown) {
  const normalized = optionalTrimmed(asString(value));
  if (!normalized) {
    return undefined;
  }
  if (normalized === 'new_customer' || normalized === 'existing_customer') {
    return normalized;
  }
  throw new Error('customerStatus must be new_customer or existing_customer');
}

function normalizeOptionalGroupAxisSelection(value: string | undefined, fieldName: string) {
  const normalized = optionalTrimmed(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === 'unknown' || normalized === 'none' || normalized === 'group') {
    return normalized;
  }

  throw new Error(`${fieldName} must be unknown, none, or group`);
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

// Affinity/ownership group codes are persisted UPPER_SNAKE (normalizeOptionalCode in
// reference/group-classification uppercases). Filters must match that canonical form.
function normalizeGroupCode(value: string) {
  return value.trim().replace(/\s+/g, '_').toUpperCase();
}

function normalizeState(value: string | undefined) {
  const trimmed = optionalTrimmed(value);
  if (!trimmed) {
    return undefined;
  }

  const resolved = findLeadRegionOption(trimmed);
  if (!resolved) {
    throw new Error('State/Province must be a valid US state or Canadian province');
  }

  return resolved.value;
}

function normalizeCountryCode(value: string | undefined, state: string | undefined) {
  const trimmed = optionalTrimmed(value);
  const normalized = trimmed ? trimmed.toUpperCase() : undefined;
  const resolvedRegion = state ? findLeadRegionOption(state) : undefined;

  if (!normalized) {
    return resolvedRegion?.countryCode;
  }

  if (resolvedRegion && normalized !== resolvedRegion.countryCode) {
    throw new Error('countryCode must match the selected state/province');
  }

  return normalized;
}

function normalizeLimit(value: number | undefined) {
  if (!value || !Number.isInteger(value)) {
    return 50;
  }

  return Math.max(1, Math.min(value, 200));
}

function normalizePositiveInteger(value: unknown, fieldName: string, allowZero = false) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || Number.isNaN(parsed)) {
    throw new Error(`${fieldName} must be an integer`);
  }

  const minimum = allowZero ? 0 : 1;
  if (parsed < minimum) {
    throw new Error(`${fieldName} must be at least ${minimum}`);
  }

  return parsed;
}

function parseOptionalScheduledAt(value: string | undefined, fieldName: string) {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO datetime`);
  }

  if (parsed.getTime() < Date.now() - 60_000) {
    throw new Error(`${fieldName} must be in the future`);
  }

  return parsed;
}

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

function addBusinessDays(value: Date, businessDays: number) {
  const result = new Date(value.getTime());
  let remaining = businessDays;

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) {
      remaining -= 1;
    }
  }

  return result;
}

function diffBusinessDaysCeil(from: Date, to: Date) {
  if (from.getTime() === to.getTime()) {
    return 0;
  }

  const direction = from.getTime() < to.getTime() ? 1 : -1;
  const cursor = new Date(from.getTime());
  let businessDays = 0;

  while ((direction === 1 && cursor.getTime() < to.getTime()) || (direction === -1 && cursor.getTime() > to.getTime())) {
    cursor.setDate(cursor.getDate() + direction);
    if (!isWeekend(cursor)) {
      businessDays += direction;
    }
  }

  return businessDays;
}

function isWeekend(value: Date) {
  const day = value.getDay();
  return day === 0 || day === 6;
}

function isRecord(value: Prisma.JsonValue | null | undefined): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getJsonRecordString(value: Prisma.JsonValue | null | undefined, key: string) {
  if (!isRecord(value)) {
    return undefined;
  }

  const record = value as Record<string, Prisma.JsonValue>;
  const field = record[key];
  return typeof field === 'string' ? field : undefined;
}

function getJsonRecord(value: Prisma.JsonValue | null | undefined, key: string): Prisma.JsonValue | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const record = value as Record<string, Prisma.JsonValue>;
  return record[key];
}

function getJsonRecordStringArray(value: Prisma.JsonValue | null | undefined, key: string) {
  if (!isRecord(value)) {
    return [];
  }

  const record = value as Record<string, Prisma.JsonValue>;
  const field = record[key];
  if (!Array.isArray(field)) {
    return [];
  }

  return field.filter((item): item is string => typeof item === 'string');
}

function getJsonRecordNumber(value: Prisma.JsonValue | null | undefined, key: string) {
  if (!isRecord(value)) {
    return undefined;
  }

  const record = value as Record<string, Prisma.JsonValue>;
  const field = record[key];
  return typeof field === 'number' && Number.isFinite(field) ? field : undefined;
}

function formatLifecycleReason(reasonCode?: string, reasonNote?: string) {
  if (!reasonCode) {
    return reasonNote;
  }

  const label = reasonCode
    .split('_')
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join(' ');

  return reasonNote ? `${label}: ${reasonNote}` : label;
}

function buildInMemoryLeadRoutingPolicy(): LeadRoutingPolicyRecord {
  return {
    id: 'default',
    routingBasis: LeadRoutingBasis.SERVICE_TECH_COUNT,
    strategicGrowthMax: 5,
    initialContactSlaHours: 24,
    initialContactUrgentWindowHours: 12,
    initialContactManagerEscalationDelayHours: 12,
    initialContactLeadershipEscalationDelayHours: 24,
    discoverySchedulingSlaHours: 72,
    discoverySchedulingManagerEscalationDelayHours: 48,
    cisFollowUpBusinessDays: 5,
    cisFollowUpProspectReminderDelayBusinessDays: 3,
    cisFollowUpOwnerAlertDelayBusinessDays: 5,
    stagnantStageDays: 7,
    operationalAlertQuietHoursEnabled: false,
    operationalAlertQuietHoursStartLocal: '18:00',
    operationalAlertQuietHoursEndLocal: '08:00',
    operationalAlertQuietHoursTimeZone: 'America/Los_Angeles',
    notes: 'PRD-backed in-memory fallback policy.',
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}
