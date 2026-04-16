import { canAccessModule } from '@pulse/auth';
import type {
  CalendarWorkspaceRequest,
  CalendarWorkspaceResponse,
  CalendarEventSummary,
} from '@pulse/contracts';
import type { AppConfig } from '../../config.js';
import type { AuthenticatedActor } from '../auth/types.js';
import { listCalendarEvents, parseCalendarRange } from './events.js';
import { getOutlookWorkspaceState } from './outlook.js';

export async function getCalendarWorkspace(
  actor: AuthenticatedActor,
  input: CalendarWorkspaceRequest,
  config: AppConfig,
): Promise<CalendarWorkspaceResponse> {
  const { rangeStart, rangeEnd } = parseCalendarRange(input);
  const items = filterCalendarEventsForActor(
    actor,
    await listCalendarEvents(rangeStart, rangeEnd),
  );
  const outlook = await getOutlookWorkspaceState(actor, config, items);

  const mappedItems = items.map((item) => {
    const outlookSync = outlook.bindings.get(`${item.sourceModule}:${item.sourceRecordId}:${item.eventType}`);
    return outlookSync
      ? {
        ...item,
        outlookSync,
      }
      : item;
  });

  return {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    outlookConnection: outlook.connection,
    summary: {
      totalEvents: mappedItems.length,
      scheduledCount: mappedItems.filter((item) => item.status === 'scheduled').length,
      completedCount: mappedItems.filter((item) => item.status === 'completed').length,
      cancelledCount: mappedItems.filter((item) => item.status === 'cancelled').length,
      noShowCount: mappedItems.filter((item) => item.status === 'no_show').length,
      discoveryCallCount: mappedItems.filter((item) => item.eventType === 'discovery_call').length,
      virtualTrainingCount: mappedItems.filter((item) => item.eventType === 'virtual_training').length,
      accountTrainingCount: mappedItems.filter((item) => item.eventType === 'account_training').length,
      onSiteVisitCount: mappedItems.filter((item) => item.eventType === 'on_site_visit').length,
      consignmentAuditCount: mappedItems.filter((item) => item.eventType === 'consignment_audit').length,
    },
    items: mappedItems,
  };
}

function filterCalendarEventsForActor(
  actor: AuthenticatedActor,
  items: CalendarEventSummary[],
) {
  return items.filter((item) => canActorViewCalendarEvent(actor, item));
}

function canActorViewCalendarEvent(
  actor: AuthenticatedActor,
  item: CalendarEventSummary,
) {
  switch (item.sourceModule) {
    case 'leads':
      return canAccessModule(actor.role, 'leads');
    case 'training':
      return canAccessModule(actor.role, 'training');
    case 'territories':
      return canAccessModule(actor.role, 'territories');
    default:
      return false;
  }
}
