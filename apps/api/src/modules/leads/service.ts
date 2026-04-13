import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import {
  AuditAction,
  CisFinanceDecisionStatus,
  LeadCaptureMethod,
  LeadConsignmentEntryTiming,
  LeadConsignmentInterestStatus,
  LeadLifecycleStatus,
  LeadRoutingBasis,
  LeadRoutingTeam,
  LeadStage,
  TerritoryAssignmentMethod,
  Prisma,
  prisma,
  WebsiteLeadFormType,
  WebsiteLeadSubmissionOutcome,
  WebsiteLeadType,
} from '@pulse/db';
import type {
  CaptureWebsiteLeadRequest,
  CompleteLeadDiscoveryRequest,
  CreateWebsiteLeadNotificationRecipientRequest,
  CreateWebsiteLeadSiteRequest,
  CreateLeadRequest,
  ImportLeadFileRequest,
  ImportLeadFileResponse,
  ImportLeadRowInput,
  LeadImportFileError,
  LeadImportFilePreviewRequest,
  LeadImportFilePreviewResponse,
  ImportLeadsRequest,
  ImportLeadsResponse,
  LeadLifecycleReasonCodeKey,
  LeadLifecycleStatusKey,
  LogLeadInitialContactRequest,
  LeadDetail,
  LeadConsignmentEntryTimingKey,
  LeadConsignmentInterestStatusKey,
  LeadRoutingBasisKey,
  LeadRoutingPolicySummary,
  LeadStageEventSummary,
  LeadStageKey,
  LeadWorkflowTaskSummary,
  LeadWorkflowActionTypeKey,
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
  ListWebsiteLeadNotificationRecipientsResponse,
  ListWebsiteLeadSitesResponse,
  ListWebsiteFormLeadsRequest,
  ListWebsiteFormLeadsResponse,
  PublicWebsiteLeadSite,
  ScheduleLeadDiscoveryRequest,
  SkipLeadDiscoveryRequest,
  TransitionLeadStageRequest,
  UpdateLeadLifecycleRequest,
  UpdateLeadRoutingPolicyRequest,
  UpdateWebsiteLeadNotificationRecipientRequest,
  UpdateWebsiteLeadSiteRequest,
  WebsiteFormLeadSummary,
  WebsiteLeadNotificationRecipientSummary,
  WebsiteLeadSiteSummary,
  WebsiteLeadTypeKey,
  TerritoryAssignmentMethodKey,
} from '@pulse/contracts';
import { findLeadRegionOption } from '@pulse/contracts';
import type { AuthenticatedActor } from '../auth/types.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import { mapLeadImportFile, previewLeadImportFile } from './file-ingest.js';
import {
  syncLeadTerritoryAssignment,
} from '../territories/service.js';
import {
  WEBSITE_LEAD_NOTIFICATION_RECIPIENT_SEEDS,
  WEBSITE_LEAD_SITE_SEEDS,
} from './website-forms-seed.js';

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

type LeadWithRefs = Prisma.LeadGetPayload<{
  include: typeof LEAD_SUMMARY_INCLUDE;
}>;

type WebsiteLeadSiteWithRecipients = Prisma.WebsiteLeadSiteGetPayload<{
  include: {
    notificationRecipients: true;
  };
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
  affinityGroupName?: string;
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
  affinityGroupName?: unknown;
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
}

export async function ensureWebsiteLeadConfigSeeded() {
  await prisma.$transaction(async (tx) => {
    for (const site of WEBSITE_LEAD_SITE_SEEDS) {
      await tx.websiteLeadSite.upsert({
        where: {
          siteId: site.siteId,
        },
        update: {
          siteName: site.siteName,
          url: site.url,
          brandTag: site.brandTag,
          formType: site.formType,
        },
        create: {
          siteId: site.siteId,
          siteName: site.siteName,
          url: site.url,
          brandTag: site.brandTag,
          formType: site.formType,
          isActive: site.isActive,
        },
      });
    }

    for (const recipient of WEBSITE_LEAD_NOTIFICATION_RECIPIENT_SEEDS) {
      const existing = await tx.websiteLeadNotificationRecipient.findFirst({
        where: {
          websiteLeadSiteId: null,
          email: recipient.email,
        },
      });

      if (existing) {
        await tx.websiteLeadNotificationRecipient.update({
          where: {
            id: existing.id,
          },
          data: {
            name: recipient.name,
            ...(recipient.roleTitle ? { roleTitle: recipient.roleTitle } : {}),
          },
        });
        continue;
      }

      await tx.websiteLeadNotificationRecipient.create({
        data: {
          name: recipient.name,
          email: recipient.email,
          ...(recipient.roleTitle ? { roleTitle: recipient.roleTitle } : {}),
          isActive: recipient.isActive,
        },
      });
    }
  });
}

export async function listLeads(actor: AuthenticatedActor, query: ListLeadsRequest = {}): Promise<ListLeadsResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.view');

  const limit = normalizeLimit(query.limit);
  const search = optionalTrimmed(query.search);
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
  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { contactDisplayName: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { phone: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { affinityGroupName: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { ownershipGroupName: { contains: search, mode: Prisma.QueryMode.insensitive } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      include: LEAD_SUMMARY_INCLUDE,
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    items: items.map(toLeadSummary),
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
      where,
      orderBy: [
        { createdAt: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: limit,
      include: LEAD_SUMMARY_INCLUDE,
    }),
    prisma.lead.count({ where }),
    prisma.lead.count({ where: activePipelineWhere }),
    prisma.lead.groupBy({
      by: ['sourceSiteId', 'sourceSiteName'],
      where,
    }),
    prisma.lead.aggregate({
      where,
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

export async function listWebsiteLeadSites(actor: AuthenticatedActor): Promise<ListWebsiteLeadSitesResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.view');

  const [sites, submissionGroups, linkedLeadGroups] = await Promise.all([
    prisma.websiteLeadSite.findMany({
      include: {
        notificationRecipients: {
          where: {
            isActive: true,
          },
        },
      },
      orderBy: [{ siteName: 'asc' }],
    }),
    prisma.websiteLeadSubmission.groupBy({
      by: ['websiteLeadSiteId'],
      _count: {
        _all: true,
      },
      _max: {
        createdAt: true,
      },
      where: {
        websiteLeadSiteId: {
          not: null,
        },
      },
    }),
    prisma.lead.groupBy({
      by: ['sourceSiteId', 'stage', 'lifecycleStatus'],
      _count: {
        _all: true,
      },
      where: {
        leadCaptureMethod: LeadCaptureMethod.DIRECT_WEB_FORM,
      },
    }),
  ]);

  const thirtyDaysAgo = addDays(new Date(), -30);
  const recentSubmissionGroups = await prisma.websiteLeadSubmission.groupBy({
    by: ['websiteLeadSiteId'],
    _count: {
      _all: true,
    },
    where: {
      websiteLeadSiteId: {
        not: null,
      },
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
  });

  const submissionMap = new Map<string, { total: number; recent: number; recentAt?: Date }>();
  for (const group of submissionGroups) {
    if (!group.websiteLeadSiteId) {
      continue;
    }
    submissionMap.set(group.websiteLeadSiteId, {
      total: group._count._all,
      recent: 0,
      ...(group._max.createdAt ? { recentAt: group._max.createdAt } : {}),
    });
  }
  for (const group of recentSubmissionGroups) {
    if (!group.websiteLeadSiteId) {
      continue;
    }
    const current = submissionMap.get(group.websiteLeadSiteId);
    submissionMap.set(group.websiteLeadSiteId, {
      total: current?.total ?? 0,
      recent: group._count._all,
      ...(current?.recentAt ? { recentAt: current.recentAt } : {}),
    });
  }

  const leadMetrics = new Map<string, { total: number; active: number; converted: number }>();
  for (const group of linkedLeadGroups) {
    if (!group.sourceSiteId) {
      continue;
    }
    const current = leadMetrics.get(group.sourceSiteId) ?? { total: 0, active: 0, converted: 0 };
    current.total += group._count._all;
    if (group.stage === LeadStage.CUSTOMER_ACTIVE) {
      current.converted += group._count._all;
    } else if (group.lifecycleStatus === LeadLifecycleStatus.ACTIVE) {
      current.active += group._count._all;
    }
    leadMetrics.set(group.sourceSiteId, current);
  }

  return {
    items: sites.map((site) => {
      const submission = submissionMap.get(site.id);
      const leadMetric = leadMetrics.get(site.siteId) ?? { total: 0, active: 0, converted: 0 };
      const conversionRate = leadMetric.total > 0
        ? Number(((leadMetric.converted / leadMetric.total) * 100).toFixed(1))
        : 0;

      return {
        id: site.id,
        siteId: site.siteId,
        siteName: site.siteName,
        url: site.url,
        brandTag: site.brandTag,
        formType: toWebsiteLeadFormTypeKey(site.formType),
        isActive: site.isActive,
        ...(site.notes ? { notes: site.notes } : {}),
        submissionsLast30Days: submission?.recent ?? 0,
        linkedLeadsTotal: leadMetric.total,
        activePipelineLeads: leadMetric.active,
        convertedLeads: leadMetric.converted,
        conversionRate,
        ...(submission?.recentAt ? { recentSubmissionAt: submission.recentAt.toISOString() } : {}),
        createdAt: site.createdAt.toISOString(),
        updatedAt: site.updatedAt.toISOString(),
      };
    }),
  };
}

export async function createWebsiteLeadSite(
  actor: AuthenticatedActor,
  input: CreateWebsiteLeadSiteRequest,
): Promise<WebsiteLeadSiteSummary> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const siteId = requiredTrimmed(input.siteId, 'siteId');
  const siteName = requiredTrimmed(input.siteName, 'siteName');
  const url = requiredTrimmed(input.url, 'url');
  const brandTag = requiredTrimmed(input.brandTag, 'brandTag').toUpperCase();
  const formType = toWebsiteLeadFormTypeEnum(input.formType);
  const notes = optionalTrimmed(input.notes);

  const site = await prisma.websiteLeadSite.create({
    data: {
      siteId,
      siteName,
      url,
      brandTag,
      formType,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(notes ? { notes } : {}),
    },
  });

  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.CREATE,
      entityType: 'WEBSITE_LEAD_SITE',
      entityId: site.id,
      afterData: {
        siteId: site.siteId,
        siteName: site.siteName,
        brandTag: site.brandTag,
        formType: input.formType,
        isActive: site.isActive,
      },
      metadata: {
        actorRole: actor.role,
        operation: 'lead.website_site.create',
      },
    }),
  });

  return toWebsiteLeadSiteSummary(site);
}

export async function updateWebsiteLeadSite(
  actor: AuthenticatedActor,
  siteRecordId: string,
  input: UpdateWebsiteLeadSiteRequest,
): Promise<WebsiteLeadSiteSummary> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const existing = await prisma.websiteLeadSite.findUnique({
    where: {
      id: siteRecordId,
    },
  });

  if (!existing) {
    throw new Error('Website lead site not found');
  }

  const updated = await prisma.websiteLeadSite.update({
    where: {
      id: siteRecordId,
    },
    data: {
      ...(input.siteName !== undefined ? { siteName: requiredTrimmed(input.siteName, 'siteName') } : {}),
      ...(input.url !== undefined ? { url: requiredTrimmed(input.url, 'url') } : {}),
      ...(input.brandTag !== undefined ? { brandTag: requiredTrimmed(input.brandTag, 'brandTag').toUpperCase() } : {}),
      ...(input.formType !== undefined ? { formType: toWebsiteLeadFormTypeEnum(input.formType) } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.notes !== undefined ? { notes: optionalTrimmed(input.notes) ?? null } : {}),
    },
  });

  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'WEBSITE_LEAD_SITE',
      entityId: updated.id,
      beforeData: {
        siteName: existing.siteName,
        url: existing.url,
        brandTag: existing.brandTag,
        formType: toWebsiteLeadFormTypeKey(existing.formType),
        isActive: existing.isActive,
        notes: existing.notes,
      },
      afterData: {
        siteName: updated.siteName,
        url: updated.url,
        brandTag: updated.brandTag,
        formType: toWebsiteLeadFormTypeKey(updated.formType),
        isActive: updated.isActive,
        notes: updated.notes,
      },
      metadata: {
        actorRole: actor.role,
        operation: 'lead.website_site.update',
      },
    }),
  });

  return toWebsiteLeadSiteSummary(updated);
}

export async function listWebsiteLeadNotificationRecipients(
  actor: AuthenticatedActor,
): Promise<ListWebsiteLeadNotificationRecipientsResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.view');

  const items = await prisma.websiteLeadNotificationRecipient.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  return {
    items: items.map(toWebsiteLeadNotificationRecipientSummary),
  };
}

export async function createWebsiteLeadNotificationRecipient(
  actor: AuthenticatedActor,
  input: CreateWebsiteLeadNotificationRecipientRequest,
): Promise<WebsiteLeadNotificationRecipientSummary> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const roleTitle = optionalTrimmed(input.roleTitle);

  const created = await prisma.websiteLeadNotificationRecipient.create({
    data: {
      name: requiredTrimmed(input.name, 'name'),
      email: normalizeEmailAddress(input.email),
      ...(roleTitle ? { roleTitle } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.websiteLeadSiteId
        ? {
            websiteLeadSite: {
              connect: {
                id: input.websiteLeadSiteId,
              },
            },
          }
        : {}),
    },
  });

  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.CREATE,
      entityType: 'WEBSITE_LEAD_NOTIFICATION_RECIPIENT',
      entityId: created.id,
      afterData: {
        name: created.name,
        email: created.email,
        roleTitle: created.roleTitle,
        websiteLeadSiteId: created.websiteLeadSiteId,
        isActive: created.isActive,
      },
      metadata: {
        actorRole: actor.role,
        operation: 'lead.website_notification_recipient.create',
      },
    }),
  });

  return toWebsiteLeadNotificationRecipientSummary(created);
}

export async function updateWebsiteLeadNotificationRecipient(
  actor: AuthenticatedActor,
  recipientId: string,
  input: UpdateWebsiteLeadNotificationRecipientRequest,
): Promise<WebsiteLeadNotificationRecipientSummary> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const existing = await prisma.websiteLeadNotificationRecipient.findUnique({
    where: {
      id: recipientId,
    },
  });

  if (!existing) {
    throw new Error('Website notification recipient not found');
  }

  const updated = await prisma.websiteLeadNotificationRecipient.update({
    where: {
      id: recipientId,
    },
    data: {
      ...(input.websiteLeadSiteId !== undefined
        ? input.websiteLeadSiteId === null
          ? {
              websiteLeadSite: {
                disconnect: true,
              },
            }
          : {
              websiteLeadSite: {
                connect: {
                  id: input.websiteLeadSiteId,
                },
              },
            }
        : {}),
      ...(input.name !== undefined ? { name: requiredTrimmed(input.name, 'name') } : {}),
      ...(input.email !== undefined ? { email: normalizeEmailAddress(input.email) } : {}),
      ...(input.roleTitle !== undefined ? { roleTitle: optionalTrimmed(input.roleTitle) ?? null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'WEBSITE_LEAD_NOTIFICATION_RECIPIENT',
      entityId: updated.id,
      beforeData: {
        name: existing.name,
        email: existing.email,
        roleTitle: existing.roleTitle,
        websiteLeadSiteId: existing.websiteLeadSiteId,
        isActive: existing.isActive,
      },
      afterData: {
        name: updated.name,
        email: updated.email,
        roleTitle: updated.roleTitle,
        websiteLeadSiteId: updated.websiteLeadSiteId,
        isActive: updated.isActive,
      },
      metadata: {
        actorRole: actor.role,
        operation: 'lead.website_notification_recipient.update',
      },
    }),
  });

  return toWebsiteLeadNotificationRecipientSummary(updated);
}

export async function getPublicWebsiteLeadSite(siteId: string): Promise<PublicWebsiteLeadSite> {
  const normalizedSiteId = requiredTrimmed(siteId, 'siteId');
  const site = await prisma.websiteLeadSite.findUnique({
    where: {
      siteId: normalizedSiteId,
    },
  });

  if (!site || !site.isActive) {
    throw new Error('Website lead form is not available for this site');
  }

  return {
    id: site.id,
    siteId: site.siteId,
    siteName: site.siteName,
    url: site.url,
    brandTag: site.brandTag,
    formType: toWebsiteLeadFormTypeKey(site.formType),
  };
}

export async function listLeadWorkflowQueue(
  actor: AuthenticatedActor,
  query: ListLeadWorkflowQueueRequest = {},
): Promise<ListLeadWorkflowQueueResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.view');

  const limit = normalizeLimit(query.limit);
  const search = optionalTrimmed(query.search);
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
      where,
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

export async function getLeadDetail(actor: AuthenticatedActor, leadId: string): Promise<LeadDetail | null> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.view');

  const [lead, policy] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: leadId },
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

export async function scheduleLeadDiscovery(
  actor: AuthenticatedActor,
  leadId: string,
  input: ScheduleLeadDiscoveryRequest = {},
): Promise<LeadDetail> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const note = optionalTrimmed(input.note) ?? 'Discovery scheduled';

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
    await tx.lead.update({
      where: { id: leadId },
      data: {
        stage: LeadStage.DISCOVERY_SCHEDULED,
        initialContactedAt: current.initialContactedAt ?? now,
        discoveryScheduledAt: current.discoveryScheduledAt ?? now,
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
          discoveryScheduledAt: (current.discoveryScheduledAt ?? now).toISOString(),
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

  return (await getLeadDetail(actor, leadId)) as LeadDetail;
}

export async function completeLeadDiscovery(
  actor: AuthenticatedActor,
  leadId: string,
  input: CompleteLeadDiscoveryRequest,
): Promise<LeadDetail> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const normalized = normalizeDiscoveryCompletionInput(input, false);

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
  });

  return (await getLeadDetail(actor, leadId)) as LeadDetail;
}

export async function skipLeadDiscovery(
  actor: AuthenticatedActor,
  leadId: string,
  input: SkipLeadDiscoveryRequest,
): Promise<LeadDetail> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const normalized = normalizeDiscoveryCompletionInput(input, true);

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
  });

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

  const lead = await prisma.$transaction((tx) =>
    createLeadRecord(tx, normalized, {
      actorUserId: actor.userId,
      sessionId: actor.sessionId,
      actorRole: actor.role,
      actorType: actor.actorType,
      trigger: 'manual',
    }),
  );

  return toLeadSummary(lead);
}

export async function captureWebsiteLead(input: CaptureWebsiteLeadRequest): Promise<LeadSummary> {
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
    ...(input.affinityGroupName !== undefined ? { affinityGroupName: input.affinityGroupName } : {}),
    ...(input.ownershipGroupName !== undefined ? { ownershipGroupName: input.ownershipGroupName } : {}),
    ...(input.privateLabelName !== undefined ? { privateLabelName: input.privateLabelName } : {}),
    ...(notes ? { notes } : {}),
  };

  const lead = await prisma.$transaction(async (tx) => {
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

    await tx.websiteLeadSubmission.create({
      data: {
        websiteLeadSiteId: site.id,
        linkedLeadId: linkedLead.id,
        leadType,
        outcome,
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
        ...(inquiryTopic ? { inquiryTopic } : {}),
        ...(referralSource ? { referralSource } : {}),
        ...(referralDetail ? { referralDetail } : {}),
        ...(message ? { message } : {}),
        payload: input as unknown as Prisma.InputJsonValue,
      },
    });

    return linkedLead;
  });

  return toLeadSummary(lead);
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

export async function importLeadFile(actor: AuthenticatedActor, input: ImportLeadFileRequest): Promise<ImportLeadFileResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const mapped = mapLeadImportFile(input);
  const imported = await importLeads(actor, {
    ...(input.batchName !== undefined ? { batchName: input.batchName } : {}),
    ...(input.businessSegmentCode !== undefined ? { businessSegmentCode: input.businessSegmentCode } : {}),
    ...(input.leadSourceCode !== undefined ? { leadSourceCode: input.leadSourceCode } : {}),
    ...(input.sourceSiteId !== undefined ? { sourceSiteId: input.sourceSiteId } : {}),
    ...(input.sourceSiteName !== undefined ? { sourceSiteName: input.sourceSiteName } : {}),
    ...(input.sourceBrandTag !== undefined ? { sourceBrandTag: input.sourceBrandTag } : {}),
    rows: mapped.rows,
  });

  const errors: LeadImportFileError[] = imported.errors.map((error) => ({
    rowNumber: mapped.rowNumbers[error.rowIndex] ?? error.rowIndex + 2,
    detail: error.detail,
  }));

  return {
    ...(imported.batchName !== undefined ? { batchName: imported.batchName } : {}),
    totalRows: mapped.totalRows,
    mappedRows: mapped.rows.length,
    createdCount: imported.createdCount,
    skippedCount: imported.skippedCount,
    errorCount: imported.errorCount,
    items: imported.items,
    errors,
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

async function createLeadRecord(
  tx: Prisma.TransactionClient,
  input: NormalizedLeadInput,
  context: LeadMutationContext,
  options?: {
    sourceMetadata?: Record<string, unknown>;
  },
): Promise<LeadWithRefs> {
  const [dependencies, policy] = await Promise.all([
    resolveLeadDependencies(tx, input.businessSegmentCode, input.leadSourceCode),
    getRoutingPolicy(tx),
  ]);

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
      ...(input.affinityGroupName !== undefined ? { affinityGroupName: input.affinityGroupName } : {}),
      ...(input.ownershipGroupName !== undefined ? { ownershipGroupName: input.ownershipGroupName } : {}),
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
        territoryCode: hydratedLead.territory?.code ?? undefined,
      },
      metadata: {
        actorRole: context.actorRole,
        actorType: context.actorType,
        sessionId: context.sessionId,
        trigger: context.trigger,
      },
    }),
  });

  return hydratedLead;
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
  const policy = await tx.leadRoutingPolicy.findUnique({
    where: {
      id: 'default',
    },
  });

  if (!policy) {
    throw new Error('Lead routing policy is not seeded');
  }

  return policy;
}

async function findWebsiteLeadDuplicate(
  tx: Prisma.TransactionClient,
  input: LeadInputSource,
): Promise<LeadWithRefs | null> {
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

  if (duplicateSignals.length === 0) {
    return null;
  }

  return tx.lead.findFirst({
    where: {
      AND: [
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
  const email = optionalTrimmed(asString(input.email));
  const phone = optionalTrimmed(asString(input.phone));
  const state = normalizeState(asString(input.state));
  const countryCode = normalizeCountryCode(asString(input.countryCode), state);
  const sourceDetail = optionalTrimmed(asString(input.sourceDetail));
  const leadType = normalizeOptionalWebsiteLeadType(input.leadType);
  const sourceSiteId = optionalTrimmed(asString(input.sourceSiteId));
  const sourceSiteName = optionalTrimmed(asString(input.sourceSiteName));
  const sourceBrandTag = optionalTrimmed(asString(input.sourceBrandTag));
  const sourceCampaign = optionalTrimmed(asString(input.sourceCampaign));
  const leadRating = optionalTrimmed(asString(input.leadRating));
  const affinityGroupName = optionalTrimmed(asString(input.affinityGroupName));
  const ownershipGroupName = optionalTrimmed(asString(input.ownershipGroupName));
  const privateLabelName = optionalTrimmed(asString(input.privateLabelName));
  const leadOwnerName = optionalTrimmed(asString(input.leadOwnerName));
  const assignedTmName = optionalTrimmed(asString(input.assignedTmName));
  const notes = optionalTrimmed(asString(input.notes));
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
    ...(affinityGroupName !== undefined ? { affinityGroupName } : {}),
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

function toWorkflowQueueComputation(lead: LeadWithWorkflowRefs, now: Date): WorkflowQueueComputation {
  return toWorkflowQueueComputationWithPolicy(lead, now, null);
}

function toWorkflowQueueComputationWithPolicy(
  lead: LeadWithWorkflowRefs,
  now: Date,
  policy: LeadRoutingPolicyRecord | null,
): WorkflowQueueComputation {
  const stageAnchorAt = getWorkflowStageAnchorAt(lead);
  const daysInStage = Math.floor((now.getTime() - stageAnchorAt.getTime()) / (24 * 60 * 60 * 1000));
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

function getWorkflowStageAnchorAt(lead: LeadWithWorkflowRefs) {
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
    ...(lead.installTechCount !== null && lead.installTechCount !== undefined ? { installTechCount: lead.installTechCount } : {}),
    ...(lead.truckCount !== null && lead.truckCount !== undefined ? { truckCount: lead.truckCount } : {}),
    ...(lead.salesPersonCount !== null && lead.salesPersonCount !== undefined ? { salesPersonCount: lead.salesPersonCount } : {}),
    lifecycleStatus: toLeadLifecycleStatusKey(lead.lifecycleStatus),
    ...(lifecycleChangedAt ? { lifecycleChangedAt } : {}),
    ...(lead.lifecycleReasonCode ? { lifecycleReasonCode: toLeadLifecycleReasonCodeKey(lead.lifecycleReasonCode) } : {}),
    ...(lead.lifecycleReasonNote ? { lifecycleReasonNote: lead.lifecycleReasonNote } : {}),
    ...(lead.affinityGroupName ? { affinityGroupName: lead.affinityGroupName } : {}),
    ...(lead.ownershipGroupName ? { ownershipGroupName: lead.ownershipGroupName } : {}),
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
    ...(policy.notes ? { notes: policy.notes } : {}),
    updatedAt: policy.updatedAt.toISOString(),
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

function toWebsiteLeadFormTypeKey(value: WebsiteLeadFormType) {
  switch (value) {
    case WebsiteLeadFormType.HOMEOWNER:
      return 'homeowner';
    case WebsiteLeadFormType.CONTRACTOR:
      return 'contractor';
    case WebsiteLeadFormType.BOTH:
      return 'both';
  }
}

function toWebsiteLeadFormTypeEnum(value: string) {
  switch (value) {
    case 'homeowner':
      return WebsiteLeadFormType.HOMEOWNER;
    case 'contractor':
      return WebsiteLeadFormType.CONTRACTOR;
    case 'both':
      return WebsiteLeadFormType.BOTH;
    default:
      throw new Error(`Unknown website lead form type: ${value}`);
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

function normalizeEmailAddress(value: string) {
  const normalized = requiredTrimmed(value, 'email').toLowerCase();
  if (!normalized.includes('@')) {
    throw new Error('email must be valid');
  }
  return normalized;
}

function toWebsiteLeadSiteSummary(site: Prisma.WebsiteLeadSiteGetPayload<{}>): WebsiteLeadSiteSummary {
  return {
    id: site.id,
    siteId: site.siteId,
    siteName: site.siteName,
    url: site.url,
    brandTag: site.brandTag,
    formType: toWebsiteLeadFormTypeKey(site.formType),
    isActive: site.isActive,
    ...(site.notes ? { notes: site.notes } : {}),
    submissionsLast30Days: 0,
    linkedLeadsTotal: 0,
    activePipelineLeads: 0,
    convertedLeads: 0,
    conversionRate: 0,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
  };
}

function toWebsiteLeadNotificationRecipientSummary(
  recipient: Prisma.WebsiteLeadNotificationRecipientGetPayload<{}>,
): WebsiteLeadNotificationRecipientSummary {
  return {
    id: recipient.id,
    ...(recipient.websiteLeadSiteId ? { websiteLeadSiteId: recipient.websiteLeadSiteId } : {}),
    name: recipient.name,
    email: recipient.email,
    ...(recipient.roleTitle ? { roleTitle: recipient.roleTitle } : {}),
    isActive: recipient.isActive,
    createdAt: recipient.createdAt.toISOString(),
    updatedAt: recipient.updatedAt.toISOString(),
  };
}

function requiredTrimmed(value: unknown, fieldName: string) {
  const normalized = optionalTrimmed(asString(value));
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  return normalized;
}

function optionalTrimmed(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
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

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
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
    notes: 'PRD-backed in-memory fallback policy.',
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}
