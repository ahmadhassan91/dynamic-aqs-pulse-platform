import { prisma } from '@pulse/db';
import type {
  CalendarEventSummary,
  CalendarEventTypeKey,
  CalendarWorkspaceRequest,
  SyncCalendarOutlookEventRequest,
} from '@pulse/contracts';
import type { AuthenticatedActor } from '../auth/types.js';
import { resolveLeadRecordScope, buildTrainingSessionRecordScope } from '../auth/visibility.js';

export const MAX_CALENDAR_RANGE_DAYS = 180;

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
  const [leadEvents, trainingEvents] = await Promise.all([
    listLeadCalendarEvents(actor, rangeStart, rangeEnd),
    listTrainingCalendarEvents(actor, rangeStart, rangeEnd),
  ]);

  return [...leadEvents, ...trainingEvents].sort((left, right) => {
    const leftTime = new Date(left.startsAt).getTime();
    const rightTime = new Date(right.startsAt).getTime();
    return leftTime - rightTime || left.title.localeCompare(right.title);
  });
}

export async function resolveCalendarEventForSync(
  input: SyncCalendarOutlookEventRequest,
): Promise<CalendarEventSummary> {
  if (input.sourceModule === 'leads') {
    if (input.eventType !== 'discovery_call') {
      throw new Error('Only discovery_call events are supported for lead calendar sync');
    }

    const lead = await prisma.lead.findUnique({
      where: { id: input.sourceRecordId },
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

  const session = await prisma.trainingSession.findUnique({
    where: { id: input.sourceRecordId },
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
    orderBy: [
      { discoveryScheduledAt: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  return leads.flatMap((lead) => {
    const item = mapLeadToCalendarEvent(lead);
    return item ? [item] : [];
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
