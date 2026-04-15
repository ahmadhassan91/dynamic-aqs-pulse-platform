import { prisma } from '@pulse/db';
import type {
  CalendarEventSummary,
  CalendarEventTypeKey,
  CalendarWorkspaceRequest,
  CalendarWorkspaceResponse,
} from '@pulse/contracts';
import type { AuthenticatedActor } from '../auth/types.js';

const MAX_RANGE_DAYS = 180;

export async function getCalendarWorkspace(
  _actor: AuthenticatedActor,
  input: CalendarWorkspaceRequest,
): Promise<CalendarWorkspaceResponse> {
  const rangeStart = parseIsoDate(input.startDate, 'startDate');
  const rangeEnd = parseIsoDate(input.endDate, 'endDate');

  if (rangeEnd.getTime() < rangeStart.getTime()) {
    throw new Error('endDate must be on or after startDate');
  }

  const rangeDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86400000);
  if (rangeDays > MAX_RANGE_DAYS) {
    throw new Error(`Calendar range cannot exceed ${MAX_RANGE_DAYS} days`);
  }

  const [leadEvents, trainingEvents] = await Promise.all([
    listLeadCalendarEvents(rangeStart, rangeEnd),
    listTrainingCalendarEvents(rangeStart, rangeEnd),
  ]);

  const items = [...leadEvents, ...trainingEvents].sort((left, right) => {
    const leftTime = new Date(left.startsAt).getTime();
    const rightTime = new Date(right.startsAt).getTime();
    return leftTime - rightTime || left.title.localeCompare(right.title);
  });

  return {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    summary: {
      totalEvents: items.length,
      scheduledCount: items.filter((item) => item.status === 'scheduled').length,
      completedCount: items.filter((item) => item.status === 'completed').length,
      cancelledCount: items.filter((item) => item.status === 'cancelled').length,
      noShowCount: items.filter((item) => item.status === 'no_show').length,
      discoveryCallCount: items.filter((item) => item.eventType === 'discovery_call').length,
      virtualTrainingCount: items.filter((item) => item.eventType === 'virtual_training').length,
      accountTrainingCount: items.filter((item) => item.eventType === 'account_training').length,
      onSiteVisitCount: items.filter((item) => item.eventType === 'on_site_visit').length,
      consignmentAuditCount: items.filter((item) => item.eventType === 'consignment_audit').length,
    },
    items,
  };
}

async function listLeadCalendarEvents(rangeStart: Date, rangeEnd: Date): Promise<CalendarEventSummary[]> {
  const leads = await prisma.lead.findMany({
    where: {
      lifecycleStatus: {
        not: 'CLOSED',
      },
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
    const startsAt = lead.discoveryScheduledAt ?? lead.discoveryCompletedAt;
    if (!startsAt) {
      return [];
    }

    const item: CalendarEventSummary = {
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

    return [item];
  });
}

async function listTrainingCalendarEvents(rangeStart: Date, rangeEnd: Date): Promise<CalendarEventSummary[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
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
    const startsAt = session.scheduledAt ?? session.completedAt;
    if (!startsAt) {
      return [];
    }

    const eventType = classifyTrainingEventType(session.activityKind, session.trainingType?.deliveryMode);
    const endsAt = session.scheduledAt
      ? new Date(session.scheduledAt.getTime() + Math.max(session.durationMinutes, 30) * 60000).toISOString()
      : undefined;

    const fallbackLocationName = [session.location?.city, session.location?.state].filter(Boolean).join(', ');
    const locationName = session.location?.name ?? (fallbackLocationName || undefined);
    const assignedToName = session.trainerUser?.displayName ?? session.account.assignedTmUser?.displayName;

    const item: CalendarEventSummary = {
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

    return [item];
  });
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
