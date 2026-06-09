'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Menu,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowRight,
  IconCalendarEvent,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconExternalLink,
  IconSettings,
  IconMapPin,
  IconPhoneCall,
  IconRefresh,
  IconSchool,
  IconTruckDelivery,
} from '@tabler/icons-react';
import type {
  CalendarEventSummary,
  CalendarEventTypeKey,
  CalendarWorkspaceResponse,
} from '@pulse/contracts';
import {
  fetchCalendarWorkspace,
  syncCalendarOutlookEvent,
} from '@/lib/pulse-api';
import { canPerformAction } from '@/lib/access';
import {
  getCalendarPrototypeFilterOptions,
  getCalendarPrototypeViewOptions,
} from '@/lib/prototype-parity';
import { usePulseSession } from '@/lib/pulse-session';
import {
  EmptyStateMessage,
  WorkbenchAdvancedSection,
  WorkbenchAttentionPanel,
  WorkbenchDetailRail,
  WorkbenchHeader,
  WorkbenchTable,
} from '@/components/ui/Workbench';
import { CalendarSchedulerModal } from './CalendarSchedulerModal';

type CalendarViewMode = 'day' | 'week' | 'month' | 'list';
type CalendarFilterMode = 'all' | 'discovery' | 'training' | 'visits' | 'audits';

const EVENT_TYPE_META: Record<
  CalendarEventTypeKey,
  { label: string; color: string; shortLabel: string; icon: typeof IconCalendarEvent }
> = {
  discovery_call: {
    label: 'Discovery Call',
    color: 'violet',
    shortLabel: 'Discovery',
    icon: IconPhoneCall,
  },
  virtual_training: {
    label: 'Virtual Training',
    color: 'blue',
    shortLabel: 'Virtual',
    icon: IconSchool,
  },
  account_training: {
    label: 'Account Training',
    color: 'green',
    shortLabel: 'Training',
    icon: IconSchool,
  },
  on_site_visit: {
    label: 'On-Site Visit',
    color: 'orange',
    shortLabel: 'Visit',
    icon: IconMapPin,
  },
  consignment_audit: {
    label: 'Consignment Audit',
    color: 'yellow',
    shortLabel: 'Audit',
    icon: IconTruckDelivery,
  },
};

const STATUS_COLORS: Record<CalendarEventSummary['status'], string> = {
  scheduled: 'blue',
  completed: 'green',
  cancelled: 'gray',
  no_show: 'yellow',
};

const TIME_GRID_START_HOUR = 8;
const TIME_GRID_END_HOUR = 22;
const TIME_GRID_ROW_HEIGHT = 72;
const FALLBACK_EVENT_DURATION_MINUTES = 60;

function getEventMeta(eventType: CalendarEventTypeKey) {
  return EVENT_TYPE_META[eventType];
}

function getStatusColor(status: CalendarEventSummary['status']) {
  return STATUS_COLORS[status];
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfHour(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours());
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  return addDays(startOfDay(date), -day);
}

function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatDayKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

function formatWeekday(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(value);
}

function formatWeekdayLabel(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
  }).format(value);
}

function formatMonthDayLabel(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(value);
}

function formatTime(value: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(typeof value === 'string' ? new Date(value) : value);
}

function normalizeStatusLabel(value: CalendarEventSummary['status']) {
  return value.replace(/_/g, ' ');
}

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function buildTimeGridHours() {
  return Array.from(
    { length: TIME_GRID_END_HOUR - TIME_GRID_START_HOUR },
    (_, index) => TIME_GRID_START_HOUR + index,
  );
}

function resolveEventEnd(item: CalendarEventSummary) {
  if (item.endsAt) {
    return new Date(item.endsAt);
  }

  const startsAt = new Date(item.startsAt);
  const fallbackEnd = new Date(startsAt);
  fallbackEnd.setMinutes(fallbackEnd.getMinutes() + FALLBACK_EVENT_DURATION_MINUTES);
  return fallbackEnd;
}

type TimeGridPlacement = {
  item: CalendarEventSummary;
  top: number;
  height: number;
  laneIndex: number;
  laneCount: number;
};

function buildTimeGridPlacements(items: CalendarEventSummary[], day: Date): TimeGridPlacement[] {
  const gridStart = new Date(day);
  gridStart.setHours(TIME_GRID_START_HOUR, 0, 0, 0);
  const gridEnd = new Date(day);
  gridEnd.setHours(TIME_GRID_END_HOUR, 0, 0, 0);
  const gridStartMs = gridStart.getTime();
  const gridEndMs = gridEnd.getTime();

  const candidates = items
    .map((item) => {
      const start = new Date(item.startsAt);
      const end = resolveEventEnd(item);
      const startMs = Math.max(start.getTime(), gridStartMs);
      const endMs = Math.min(end.getTime(), gridEndMs);

      if (endMs <= gridStartMs || startMs >= gridEndMs || endMs <= startMs) {
        return null;
      }

      return {
        item,
        startMs,
        endMs,
      };
    })
    .filter((item): item is { item: CalendarEventSummary; startMs: number; endMs: number } => Boolean(item))
    .sort((left, right) => {
      if (left.startMs === right.startMs) {
        return left.endMs - right.endMs;
      }
      return left.startMs - right.startMs;
    });

  const placements: Array<TimeGridPlacement & { startMs: number; endMs: number }> = [];
  let active: Array<TimeGridPlacement & { startMs: number; endMs: number }> = [];
  let cluster: Array<TimeGridPlacement & { startMs: number; endMs: number }> = [];

  const finalizeCluster = () => {
    if (cluster.length === 0) {
      return;
    }

    const laneCount = Math.max(...cluster.map((entry) => entry.laneIndex + 1));
    for (const entry of cluster) {
      entry.laneCount = laneCount;
    }
    cluster = [];
  };

  for (const candidate of candidates) {
    active = active.filter((entry) => entry.endMs > candidate.startMs);
    if (active.length === 0) {
      finalizeCluster();
    }

    const usedLanes = new Set(active.map((entry) => entry.laneIndex));
    let laneIndex = 0;
    while (usedLanes.has(laneIndex)) {
      laneIndex += 1;
    }

    const placement: TimeGridPlacement & { startMs: number; endMs: number } = {
      item: candidate.item,
      startMs: candidate.startMs,
      endMs: candidate.endMs,
      top: 0,
      height: 0,
      laneIndex,
      laneCount: 1,
    };

    active.push(placement);
    cluster.push(placement);
    placements.push(placement);
  }

  finalizeCluster();

  return placements.map((placement) => {
    const startMinutes = (placement.startMs - gridStartMs) / (1000 * 60);
    const durationMinutes = (placement.endMs - placement.startMs) / (1000 * 60);
    return {
      item: placement.item,
      top: (startMinutes / 60) * TIME_GRID_ROW_HEIGHT,
      // WCAG 2.5.5: keep the clickable event block >= 44px tall even for short slots
      height: Math.max((durationMinutes / 60) * TIME_GRID_ROW_HEIGHT, 44),
      laneIndex: placement.laneIndex,
      laneCount: placement.laneCount,
    };
  });
}

function isActivationKey(key: string) {
  return key === 'Enter' || key === ' ';
}

function resolveRange(anchorDate: Date, view: CalendarViewMode) {
  if (view === 'day') {
    const start = startOfDay(anchorDate);
    return {
      start,
      end: addDays(start, 1),
    };
  }

  if (view === 'week') {
    return {
      start: startOfWeek(anchorDate),
      end: endOfWeek(anchorDate),
    };
  }

  if (view === 'list') {
    const start = startOfDay(anchorDate);
    return {
      start,
      end: addDays(start, 29),
    };
  }

  return {
    start: startOfWeek(startOfMonth(anchorDate)),
    end: endOfWeek(endOfMonth(anchorDate)),
  };
}

function shiftAnchorDate(anchorDate: Date, view: CalendarViewMode, direction: -1 | 1) {
  if (view === 'day') {
    return addDays(anchorDate, direction);
  }

  if (view === 'week') {
    return addDays(anchorDate, direction * 7);
  }

  if (view === 'list') {
    return addDays(anchorDate, direction * 30);
  }

  return new Date(anchorDate.getFullYear(), anchorDate.getMonth() + direction, 1);
}

function buildMonthCells(anchorDate: Date) {
  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const items: Date[] = [];

  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    items.push(cursor);
  }

  return items;
}

function filterEventItem(item: CalendarEventSummary, filter: CalendarFilterMode) {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'discovery') {
    return item.eventType === 'discovery_call';
  }

  if (filter === 'training') {
    return item.eventType === 'virtual_training' || item.eventType === 'account_training';
  }

  if (filter === 'visits') {
    return item.eventType === 'on_site_visit';
  }

  return item.eventType === 'consignment_audit';
}

export function CalendarWorkspace({
  embedded = false,
  initialView = 'day',
}: {
  embedded?: boolean;
  initialView?: CalendarViewMode;
} = {}) {
  const { auth, apiBaseUrl } = usePulseSession();
  const searchParams = useSearchParams();
  const accessToken = auth?.tokens.accessToken ?? '';
  const role = auth?.identity.role;
  const [view, setView] = useState<CalendarViewMode>(initialView);
  const [filter, setFilter] = useState<CalendarFilterMode>('all');
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [workspace, setWorkspace] = useState<CalendarWorkspaceResponse | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingOutlookEvent, setIsSyncingOutlookEvent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [outlookMessage, setOutlookMessage] = useState<string | null>(null);
  const [schedulerAnchorDate, setSchedulerAnchorDate] = useState<Date | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [territoryFilter, setTerritoryFilter] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const canScheduleDiscovery = role ? canPerformAction(role, 'lead.intake_manage') : false;
  const canScheduleTraining = role ? canPerformAction(role, 'training.schedule') : false;
  const canViewCalendarIntegrations = role ? canPerformAction(role, 'admin.integration_view') : false;

  const range = useMemo(() => resolveRange(anchorDate, view), [anchorDate, view]);

  const openSchedulerForDate = useCallback((date: Date) => {
    if (!canScheduleDiscovery && !canScheduleTraining) {
      setErrorMessage('You can review the calendar, but your access profile cannot schedule discovery or training.');
      return;
    }
    setErrorMessage(null);
    setSchedulerAnchorDate(new Date(date));
  }, [canScheduleDiscovery, canScheduleTraining]);

  const loadWorkspace = useCallback(async () => {
    if (!auth) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchCalendarWorkspace(apiBaseUrl, accessToken, {
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      });
      setWorkspace(response);
      setSelectedEventId((current) => {
        if (current && response.items.some((item) => item.id === current)) {
          return current;
        }
        return null;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, apiBaseUrl, auth, range.end, range.start]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const status = searchParams.get('outlook');
    if (!status || typeof window === 'undefined') {
      return;
    }

    const detail = searchParams.get('outlookMessage');
    if (status === 'connected') {
      setOutlookMessage('Outlook calendar connected successfully.');
    } else {
      setOutlookMessage(detail ?? 'Outlook calendar connection did not complete.');
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('outlook');
    nextUrl.searchParams.delete('outlookMessage');
    window.history.replaceState({}, '', nextUrl.toString());
  }, [searchParams]);

  const filteredItems = useMemo(
    () => (workspace?.items ?? []).filter((item) => (
      filterEventItem(item, filter)
      && (!ownerFilter || item.assignedToName === ownerFilter)
      && (!territoryFilter || item.territoryName === territoryFilter)
      && (!accountFilter || item.accountName === accountFilter)
    )),
    [accountFilter, filter, ownerFilter, territoryFilter, workspace?.items],
  );

  const selectedEvent = useMemo(
    () => filteredItems.find((item) => item.id === selectedEventId) ?? null,
    [filteredItems, selectedEventId],
  );
  const outlookConnection = workspace?.outlookConnection;

  const itemsByDay = useMemo(() => {
    const buckets = new Map<string, CalendarEventSummary[]>();

    for (const item of filteredItems) {
      const key = formatDayKey(new Date(item.startsAt));
      const current = buckets.get(key) ?? [];
      current.push(item);
      buckets.set(key, current);
    }

    for (const value of buckets.values()) {
      value.sort((left, right) => left.startsAt.localeCompare(right.startsAt));
    }

    return buckets;
  }, [filteredItems]);

  const monthCells = useMemo(() => buildMonthCells(anchorDate), [anchorDate]);
  const calendarFilterOptions = useMemo(() => getCalendarPrototypeFilterOptions(), []);
  const calendarViewOptions = useMemo(() => getCalendarPrototypeViewOptions(), []);
  const ownerFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];
    for (const item of workspace?.items ?? []) {
      const name = item.assignedToName;
      if (name && !seen.has(name)) { seen.add(name); options.push({ value: name, label: name }); }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [workspace?.items]);
  const territoryFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];
    for (const item of workspace?.items ?? []) {
      const name = item.territoryName;
      if (name && !seen.has(name)) { seen.add(name); options.push({ value: name, label: name }); }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [workspace?.items]);
  const accountFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];
    for (const item of workspace?.items ?? []) {
      const name = item.accountName;
      if (name && !seen.has(name)) { seen.add(name); options.push({ value: name, label: name }); }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [workspace?.items]);
  const coreCalendarViewOptions = useMemo(
    () => calendarViewOptions.filter((option) => option.value === 'day' || option.value === 'week'),
    [calendarViewOptions],
  );
  const selectedPowerViewOption = useMemo(
    () => calendarViewOptions.find((option) => option.value === view && option.value !== 'day' && option.value !== 'week'),
    [calendarViewOptions, view],
  );
  const visibleCalendarViewOptions = useMemo(
    () => (selectedPowerViewOption ? [...coreCalendarViewOptions, selectedPowerViewOption] : coreCalendarViewOptions),
    [coreCalendarViewOptions, selectedPowerViewOption],
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(anchorDate), index)),
    [anchorDate],
  );
  const timeGridHours = useMemo(() => buildTimeGridHours(), []);
  const timeGridDays = useMemo(
    () => (view === 'day' ? [startOfDay(anchorDate)] : weekDays),
    [anchorDate, view, weekDays],
  );
  const timeGridHeight = useMemo(
    () => timeGridHours.length * TIME_GRID_ROW_HEIGHT,
    [timeGridHours.length],
  );
  const selectedDayKey = useMemo(() => formatDayKey(anchorDate), [anchorDate]);
  const selectedDayItems = useMemo(
    () => itemsByDay.get(selectedDayKey) ?? [],
    [itemsByDay, selectedDayKey],
  );
  const timeGridPlacementsByDay = useMemo(() => {
    const next = new Map<string, TimeGridPlacement[]>();

    for (const day of timeGridDays) {
      const key = formatDayKey(day);
      next.set(key, buildTimeGridPlacements(itemsByDay.get(key) ?? [], day));
    }

    return next;
  }, [itemsByDay, timeGridDays]);
  const todayItems = useMemo(() => {
    const todayKey = formatDayKey(new Date());
    return (itemsByDay.get(todayKey) ?? []).filter((item) => item.status === 'scheduled');
  }, [itemsByDay]);
  const upcomingItems = useMemo(
    () =>
      filteredItems
        .filter((item) => {
          if (item.status !== 'scheduled') {
            return false;
          }
          const startsAt = new Date(item.startsAt).getTime();
          const now = Date.now();
          return startsAt >= now && startsAt <= now + (14 * 24 * 60 * 60 * 1000);
        })
        .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
        .slice(0, 8),
    [filteredItems],
  );

  const rangeLabel = useMemo(() => {
    if (view === 'day') {
      return formatWeekday(anchorDate);
    }

    if (view === 'month') {
      return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(anchorDate);
    }

    return `${formatDate(range.start)} - ${formatDate(range.end)}`;
  }, [anchorDate, range.end, range.start, view]);

  const unsyncedOutlookItems = useMemo(
    () =>
      filteredItems.filter((item) => (
        item.status === 'scheduled'
        && outlookConnection?.isConnected
        && !item.outlookSync?.syncedAt
        && (item.sourceModule === 'leads' || item.sourceModule === 'training')
      )),
    [filteredItems, outlookConnection?.isConnected],
  );

  const calendarAttentionItems = useMemo(
    () => [
      {
        id: 'today-events',
        title: 'Today schedule',
        description: 'Scheduled work on the current calendar day.',
        count: todayItems.length,
        tone: todayItems.length > 0 ? 'red' : 'green',
      },
      {
        id: 'upcoming-events',
        title: 'Upcoming commitments',
        description: 'Scheduled discovery, training, visits, and audits in the next 14 days.',
        count: upcomingItems.length,
        tone: 'teal',
      },
      ...(outlookConnection?.isConnected ? [{
        id: 'calendar-handoff',
        title: 'Outlook sync review',
        description: 'Lead and training events waiting to be reflected in your Outlook calendar.',
        count: unsyncedOutlookItems.length,
        tone: unsyncedOutlookItems.length > 0 ? 'orange' : 'gray',
      }] : []),
    ],
    [outlookConnection?.isConnected, todayItems.length, upcomingItems.length, unsyncedOutlookItems.length],
  );

  const handleSyncSelectedEvent = useCallback(async () => {
    if (!auth || !selectedEvent) {
      return;
    }

    if (selectedEvent.sourceModule !== 'leads' && selectedEvent.sourceModule !== 'training') {
      setErrorMessage('This calendar event family is not sync-enabled yet.');
      return;
    }

    setIsSyncingOutlookEvent(true);
    setErrorMessage(null);
    try {
      await syncCalendarOutlookEvent(apiBaseUrl, accessToken, {
        sourceModule: selectedEvent.sourceModule,
        sourceRecordId: selectedEvent.sourceRecordId,
        eventType: selectedEvent.eventType,
      });
      setOutlookMessage('Selected event synced to Outlook.');
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSyncingOutlookEvent(false);
    }
  }, [accessToken, apiBaseUrl, auth, loadWorkspace, selectedEvent]);

  return (
    <Stack gap="lg">
      {!embedded ? (
        <>
          <WorkbenchHeader
            eyebrow="Scheduling"
            title="CRM Calendar"
            description="Schedule discovery and training, then review visits and audits from their linked workflows."
            policyText={outlookConnection?.isConnected ? 'Shared scheduling is connected' : 'Pulse remains the scheduling source of truth'}
            primaryAction={canScheduleDiscovery || canScheduleTraining ? (
              <Button variant="filled" leftSection={<IconCalendarEvent size={16} />} onClick={() => openSchedulerForDate(startOfHour(new Date()))}>
                Schedule Discovery/Training
              </Button>
            ) : null}
            secondaryActions={(
              <Group gap="xs" wrap="wrap" justify="flex-end">
                {canViewCalendarIntegrations ? (
                  <Button
                    component={Link}
                    href="/admin/integrations?provider=calendar"
                    variant="default"
                    leftSection={<IconSettings size={14} />}
                    size="sm"
                  >
                    Outlook settings
                  </Button>
                ) : null}
              </Group>
            )}
          />
        </>
      ) : null}

      <Paper withBorder radius="xl" p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="center" gap="md" wrap="wrap">
            <Group gap="xs">
              <Button variant="subtle" aria-label="Previous period" onClick={() => setAnchorDate((current) => shiftAnchorDate(current, view, -1))}>
                <IconChevronLeft size={16} />
              </Button>
              <Button variant="subtle" aria-label="Next period" onClick={() => setAnchorDate((current) => shiftAnchorDate(current, view, 1))}>
                <IconChevronRight size={16} />
              </Button>
              <Button variant="light" onClick={() => setAnchorDate(startOfDay(new Date()))}>
                Today
              </Button>
              <Text fw={700}>{rangeLabel}</Text>
            </Group>

            <Group gap="xs" wrap="wrap">
              <Select
                aria-label="Calendar filter"
                data={calendarFilterOptions}
                value={filter}
                onChange={(value) => setFilter((value as CalendarFilterMode | null) ?? 'all')}
                w={{ base: '100%', sm: 180 }}
              />
              <Select
                aria-label="Calendar view"
                data={calendarViewOptions}
                value={view}
                onChange={(value) => setView((value as CalendarViewMode | null) ?? 'day')}
                w={{ base: '100%', sm: 150 }}
                allowDeselect={false}
              />
            </Group>
            {(ownerFilterOptions.length > 0 || territoryFilterOptions.length > 0 || accountFilterOptions.length > 0) ? (
              <Group gap="xs" wrap="wrap">
                {ownerFilterOptions.length > 0 ? (
                  <Select
                    aria-label="Filter by owner"
                    placeholder="All owners"
                    data={ownerFilterOptions}
                    value={ownerFilter}
                    onChange={setOwnerFilter}
                    clearable
                    w={{ base: '100%', sm: 160 }}
                  />
                ) : null}
                {territoryFilterOptions.length > 0 ? (
                  <Select
                    aria-label="Filter by territory"
                    placeholder="All territories"
                    data={territoryFilterOptions}
                    value={territoryFilter}
                    onChange={setTerritoryFilter}
                    clearable
                    w={{ base: '100%', sm: 160 }}
                  />
                ) : null}
                {accountFilterOptions.length > 0 ? (
                  <Select
                    aria-label="Filter by account"
                    placeholder="All accounts"
                    data={accountFilterOptions}
                    value={accountFilter}
                    onChange={setAccountFilter}
                    clearable
                    w={{ base: '100%', sm: 160 }}
                  />
                ) : null}
              </Group>
            ) : null}
          </Group>

          {errorMessage ? (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {errorMessage}
            </Alert>
          ) : null}

          {outlookMessage ? (
            <Alert color="green" icon={<IconCalendarEvent size={16} />}>
              {outlookMessage}
            </Alert>
          ) : null}
        </Stack>
      </Paper>

      {isLoading ? (
        <Paper withBorder radius="xl" p="xl">
          <Group justify="center" gap="sm">
            <Loader color="blue" />
            <Text c="dimmed">Loading calendar...</Text>
          </Group>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="lg" verticalSpacing="lg">
          <Paper withBorder radius="xl" p="lg" style={{ gridColumn: 'span 2' }}>
            <Stack gap="md">
              {view === 'day' ? (
                <Paper withBorder radius="lg" p="md" data-testid="calendar-day-grid">
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start" wrap="wrap">
                      <Stack gap={2}>
                        <Text fw={700}>Daily schedule</Text>
                        <Text size="sm" c="dimmed">
                          Scan today&apos;s commitments and open slots before you schedule the next visit.
                        </Text>
                      </Stack>
                      <Badge color="blue" variant="light">
                        {selectedDayItems.length} event{selectedDayItems.length === 1 ? '' : 's'}
                      </Badge>
                    </Group>

                    <Box style={{ overflowX: 'auto' }}>
                      <Box
                        data-testid="calendar-time-grid"
                        style={{
                          minWidth: 360,
                          display: 'grid',
                          gridTemplateColumns: '88px minmax(260px, 1fr)',
                          rowGap: 0,
                        }}
                      >
                        <Box />
                        {timeGridDays.map((day) => {
                          const dayKey = formatDayKey(day);
                          const items = itemsByDay.get(dayKey) ?? [];
                          const placements = timeGridPlacementsByDay.get(dayKey) ?? [];

                          return (
                            <Paper
                              key={dayKey}
                              radius="md"
                              p="sm"
                              withBorder
                              style={{
                                background: isSameDay(day, new Date()) ? 'rgba(239, 246, 255, 0.92)' : '#fff',
                              }}
                            >
                              <Group justify="space-between" align="center">
                                <Stack gap={0}>
                                  <Text size="xs" c="dimmed" tt="uppercase">{formatWeekdayLabel(day)}</Text>
                                  <Text fw={700}>{formatMonthDayLabel(day)}</Text>
                                </Stack>
                                {isSameDay(day, new Date()) ? (
                                  <Badge color="blue" variant="light">Today</Badge>
                                ) : (
                                  <Text size="xs" c="dimmed">{items.length} event{items.length === 1 ? '' : 's'}</Text>
                                )}
                              </Group>
                            </Paper>
                          );
                        })}

                        <Stack gap={0} style={{ paddingTop: 8 }}>
                          {timeGridHours.map((hour) => {
                            const labelDate = new Date(anchorDate);
                            labelDate.setHours(hour, 0, 0, 0);
                            return (
                              <Box
                                key={`time-label-${hour}`}
                                style={{
                                  height: TIME_GRID_ROW_HEIGHT,
                                  paddingTop: 4,
                                  borderTop: '1px solid rgba(226, 232, 240, 0.95)',
                                }}
                              >
                                <Text size="xs" c="dimmed">{formatTime(labelDate)}</Text>
                              </Box>
                            );
                          })}
                        </Stack>

                        {timeGridDays.map((day) => {
                          const dayKey = formatDayKey(day);
                          const placements = timeGridPlacementsByDay.get(dayKey) ?? [];

                          return (
                            <Box
                              key={`grid-${dayKey}`}
                              style={{
                                position: 'relative',
                                height: timeGridHeight,
                                borderLeft: '1px solid rgba(226, 232, 240, 0.95)',
                                borderRight: '1px solid rgba(226, 232, 240, 0.95)',
                                borderBottom: '1px solid rgba(226, 232, 240, 0.95)',
                                background: isSameDay(day, new Date()) ? 'rgba(248, 250, 252, 0.85)' : '#fff',
                              }}
                            >
                              {timeGridHours.map((hour) => {
                                const slotDate = new Date(day);
                                slotDate.setHours(hour, 0, 0, 0);
                                return (
                                  <Box
                                    key={`slot-${dayKey}-${hour}`}
                                    component="div"
                                    data-testid="calendar-open-slot"
                                    role="button"
                                    aria-label={`Open ${formatTime(slotDate)} slot for ${formatWeekday(day)}`}
                                    tabIndex={0}
                                    onClick={() => openSchedulerForDate(slotDate)}
                                    onKeyDown={(event) => {
                                      if (isActivationKey(event.key)) {
                                        event.preventDefault();
                                        openSchedulerForDate(slotDate);
                                      }
                                    }}
                                    style={{
                                      display: 'block',
                                      width: '100%',
                                      height: TIME_GRID_ROW_HEIGHT,
                                      border: 0,
                                      borderTop: '1px solid rgba(226, 232, 240, 0.95)',
                                      background: 'transparent',
                                      cursor: 'pointer',
                                    }}
                                  />
                                );
                              })}

                              <Box style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                                {placements.map((placement) => {
                                  const meta = getEventMeta(placement.item.eventType);
                                  const leftPercent = (placement.laneIndex / placement.laneCount) * 100;
                                  const widthPercent = 100 / placement.laneCount;
                                  const endsAt = resolveEventEnd(placement.item);

                                  return (
                                    <Box
                                      key={placement.item.id}
                                      component="div"
                                      tabIndex={0}
                                      onClick={() => setSelectedEventId(placement.item.id)}
                                      onKeyDown={(event) => {
                                        if (isActivationKey(event.key)) {
                                          event.preventDefault();
                                          setSelectedEventId(placement.item.id);
                                        }
                                      }}
                                      style={{
                                        position: 'absolute',
                                        top: placement.top,
                                        left: `calc(${leftPercent}% + 4px)`,
                                        width: `calc(${widthPercent}% - 8px)`,
                                        height: placement.height,
                                        borderRadius: 12,
                                        border: selectedEvent?.id === placement.item.id
                                          ? '2px solid rgba(59, 130, 246, 0.95)'
                                          : `1px solid color-mix(in srgb, var(--mantine-color-${meta.color}-6) 45%, white)`,
                                        background: `color-mix(in srgb, var(--mantine-color-${meta.color}-1) 85%, white)`,
                                        boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
                                        padding: '8px 10px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        overflow: 'hidden',
                                        pointerEvents: 'auto',
                                      }}
                                    >
                                      <Text size="xs" fw={700} c={`${meta.color}.7`}>
                                        {formatTime(placement.item.startsAt)} - {formatTime(endsAt)}
                                      </Text>
                                      <Text size="sm" fw={700} lineClamp={placement.height < 64 ? 1 : 2}>
                                        {placement.item.title}
                                      </Text>
                                      {placement.height >= 72 ? (
                                        <Text size="xs" c="dimmed" lineClamp={1}>
                                          {placement.item.assignedToName
                                            ?? placement.item.contactName
                                            ?? placement.item.accountName
                                            ?? placement.item.leadName
                                            ?? 'Pulse activity'}
                                        </Text>
                                      ) : null}
                                    </Box>
                                  );
                                })}
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  </Stack>
                </Paper>
              ) : null}

              {view === 'month' ? (
                <>
                  <SimpleGrid cols={7} spacing="xs">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <Text key={day} fw={700} size="sm" ta="center" c="dimmed">
                        {day}
                      </Text>
                    ))}
                  </SimpleGrid>
                  <SimpleGrid cols={7} spacing="xs">
                    {monthCells.map((day) => {
                      const key = formatDayKey(day);
                      const items = itemsByDay.get(key) ?? [];
                      const inCurrentMonth = day.getMonth() === anchorDate.getMonth();

                      return (
                        <Card
                          key={key}
                          withBorder
                          radius="lg"
                          p="xs"
                          onClick={() => openSchedulerForDate(day)}
                          onKeyDown={(event) => {
                            if (isActivationKey(event.key)) {
                              event.preventDefault();
                              openSchedulerForDate(day);
                            }
                          }}
                          tabIndex={0}
                          style={{
                            minHeight: 140,
                            background: inCurrentMonth ? undefined : 'rgba(248, 250, 252, 0.7)',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <Stack gap={6}>
                            <Group justify="space-between" align="center">
                              <Text fw={700} size="sm" {...(!inCurrentMonth ? { c: 'dimmed' as const } : {})}>
                                {day.getDate()}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {items.length === 0 ? 'Open' : `${items.length} evt`}
                              </Text>
                            </Group>
                            {items.slice(0, 3).map((item) => {
                              const meta = getEventMeta(item.eventType);
                              return (
                                <Box
                                  key={item.id}
                                  component="div"
                                  tabIndex={0}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedEventId(item.id);
                                  }}
                                  onKeyDown={(event) => {
                                    if (isActivationKey(event.key)) {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      setSelectedEventId(item.id);
                                    }
                                  }}
                                  style={{
                                    border: '1px solid rgba(191, 219, 254, 0.9)',
                                    borderRadius: 10,
                                    padding: '8px 10px',
                                    textAlign: 'left',
                                    background: selectedEvent?.id === item.id ? 'rgba(239, 246, 255, 0.95)' : '#fff',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Group justify="space-between" gap="xs">
                                    <Text size="xs" fw={700} c={`${meta.color}.7`}>
                                      {meta.shortLabel}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      {formatTime(item.startsAt)}
                                    </Text>
                                  </Group>
                                  <Text size="xs" lineClamp={2}>
                                    {item.title}
                                  </Text>
                                </Box>
                              );
                            })}
                            {items.length > 3 ? (
                              <Text size="xs" c="dimmed">
                                +{items.length - 3} more
                              </Text>
                            ) : null}
                          </Stack>
                        </Card>
                      );
                    })}
                  </SimpleGrid>
                </>
              ) : null}

              {view === 'week' ? (
                <Paper withBorder radius="lg" p="md" data-testid="calendar-week-grid">
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start" wrap="wrap">
                      <Stack gap={2}>
                        <Text fw={700}>Week schedule</Text>
                        <Text size="sm" c="dimmed">
                          A proper weekly time grid so overlap, gaps, and open slots are readable at a glance.
                        </Text>
                      </Stack>
                      <Badge color="blue" variant="light">
                        {filteredItems.length} event{filteredItems.length === 1 ? '' : 's'} in range
                      </Badge>
                    </Group>

                    <Box style={{ overflowX: 'auto' }}>
                      <Box
                        data-testid="calendar-time-grid"
                        style={{
                          minWidth: 980,
                          display: 'grid',
                          gridTemplateColumns: `88px repeat(${timeGridDays.length}, minmax(120px, 1fr))`,
                          rowGap: 0,
                        }}
                      >
                        <Box />
                        {timeGridDays.map((day) => {
                          const dayKey = formatDayKey(day);
                          const items = itemsByDay.get(dayKey) ?? [];

                          return (
                            <Paper
                              key={dayKey}
                              radius="md"
                              p="sm"
                              withBorder
                              style={{
                                background: isSameDay(day, new Date()) ? 'rgba(239, 246, 255, 0.92)' : '#fff',
                              }}
                            >
                              <Stack gap={0} align="center">
                                <Text size="xs" c="dimmed" tt="uppercase">{formatWeekdayLabel(day)}</Text>
                                <Text fw={700}>{day.getDate()}</Text>
                                <Text size="xs" c="dimmed">{items.length} event{items.length === 1 ? '' : 's'}</Text>
                              </Stack>
                            </Paper>
                          );
                        })}

                        <Stack gap={0} style={{ paddingTop: 8 }}>
                          {timeGridHours.map((hour) => {
                            const labelDate = new Date(anchorDate);
                            labelDate.setHours(hour, 0, 0, 0);
                            return (
                              <Box
                                key={`week-time-label-${hour}`}
                                style={{
                                  height: TIME_GRID_ROW_HEIGHT,
                                  paddingTop: 4,
                                  borderTop: '1px solid rgba(226, 232, 240, 0.95)',
                                }}
                              >
                                <Text size="xs" c="dimmed">{formatTime(labelDate)}</Text>
                              </Box>
                            );
                          })}
                        </Stack>

                        {timeGridDays.map((day) => {
                          const dayKey = formatDayKey(day);
                          const placements = timeGridPlacementsByDay.get(dayKey) ?? [];

                          return (
                            <Box
                              key={`week-grid-${dayKey}`}
                              style={{
                                position: 'relative',
                                height: timeGridHeight,
                                borderLeft: '1px solid rgba(226, 232, 240, 0.95)',
                                borderRight: '1px solid rgba(226, 232, 240, 0.95)',
                                borderBottom: '1px solid rgba(226, 232, 240, 0.95)',
                                background: isSameDay(day, new Date()) ? 'rgba(248, 250, 252, 0.85)' : '#fff',
                              }}
                            >
                              {timeGridHours.map((hour) => {
                                const slotDate = new Date(day);
                                slotDate.setHours(hour, 0, 0, 0);
                                return (
                                  <Box
                                    key={`week-slot-${dayKey}-${hour}`}
                                    component="div"
                                    data-testid="calendar-open-slot"
                                    role="button"
                                    aria-label={`Open ${formatTime(slotDate)} slot for ${formatWeekday(day)}`}
                                    tabIndex={0}
                                    onClick={() => openSchedulerForDate(slotDate)}
                                    onKeyDown={(event) => {
                                      if (isActivationKey(event.key)) {
                                        event.preventDefault();
                                        openSchedulerForDate(slotDate);
                                      }
                                    }}
                                    style={{
                                      display: 'block',
                                      width: '100%',
                                      height: TIME_GRID_ROW_HEIGHT,
                                      border: 0,
                                      borderTop: '1px solid rgba(226, 232, 240, 0.95)',
                                      background: 'transparent',
                                      cursor: 'pointer',
                                    }}
                                  />
                                );
                              })}

                              <Box style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                                {placements.map((placement) => {
                                  const meta = getEventMeta(placement.item.eventType);
                                  const leftPercent = (placement.laneIndex / placement.laneCount) * 100;
                                  const widthPercent = 100 / placement.laneCount;
                                  const endsAt = resolveEventEnd(placement.item);

                                  return (
                                    <Box
                                      key={placement.item.id}
                                      component="div"
                                      tabIndex={0}
                                      onClick={() => setSelectedEventId(placement.item.id)}
                                      onKeyDown={(event) => {
                                        if (isActivationKey(event.key)) {
                                          event.preventDefault();
                                          setSelectedEventId(placement.item.id);
                                        }
                                      }}
                                      style={{
                                        position: 'absolute',
                                        top: placement.top,
                                        left: `calc(${leftPercent}% + 4px)`,
                                        width: `calc(${widthPercent}% - 8px)`,
                                        height: placement.height,
                                        borderRadius: 12,
                                        border: selectedEvent?.id === placement.item.id
                                          ? '2px solid rgba(59, 130, 246, 0.95)'
                                          : `1px solid color-mix(in srgb, var(--mantine-color-${meta.color}-6) 45%, white)`,
                                        background: `color-mix(in srgb, var(--mantine-color-${meta.color}-1) 85%, white)`,
                                        boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
                                        padding: '8px 10px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        overflow: 'hidden',
                                        pointerEvents: 'auto',
                                      }}
                                    >
                                      <Text size="xs" fw={700} c={`${meta.color}.7`}>
                                        {formatTime(placement.item.startsAt)}
                                      </Text>
                                      <Text size="sm" fw={700} lineClamp={placement.height < 60 ? 1 : 2}>
                                        {placement.item.title}
                                      </Text>
                                      {placement.height >= 72 ? (
                                        <Text size="xs" c="dimmed" lineClamp={1}>
                                          {formatTime(placement.item.startsAt)} - {formatTime(endsAt)}
                                        </Text>
                                      ) : null}
                                    </Box>
                                  );
                                })}
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  </Stack>
                </Paper>
              ) : null}

              {view === 'list' ? (
                <WorkbenchTable<CalendarEventSummary>
                  ariaLabel="Calendar list view"
                  rows={filteredItems}
                  getRowKey={(item) => item.id}
                  minWidth={900}
                  withContainer={false}
                  onRowClick={(item) => setSelectedEventId(item.id)}
                  columns={[
                    {
                      key: 'when',
                      header: 'When',
                      render: (item) => formatDateTime(item.startsAt),
                    },
                    {
                      key: 'type',
                      header: 'Type',
                      render: (item) => {
                        const meta = getEventMeta(item.eventType);
                        return (
                          <Badge color={meta.color} variant="light">
                            {meta.label}
                          </Badge>
                        );
                      },
                    },
                    {
                      key: 'title',
                      header: 'Title',
                      render: (item) => <Text fw={700}>{item.title}</Text>,
                    },
                    {
                      key: 'owner',
                      header: 'Owner',
                      render: (item) => item.assignedToName ?? item.contactName ?? 'Unassigned',
                    },
                    {
                      key: 'linked-record',
                      header: 'Linked record',
                      render: (item) => item.accountName ?? item.leadName ?? item.locationName ?? 'Linked record',
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (item) => (
                        <Badge color={getStatusColor(item.status)} variant="dot">
                          {normalizeStatusLabel(item.status)}
                        </Badge>
                      ),
                    },
                  ]}
                  emptyState={(
                    <EmptyStateMessage
                      kind="filtered-out"
                      title="No events match this list"
                      description="Try another date range or filter, or schedule discovery/training work from the calendar."
                    />
                  )}
                />
              ) : null}

              {!isLoading && filteredItems.length === 0 ? (
                <EmptyStateMessage
                  kind="filtered-out"
                  title="No events in this range"
                  description="Try another date range or filter, or schedule discovery/training activity from the calendar."
                />
              ) : null}
            </Stack>
          </Paper>

          {selectedEvent ? (
            <WorkbenchDetailRail
              title="Event detail"
              description="The selected event, its linked record, and optional calendar handoff."
              actions={(
                <Badge color={getStatusColor(selectedEvent.status)} variant="light">
                  {normalizeStatusLabel(selectedEvent.status)}
                </Badge>
              )}
            >
              <Stack gap="md">
                <Stack gap={6}>
                  <Group gap="xs">
                    <ThemeIcon variant="light" color={getEventMeta(selectedEvent.eventType).color}>
                      {(() => {
                        const Icon = getEventMeta(selectedEvent.eventType).icon;
                        return <Icon size={16} />;
                      })()}
                    </ThemeIcon>
                    <Text fw={700}>{selectedEvent.title}</Text>
                  </Group>
                  <Group gap="xs">
                    <Badge color={getEventMeta(selectedEvent.eventType).color} variant="light">
                      {getEventMeta(selectedEvent.eventType).label}
                    </Badge>
                    <Badge color="gray" variant="light">
                      {selectedEvent.assignedToName ?? selectedEvent.contactName ?? 'Unassigned'}
                    </Badge>
                  </Group>
                </Stack>

                <Stack gap="xs">
                  <Group gap="xs" align="flex-start">
                    <IconClock size={16} />
                    <Stack gap={0}>
                      <Text size="sm" fw={600}>Starts</Text>
                      <Text size="sm" c="dimmed">{formatDateTime(selectedEvent.startsAt)}</Text>
                    </Stack>
                  </Group>
                  {selectedEvent.endsAt ? (
                    <Group gap="xs" align="flex-start">
                      <IconClock size={16} />
                      <Stack gap={0}>
                        <Text size="sm" fw={600}>Ends</Text>
                        <Text size="sm" c="dimmed">{formatDateTime(selectedEvent.endsAt)}</Text>
                      </Stack>
                    </Group>
                  ) : null}
                </Stack>

                <Button component={Link} href={selectedEvent.sourcePath} rightSection={<IconArrowRight size={16} />}>
                  Open linked record
                </Button>

                <WorkbenchAdvancedSection
                  title="More event details"
                  description="Contact, location, notes, and optional Outlook handoff."
                >
                  <Stack gap="md">
                    <Stack gap="xs">
                      <DetailRow label="Contact" value={selectedEvent.contactName} />
                      <DetailRow label="Email" value={selectedEvent.contactEmail} />
                      <DetailRow label="Account" value={selectedEvent.accountName} />
                      <DetailRow label="Lead" value={selectedEvent.leadName} />
                      <DetailRow label="Location" value={selectedEvent.locationName} />
                      <DetailRow label="Territory" value={selectedEvent.territoryName} />
                      <DetailRow label="Region" value={selectedEvent.regionName} />
                    </Stack>

                    {selectedEvent.notes ? (
                      <Stack gap={4}>
                        <Text fw={600} size="sm">Notes</Text>
                        <Text size="sm" c="dimmed">{selectedEvent.notes}</Text>
                      </Stack>
                    ) : null}

                    {outlookConnection?.isConfigured ? (
                      <Stack gap="xs">
                        <Text fw={600} size="sm">Outlook sync</Text>
                        {outlookConnection.isConnected ? (
                          <>
                            {selectedEvent.sourceModule === 'leads' || selectedEvent.sourceModule === 'training' ? (
                              <Group gap="xs">
                                <Button
                                  leftSection={<IconRefresh size={16} />}
                                  loading={isSyncingOutlookEvent}
                                  onClick={() => void handleSyncSelectedEvent()}
                                >
                                  {selectedEvent.outlookSync?.syncedAt ? 'Update in Outlook' : 'Sync to Outlook'}
                                </Button>
                                {selectedEvent.outlookSync?.externalWebLink ? (
                                  <Button
                                    component="a"
                                    href={selectedEvent.outlookSync.externalWebLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    variant="light"
                                    leftSection={<IconExternalLink size={16} />}
                                  >
                                    Open in Outlook
                                  </Button>
                                ) : null}
                                {selectedEvent.outlookSync?.meetingJoinUrl ? (
                                  <Button
                                    component="a"
                                    href={selectedEvent.outlookSync.meetingJoinUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    variant="light"
                                    color="violet"
                                    leftSection={<IconExternalLink size={16} />}
                                  >
                                    Open meeting link
                                  </Button>
                                ) : null}
                              </Group>
                            ) : (
                              <Text size="sm" c="dimmed">
                                This linked event is reviewed in Pulse. Outlook sync is currently available for discovery and training schedules.
                              </Text>
                            )}
                            {selectedEvent.sourceModule === 'leads' || selectedEvent.sourceModule === 'training' ? (
                              <>
                                {selectedEvent.outlookSync?.syncedAt ? (
                                  <Text size="sm" c="dimmed">
                                    Last synced: {formatDateTime(selectedEvent.outlookSync.syncedAt)}
                                  </Text>
                                ) : (
                                  <Text size="sm" c="dimmed">
                                    This event has not been pushed to Outlook yet. Once synced, future lead/training schedule changes keep Outlook current.
                                  </Text>
                                )}
                                {selectedEvent.outlookSync?.lastSyncError ? (
                                  <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                                    {selectedEvent.outlookSync.lastSyncError}
                                  </Alert>
                                ) : null}
                              </>
                            ) : null}
                          </>
                        ) : (
                          <Group justify="space-between" align="center">
                            <Text size="sm" c="dimmed">
                              Outlook rollout and mailbox setup are managed in Admin. This keeps scheduling simple for daily users.
                            </Text>
                            {canViewCalendarIntegrations ? (
                              <Button
                                component={Link}
                                href="/admin/integrations"
                                variant="light"
                                leftSection={<IconSettings size={16} />}
                              >
                                Open Admin setup
                              </Button>
                            ) : null}
                          </Group>
                        )}
                      </Stack>
                    ) : null}
                  </Stack>
                </WorkbenchAdvancedSection>
              </Stack>
            </WorkbenchDetailRail>
          ) : (
            <WorkbenchAttentionPanel
              title="Day health"
              description="Schedule items that are most likely to affect today's work."
              items={calendarAttentionItems}
              emptyState="No scheduled work needs attention right now."
            />
          )}
        </SimpleGrid>
      )}

      <CalendarSchedulerModal
        opened={Boolean(schedulerAnchorDate)}
        onClose={() => setSchedulerAnchorDate(null)}
        anchorDate={schedulerAnchorDate}
        apiBaseUrl={apiBaseUrl}
        accessToken={accessToken}
        canScheduleDiscovery={canScheduleDiscovery}
        canScheduleTraining={canScheduleTraining}
        onSaved={loadWorkspace}
      />
    </Stack>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }

  return (
    <Group justify="space-between" align="flex-start" gap="sm">
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="sm" ta="right" maw={220}>{value}</Text>
    </Group>
  );
}
