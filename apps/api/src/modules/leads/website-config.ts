import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import {
  AuditAction,
  LeadCaptureMethod,
  LeadLifecycleStatus,
  LeadStage,
  prisma,
} from '@pulse/db';
import type {
  CreateWebsiteLeadNotificationRecipientRequest,
  CreateWebsiteLeadSiteRequest,
  ListWebsiteLeadNotificationRecipientsResponse,
  ListWebsiteLeadSitesResponse,
  PublicWebsiteLeadSite,
  UpdateWebsiteLeadNotificationRecipientRequest,
  UpdateWebsiteLeadSiteRequest,
  WebsiteLeadNotificationRecipientSummary,
  WebsiteLeadSiteSummary,
} from '@pulse/contracts';
import type { AuthenticatedActor } from '../auth/types.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import {
  addDays,
  normalizeEmailAddress,
  optionalTrimmed,
  requiredTrimmed,
  toWebsiteLeadFormTypeEnum,
  toWebsiteLeadFormTypeKey,
  toWebsiteLeadNotificationRecipientSummary,
  toWebsiteLeadSiteSummary,
} from './shared.js';
import {
  WEBSITE_LEAD_NOTIFICATION_RECIPIENT_SEEDS,
  WEBSITE_LEAD_SITE_SEEDS,
} from './website-forms-seed.js';

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
