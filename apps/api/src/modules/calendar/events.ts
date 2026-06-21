import { prisma } from '@pulse/db';
import type { Prisma } from '@pulse/db';
import { canAccessModule, canPerformAction } from '@pulse/auth';
import type {
  CalendarEventSummary,
  CalendarEventTypeKey,
  CalendarWorkspaceRequest,
  SyncCalendarOutlookEventRequest,
} from '@pulse/contracts';
import type { AuthenticatedActor } from '../auth/types.js';
import { resolveLeadRecordScope, buildTrainingSessionRecordScope } from '../auth/visibility.js';

export const MAX_CALENDAR_RANGE_DAYS = 180;

type CalendarTerritory = {
  name: string;
  region: {
    name: string;
  } | null;
};

type ConsignmentCalendarSite = {
  id: string;
  name: string;
  status: string;
  nextAuditDueAt: Date | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  notes: string | null;
  account: {
    id: string;
    displayName: string;
    territory: CalendarTerritory | null;
    assignedTmUser: {
      displayName: string;
    } | null;
  };
  location: {
    name: string | null;
    city: string | null;
    state: string | null;
  } | null;
  ownerTmUser: {
    displayName: string;
  } | null;
  territory: CalendarTerritory | null;
  audits: Array<{
    id: string;
    scheduledFor: Date;
    completedAt: Date | null;
    status: string;
    reconciliationStatus: string;
    notes: string | null;
  }>;
};

export function parseCalendarRange(input: CalendarWorkspaceRequest) {
  const rangeStart = parseIsoDate(input.startDate, 'startDate');
  const rangeEnd = parseIsoDate(input.endDate, 'endDate');

  if (rangeEnd.getTime() < rangeStart.getTime()) {
    throw new Error('endDate must be on or after startDate');
  }

  const rangeDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86400000);
  if (rangeDays > MAX_CALENDAR_RANGE_DAYS) {
    throw new Error(`Calendar range cannot exceed ${MAX_CALENDAR_RANGE_DAYS} days`);
  }

  return {
    rangeStart,
    rangeEnd,
  };
}

export async function listCalendarEvents(
  actor: AuthenticatedActor,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarEventSummary[]> {
  const [leadEvents, trainingEvents, consignmentEvents] = await Promise.all([
    listLeadCalendarEvents(actor, rangeStart, rangeEnd),
    listTrainingCalendarEvents(actor, rangeStart, rangeEnd),
    listConsignmentCalendarEvents(actor, rangeStart, rangeEnd),
  ]);

  return [...leadEvents, ...trainingEvents, ...consignmentEvents].sort((left, right) => {
    const leftTime = new Date(left.startsAt).getTime();
    const rightTime = new Date(right.startsAt).getTime();
    return leftTime - rightTime || left.title.localeCompare(right.title);
  });
}

export async function resolveCalendarEventForSync(
  actor: AuthenticatedActor,
  input: SyncCalendarOutlookEventRequest,
): Promise<CalendarEventSummary> {
  if (input.sourceModule === 'leads') {
    if (input.eventType !== 'discovery_call') {
      throw new Error('Only discovery_call events are supported for lead calendar sync');
    }

    // Record-scope the lookup (IDOR prevention): a user may only sync a lead they can actually see. Without
    // this, any authenticated actor could sync ANY lead by id into their own Outlook and read its details.
    const leadScope = await resolveLeadRecordScope(actor);
    const lead = await prisma.lead.findFirst({
      where: leadScope ? { AND: [leadScope, { id: input.sourceRecordId }] } : { id: input.sourceRecordId },
      select: {
        id: true,
        companyName: true,
        contactDisplayName: true,
        email: true,
        discoveryScheduledAt: true,
        discoveryCompletedAt: true,
        assignedTmName: true,
        discoverySummary: true,
        territory: {
          select: {
            name: true,
            region: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!lead) {
      throw new Error('Lead calendar event not found');
    }

    const item = mapLeadToCalendarEvent(lead);
    if (!item) {
      throw new Error('Lead does not currently have a discovery event to sync');
    }

    return item;
  }

  // Same record-scope guard for training sessions (IDOR prevention).
  const trainingScope = buildTrainingSessionRecordScope(actor);
  const session = await prisma.trainingSession.findFirst({
    where: trainingScope ? { AND: [trainingScope, { id: input.sourceRecordId }] } : { id: input.sourceRecordId },
    select: {
      id: true,
      title: true,
      activityKind: true,
      status: true,
      scheduledAt: true,
      completedAt: true,
      durationMinutes: true,
      notes: true,
      account: {
        select: {
          id: true,
          displayName: true,
          territory: {
            select: {
              name: true,
              region: {
                select: {
                  name: true,
                },
              },
            },
          },
          assignedTmUser: {
            select: {
              displayName: true,
            },
          },
        },
      },
      location: {
        select: {
          name: true,
          city: true,
          state: true,
        },
      },
      trainerUser: {
        select: {
          displayName: true,
          email: true,
        },
      },
      trainingType: {
        select: {
          deliveryMode: true,
        },
      },
    },
  });

  if (!session) {
    throw new Error('Training calendar event not found');
  }

  const item = mapTrainingToCalendarEvent(session);
  if (!item) {
    throw new Error('Training session does not currently have a schedulable event to sync');
  }

  if (item.eventType !== input.eventType) {
    throw new Error('Requested event type does not match the current training session event type');
  }

  return item;
}

async function listLeadCalendarEvents(
  actor: AuthenticatedActor,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarEventSummary[]> {
  const scopeWhere = await resolveLeadRecordScope(actor);
  const consignmentAnchorStart = new Date(rangeStart.getTime() - 90 * 86400000);
  const consignmentAnchorEnd = new Date(rangeEnd.getTime() - 90 * 86400000);
  const leads = await prisma.lead.findMany({
    where: {
      AND: [
        ...(scopeWhere ? [scopeWhere] : []),
        {
          lifecycleStatus: {
            not: 'CLOSED',
          },
        },
        {
          OR: [
            {
              discoveryScheduledAt: {
                gte: rangeStart,
                lte: rangeEnd,
              },
            },
            {
              discoveryCompletedAt: {
                gte: rangeStart,
                lte: rangeEnd,
              },
            },
            {
              AND: [
                { consignmentInterestStatus: 'APPROVED' },
                { consignmentEntryTiming: 'AT_ONBOARDING' },
                {
                  OR: [
                    { convertedAccount: null },
                    { convertedAccount: { consignmentSites: { none: {} } } },
                  ],
                },
                {
                  OR: [
                    {
                      firstOrderAt: {
                        gte: consignmentAnchorStart,
                        lte: consignmentAnchorEnd,
                      },
                    },
                    {
                      onboardingCompletedAt: {
                        gte: consignmentAnchorStart,
                        lte: consignmentAnchorEnd,
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      companyName: true,
      contactDisplayName: true,
      email: true,
      discoveryScheduledAt: true,
      discoveryCompletedAt: true,
      onboardingCompletedAt: true,
      firstOrderAt: true,
      consignmentInterestStatus: true,
      consignmentEntryTiming: true,
      assignedTmName: true,
      discoverySummary: true,
      territory: {
        select: {
          name: true,
          region: {
            select: {
              name: true,
            },
          },
        },
      },
      convertedAccount: {
        select: {
          consignmentSites: {
            select: { id: true },
            take: 1,
          },
        },
      },
    },
    orderBy: [
      { discoveryScheduledAt: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  return leads.flatMap((lead) => {
    const discoveryEvent = mapLeadToCalendarEvent(lead);
    const consignmentAuditEvent = mapLeadToConsignmentAuditCalendarEvent(lead, rangeStart, rangeEnd);
    return [discoveryEvent, consignmentAuditEvent].filter((item): item is CalendarEventSummary => Boolean(item));
  });
}

async function listTrainingCalendarEvents(
  actor: AuthenticatedActor,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarEventSummary[]> {
  const scopeWhere = buildTrainingSessionRecordScope(actor);
  const sessions = await prisma.trainingSession.findMany({
    where: {
      AND: [
        ...(scopeWhere ? [scopeWhere] : []),
        {
          OR: [
            {
              scheduledAt: {
                gte: rangeStart,
                lte: rangeEnd,
              },
            },
            {
              completedAt: {
                gte: rangeStart,
                lte: rangeEnd,
              },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      title: true,
      activityKind: true,
      status: true,
      scheduledAt: true,
      completedAt: true,
      durationMinutes: true,
      notes: true,
      account: {
        select: {
          id: true,
          displayName: true,
          territory: {
            select: {
              name: true,
              region: {
                select: {
                  name: true,
                },
              },
            },
          },
          assignedTmUser: {
            select: {
              displayName: true,
            },
          },
        },
      },
      location: {
        select: {
          name: true,
          city: true,
          state: true,
        },
      },
      trainerUser: {
        select: {
          displayName: true,
          email: true,
        },
      },
      trainingType: {
        select: {
          deliveryMode: true,
        },
      },
    },
    orderBy: [
      { scheduledAt: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  return sessions.flatMap((session) => {
    const item = mapTrainingToCalendarEvent(session);
    return item ? [item] : [];
  });
}

async function listConsignmentCalendarEvents(
  actor: AuthenticatedActor,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarEventSummary[]> {
  if (!canAccessModule(actor.role, 'consignment') || !canPerformAction(actor.role, 'consignment.audit')) {
    return [];
  }

  const sites = await prisma.consignmentSite.findMany({
    where: {
      AND: [
        buildConsignmentSiteRecordScope(actor),
        {
          status: {
            not: 'EXITED',
          },
        },
        {
          OR: [
            {
              nextAuditDueAt: {
                gte: rangeStart,
                lte: rangeEnd,
              },
            },
            {
              audits: {
                some: {
                  OR: [
                    {
                      scheduledFor: {
                        gte: rangeStart,
                        lte: rangeEnd,
                      },
                    },
                    {
                      completedAt: {
                        gte: rangeStart,
                        lte: rangeEnd,
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      status: true,
      nextAuditDueAt: true,
      primaryContactName: true,
      primaryContactEmail: true,
      notes: true,
      account: {
        select: {
          id: true,
          displayName: true,
          territory: {
            select: {
              name: true,
              region: {
                select: {
                  name: true,
                },
              },
            },
          },
          assignedTmUser: {
            select: {
              displayName: true,
            },
          },
        },
      },
      location: {
        select: {
          name: true,
          city: true,
          state: true,
        },
      },
      ownerTmUser: {
        select: {
          displayName: true,
        },
      },
      territory: {
        select: {
          name: true,
          region: {
            select: {
              name: true,
            },
          },
        },
      },
      audits: {
        where: {
          OR: [
            {
              scheduledFor: {
                gte: rangeStart,
                lte: rangeEnd,
              },
            },
            {
              completedAt: {
                gte: rangeStart,
                lte: rangeEnd,
              },
            },
          ],
        },
        select: {
          id: true,
          scheduledFor: true,
          completedAt: true,
          status: true,
          reconciliationStatus: true,
          notes: true,
        },
        orderBy: [
          { scheduledFor: 'asc' },
          { createdAt: 'asc' },
        ],
      },
    },
    orderBy: [
      { nextAuditDueAt: 'asc' },
      { updatedAt: 'desc' },
    ],
  });

  return sites.flatMap((site) => {
    const auditEvents = site.audits.map((audit) => mapConsignmentAuditToCalendarEvent(site, audit));
    if (auditEvents.length > 0 || !site.nextAuditDueAt) {
      return auditEvents;
    }

    return [mapConsignmentSiteDueToCalendarEvent(site)];
  });
}

function mapLeadToCalendarEvent(lead: {
  id: string;
  companyName: string;
  contactDisplayName: string;
  email: string | null;
  discoveryScheduledAt: Date | null;
  discoveryCompletedAt: Date | null;
  assignedTmName: string | null;
  discoverySummary: string | null;
  territory: {
    name: string;
    region: {
      name: string;
    } | null;
  } | null;
}): CalendarEventSummary | null {
  const startsAt = lead.discoveryScheduledAt ?? lead.discoveryCompletedAt;
  if (!startsAt) {
    return null;
  }

  return {
    id: `lead:${lead.id}:discovery`,
    sourceModule: 'leads',
    sourceRecordId: lead.id,
    sourcePath: `/leads/${lead.id}`,
    eventType: 'discovery_call',
    status: lead.discoveryCompletedAt ? 'completed' : 'scheduled',
    title: `Discovery Call — ${lead.companyName}`,
    startsAt: startsAt.toISOString(),
    contactName: lead.contactDisplayName,
    leadId: lead.id,
    leadName: lead.companyName,
    ...(lead.assignedTmName ? { assignedToName: lead.assignedTmName } : {}),
    ...(lead.email ? { contactEmail: lead.email } : {}),
    ...(lead.territory?.name ? { territoryName: lead.territory.name } : {}),
    ...(lead.territory?.region?.name ? { regionName: lead.territory.region.name } : {}),
    ...(lead.discoverySummary ? { notes: lead.discoverySummary } : {}),
  };
}

function mapLeadToConsignmentAuditCalendarEvent(
  lead: {
    id: string;
    companyName: string;
    contactDisplayName: string;
    email: string | null;
    onboardingCompletedAt: Date | null;
    firstOrderAt: Date | null;
    consignmentInterestStatus: string | null;
    consignmentEntryTiming: string | null;
    assignedTmName: string | null;
    territory: {
      name: string;
      region: {
        name: string;
      } | null;
    } | null;
    convertedAccount: {
      consignmentSites: Array<{ id: string }>;
    } | null;
  },
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEventSummary | null {
  if (
    lead.consignmentInterestStatus !== 'APPROVED'
    || lead.consignmentEntryTiming !== 'AT_ONBOARDING'
  ) {
    return null;
  }

  const lifecycleAnchor = lead.firstOrderAt ?? lead.onboardingCompletedAt;
  if (!lifecycleAnchor) {
    return null;
  }

  if (lead.convertedAccount?.consignmentSites.length) {
    return null;
  }

  const dueAt = new Date(lifecycleAnchor.getTime() + 90 * 86400000);
  if (dueAt.getTime() < rangeStart.getTime() || dueAt.getTime() > rangeEnd.getTime()) {
    return null;
  }

  return {
    id: `lead:${lead.id}:consignment-audit`,
    sourceModule: 'leads',
    sourceRecordId: lead.id,
    sourcePath: `/leads/${lead.id}`,
    eventType: 'consignment_audit',
    status: 'scheduled',
    title: `Consignment ROSE Audit — ${lead.companyName}`,
    startsAt: dueAt.toISOString(),
    contactName: lead.contactDisplayName,
    leadId: lead.id,
    leadName: lead.companyName,
    ...(lead.assignedTmName ? { assignedToName: lead.assignedTmName } : {}),
    ...(lead.email ? { contactEmail: lead.email } : {}),
    ...(lead.territory?.name ? { territoryName: lead.territory.name } : {}),
    ...(lead.territory?.region?.name ? { regionName: lead.territory.region.name } : {}),
    notes: 'Lead-backed consignment audit hint; create a durable consignment site and ROSE audit record when onboarding converts.',
  };
}

function mapConsignmentAuditToCalendarEvent(
  site: ConsignmentCalendarSite,
  audit: ConsignmentCalendarSite['audits'][number],
): CalendarEventSummary {
  const startsAt = audit.completedAt ?? audit.scheduledFor;

  return {
    ...baseConsignmentCalendarEvent(site),
    id: `consignment-audit:${audit.id}`,
    sourceRecordId: audit.id,
    status: mapConsignmentAuditStatus(audit.status),
    startsAt: startsAt.toISOString(),
    ...(audit.notes ? { notes: audit.notes } : {}),
  };
}

function mapConsignmentSiteDueToCalendarEvent(site: ConsignmentCalendarSite): CalendarEventSummary {
  return {
    ...baseConsignmentCalendarEvent(site),
    id: `consignment-site:${site.id}:next-audit`,
    sourceRecordId: site.id,
    status: 'scheduled',
    startsAt: site.nextAuditDueAt!.toISOString(),
    ...(site.notes ? { notes: site.notes } : {}),
  };
}

function baseConsignmentCalendarEvent(site: ConsignmentCalendarSite): Omit<CalendarEventSummary, 'id' | 'sourceRecordId' | 'status' | 'startsAt'> {
  const territory = site.territory ?? site.account.territory;
  const assignedToName = site.ownerTmUser?.displayName ?? site.account.assignedTmUser?.displayName;
  const fallbackLocationName = [site.location?.city, site.location?.state].filter(Boolean).join(', ');
  const locationName = site.location?.name ?? (fallbackLocationName || undefined);

  return {
    sourceModule: 'consignment',
    // Web drill-through route is /consignment/[siteId] (NO /sites/ segment — that path is the API's, not the
    // web page's). Must match the canonical links in ConsignmentSiteDetail / CustomerConsignmentIndicator.
    sourcePath: `/consignment/${site.id}`,
    eventType: 'consignment_audit',
    title: `Consignment ROSE Audit — ${site.account.displayName}`,
    accountId: site.account.id,
    accountName: site.account.displayName,
    ...(assignedToName ? { assignedToName } : {}),
    ...(site.primaryContactName ? { contactName: site.primaryContactName } : {}),
    ...(site.primaryContactEmail ? { contactEmail: site.primaryContactEmail } : {}),
    ...(territory?.name ? { territoryName: territory.name } : {}),
    ...(territory?.region?.name ? { regionName: territory.region.name } : {}),
    ...(locationName ? { locationName } : {}),
  };
}

function buildConsignmentSiteRecordScope(actor: AuthenticatedActor): Prisma.ConsignmentSiteWhereInput {
  if (actor.role === 'TERRITORY_MANAGER') {
    return { ownerTmUserId: actor.userId };
  }

  if (actor.role === 'REGIONAL_DIRECTOR') {
    return { OR: [{ ownerRdUserId: actor.userId }, { region: { directorUserId: actor.userId } }] };
  }

  return {};
}

function mapTrainingToCalendarEvent(session: {
  id: string;
  title: string;
  activityKind: string;
  status: string;
  scheduledAt: Date | null;
  completedAt: Date | null;
  durationMinutes: number;
  notes: string | null;
  account: {
    id: string;
    displayName: string;
    territory: {
      name: string;
      region: {
        name: string;
      } | null;
    } | null;
    assignedTmUser: {
      displayName: string;
    } | null;
  };
  location: {
    name: string | null;
    city: string | null;
    state: string | null;
  } | null;
  trainerUser: {
    displayName: string;
    email: string;
  } | null;
  trainingType: {
    deliveryMode: string;
  } | null;
}): CalendarEventSummary | null {
  const startsAt = session.scheduledAt ?? session.completedAt;
  if (!startsAt) {
    return null;
  }

  const eventType = classifyTrainingEventType(session.activityKind, session.trainingType?.deliveryMode);
  const endsAt = session.scheduledAt
    ? new Date(session.scheduledAt.getTime() + Math.max(session.durationMinutes, 30) * 60000).toISOString()
    : undefined;

  const fallbackLocationName = [session.location?.city, session.location?.state].filter(Boolean).join(', ');
  const locationName = session.location?.name ?? (fallbackLocationName || undefined);
  const assignedToName = session.trainerUser?.displayName ?? session.account.assignedTmUser?.displayName;

  return {
    id: `training:${session.id}`,
    sourceModule: 'training',
    sourceRecordId: session.id,
    sourcePath: `/customers/${session.account.id}`,
    eventType,
    status: mapTrainingStatus(session.status),
    title: session.title,
    startsAt: startsAt.toISOString(),
    accountId: session.account.id,
    accountName: session.account.displayName,
    ...(endsAt ? { endsAt } : {}),
    ...(assignedToName ? { assignedToName } : {}),
    ...(session.trainerUser?.displayName ? { contactName: session.trainerUser.displayName } : {}),
    ...(session.trainerUser?.email ? { contactEmail: session.trainerUser.email } : {}),
    ...(session.account.territory?.name ? { territoryName: session.account.territory.name } : {}),
    ...(session.account.territory?.region?.name ? { regionName: session.account.territory.region.name } : {}),
    ...(locationName ? { locationName } : {}),
    ...(session.notes ? { notes: session.notes } : {}),
  };
}

function parseIsoDate(value: string, fieldName: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO date`);
  }

  return parsed;
}

function classifyTrainingEventType(activityKind: string, deliveryMode?: string): CalendarEventTypeKey {
  if (activityKind === 'SITE_VISIT') {
    return 'on_site_visit';
  }

  if (deliveryMode === 'VIRTUAL' || deliveryMode === 'PHONE' || deliveryMode === 'HYBRID') {
    return 'virtual_training';
  }

  return 'account_training';
}

function mapTrainingStatus(status: string): CalendarEventSummary['status'] {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    case 'NO_SHOW':
      return 'no_show';
    default:
      return 'scheduled';
  }
}

function mapConsignmentAuditStatus(status: string): CalendarEventSummary['status'] {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}
