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
  Divider,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowRight,
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDeviceDesktop,
  IconExternalLink,
  IconLink,
  IconMapPin,
  IconPhoneCall,
  IconRefresh,
  IconSchool,
  IconTruckDelivery,
} from '@tabler/icons-react';
import type {
  CalendarEventSummary,
  CalendarEventTypeKey,
  CalendarMeetingProviderKey,
  CalendarOutlookCalendarSummary,
  CalendarWorkspaceResponse,
} from '@pulse/contracts';
import {
  disconnectCalendarOutlookConnection,
  fetchCalendarOutlookCalendars,
  fetchCalendarWorkspace,
  startCalendarOutlookConnection,
  syncCalendarOutlookEvent,
  updateCalendarOutlookConnection,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';
import { CalendarSchedulerModal } from './CalendarSchedulerModal';

type CalendarViewMode = 'month' | 'week' | 'list';
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

function getEventMeta(eventType: CalendarEventTypeKey) {
  return EVENT_TYPE_META[eventType];
}

function getStatusColor(status: CalendarEventSummary['status']) {
  return STATUS_COLORS[status];
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
  return date.toISOString().slice(0, 10);
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

function normalizeStatusLabel(value: CalendarEventSummary['status']) {
  return value.replace(/_/g, ' ');
}

function isActivationKey(key: string) {
  return key === 'Enter' || key === ' ';
}

function resolveRange(anchorDate: Date, view: CalendarViewMode) {
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

export function CalendarWorkspace() {
  const { auth, apiBaseUrl } = usePulseSession();
  const searchParams = useSearchParams();
  const accessToken = auth?.tokens.accessToken ?? '';
  const [view, setView] = useState<CalendarViewMode>('month');
  const [filter, setFilter] = useState<CalendarFilterMode>('all');
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [workspace, setWorkspace] = useState<CalendarWorkspaceResponse | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnectingOutlook, setIsConnectingOutlook] = useState(false);
  const [isDisconnectingOutlook, setIsDisconnectingOutlook] = useState(false);
  const [isSyncingOutlookEvent, setIsSyncingOutlookEvent] = useState(false);
  const [isLoadingOutlookCalendars, setIsLoadingOutlookCalendars] = useState(false);
  const [isUpdatingOutlookSettings, setIsUpdatingOutlookSettings] = useState(false);
  const [outlookCalendars, setOutlookCalendars] = useState<CalendarOutlookCalendarSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [outlookMessage, setOutlookMessage] = useState<string | null>(null);
  const [schedulerAnchorDate, setSchedulerAnchorDate] = useState<Date | null>(null);

  const range = useMemo(() => resolveRange(anchorDate, view), [anchorDate, view]);

  const openSchedulerForDate = useCallback((date: Date) => {
    setSchedulerAnchorDate(startOfDay(date));
  }, []);

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
        return response.items[0]?.id ?? null;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, apiBaseUrl, auth, range.end, range.start]);

  const loadOutlookCalendars = useCallback(async () => {
    if (!auth || !workspace?.outlookConnection?.isConnected) {
      setOutlookCalendars([]);
      return;
    }

    setIsLoadingOutlookCalendars(true);
    try {
      const response = await fetchCalendarOutlookCalendars(apiBaseUrl, accessToken);
      setOutlookCalendars(response.items);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingOutlookCalendars(false);
    }
  }, [accessToken, apiBaseUrl, auth, workspace?.outlookConnection?.isConnected]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    void loadOutlookCalendars();
  }, [loadOutlookCalendars]);

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
    () => (workspace?.items ?? []).filter((item) => filterEventItem(item, filter)),
    [filter, workspace?.items],
  );

  const selectedEvent = useMemo(
    () => filteredItems.find((item) => item.id === selectedEventId) ?? filteredItems[0] ?? null,
    [filteredItems, selectedEventId],
  );
  const outlookConnection = workspace?.outlookConnection;
  const selectedOutlookCalendarValue = outlookConnection?.targetCalendarId ?? '__primary__';

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

  const outlookCalendarOptions = useMemo(
    () => [
      { value: '__primary__', label: 'Primary mailbox calendar' },
      ...outlookCalendars.map((entry) => ({
        value: entry.id,
        label: entry.ownerName ? `${entry.name} (${entry.ownerName})` : entry.name,
      })),
    ],
    [outlookCalendars],
  );

  const selectedOutlookCalendar = useMemo(
    () => outlookCalendars.find((entry) => entry.id === outlookConnection?.targetCalendarId) ?? null,
    [outlookCalendars, outlookConnection?.targetCalendarId],
  );

  const monthCells = useMemo(() => buildMonthCells(anchorDate), [anchorDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(anchorDate), index)),
    [anchorDate],
  );

  const rangeLabel = useMemo(() => {
    if (view === 'month') {
      return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(anchorDate);
    }

    return `${formatDate(range.start)} - ${formatDate(range.end)}`;
  }, [anchorDate, range.end, range.start, view]);

  const handleStartOutlookConnect = useCallback(async () => {
    if (!auth) {
      return;
    }

    setIsConnectingOutlook(true);
    setErrorMessage(null);
    try {
      const response = await startCalendarOutlookConnection(apiBaseUrl, accessToken);
      window.location.assign(response.authorizationUrl);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsConnectingOutlook(false);
    }
  }, [accessToken, apiBaseUrl, auth]);

  const handleDisconnectOutlook = useCallback(async () => {
    if (!auth) {
      return;
    }

    setIsDisconnectingOutlook(true);
    setErrorMessage(null);
    try {
      await disconnectCalendarOutlookConnection(apiBaseUrl, accessToken);
      setOutlookMessage('Outlook calendar disconnected.');
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsDisconnectingOutlook(false);
    }
  }, [accessToken, apiBaseUrl, auth, loadWorkspace]);

  const handleOutlookCalendarChange = useCallback(async (value: string | null) => {
    if (!auth || !workspace?.outlookConnection?.isConnected) {
      return;
    }

    setIsUpdatingOutlookSettings(true);
    setErrorMessage(null);
    try {
      await updateCalendarOutlookConnection(apiBaseUrl, accessToken, {
        targetCalendarId: value && value !== '__primary__' ? value : null,
      });
      setOutlookMessage('Outlook calendar target updated.');
      await Promise.all([loadWorkspace(), loadOutlookCalendars()]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsUpdatingOutlookSettings(false);
    }
  }, [accessToken, apiBaseUrl, auth, loadOutlookCalendars, loadWorkspace, workspace?.outlookConnection?.isConnected]);

  const handleMeetingProviderChange = useCallback(async (value: string | null) => {
    if (!auth || !workspace?.outlookConnection?.isConnected || !value) {
      return;
    }

    setIsUpdatingOutlookSettings(true);
    setErrorMessage(null);
    try {
      await updateCalendarOutlookConnection(apiBaseUrl, accessToken, {
        meetingProvider: value as CalendarMeetingProviderKey,
      });
      setOutlookMessage('Outlook meeting-link preference updated.');
      await Promise.all([loadWorkspace(), loadOutlookCalendars()]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsUpdatingOutlookSettings(false);
    }
  }, [accessToken, apiBaseUrl, auth, loadOutlookCalendars, loadWorkspace, workspace?.outlookConnection?.isConnected]);

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
      <Paper withBorder radius="xl" p="xl">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" fw={700} c="blue.7" tt="uppercase">
                Pulse CRM / Calendar
              </Text>
              <Title order={1}>Centralized operating calendar</Title>
              <Text c="dimmed" maw={920}>
                One operational view for discovery calls, training sessions, field visits, and later audit activity.
                Pulse owns the workflow truth here; provider sync can reflect it later without becoming the source system.
              </Text>
            </Stack>
            <Group gap="sm">
              <Button component={Link} href="/leads" variant="light" rightSection={<IconArrowRight size={16} />}>
                Open lead workflow
              </Button>
              <Button component={Link} href="/training" rightSection={<IconArrowRight size={16} />}>
                Open training
              </Button>
            </Group>
          </Group>

          <SimpleGrid cols={{ base: 2, md: 5 }}>
            <Card withBorder radius="lg" p="md">
              <Text size="sm" c="dimmed">Scheduled</Text>
              <Title order={2}>{workspace?.summary.scheduledCount ?? 0}</Title>
            </Card>
            <Card withBorder radius="lg" p="md">
              <Text size="sm" c="dimmed">Completed</Text>
              <Title order={2}>{workspace?.summary.completedCount ?? 0}</Title>
            </Card>
            <Card withBorder radius="lg" p="md">
              <Text size="sm" c="dimmed">Discovery</Text>
              <Title order={2}>{workspace?.summary.discoveryCallCount ?? 0}</Title>
            </Card>
            <Card withBorder radius="lg" p="md">
              <Text size="sm" c="dimmed">Training</Text>
              <Title order={2}>
                {(workspace?.summary.virtualTrainingCount ?? 0) + (workspace?.summary.accountTrainingCount ?? 0)}
              </Title>
            </Card>
            <Card withBorder radius="lg" p="md">
              <Text size="sm" c="dimmed">Visits / Audits</Text>
              <Title order={2}>
                {(workspace?.summary.onSiteVisitCount ?? 0) + (workspace?.summary.consignmentAuditCount ?? 0)}
              </Title>
            </Card>
          </SimpleGrid>
        </Stack>
      </Paper>

      <Paper withBorder radius="xl" p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Button variant="subtle" onClick={() => setAnchorDate((current) => shiftAnchorDate(current, view, -1))}>
                <IconChevronLeft size={16} />
              </Button>
              <Button variant="subtle" onClick={() => setAnchorDate((current) => shiftAnchorDate(current, view, 1))}>
                <IconChevronRight size={16} />
              </Button>
              <Button variant="light" onClick={() => setAnchorDate(startOfDay(new Date()))}>
                Today
              </Button>
              <Text fw={700}>{rangeLabel}</Text>
            </Group>

            <Group gap="sm">
              <SegmentedControl
                value={filter}
                onChange={(value) => setFilter(value as CalendarFilterMode)}
                data={[
                  { value: 'all', label: 'All' },
                  { value: 'discovery', label: 'Discovery' },
                  { value: 'training', label: 'Training' },
                  { value: 'visits', label: 'Visits' },
                  { value: 'audits', label: 'Audits' },
                ]}
              />
              <SegmentedControl
                value={view}
                onChange={(value) => setView(value as CalendarViewMode)}
                data={[
                  { value: 'month', label: 'Month' },
                  { value: 'week', label: 'Week' },
                  { value: 'list', label: 'List' },
                ]}
              />
            </Group>
          </Group>

          <Alert color="blue" icon={<IconCalendarEvent size={16} />}>
            The centralized calendar now launches real discovery and training scheduling. Detailed execution,
            completion, and reporting still stay anchored to the owning lead and training workflows.
          </Alert>

          <Paper withBorder radius="lg" p="md">
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Text fw={700}>Outlook calendar sync</Text>
                  <Text size="sm" c="dimmed" maw={760}>
                    Connect your Outlook mailbox so the centralized Pulse calendar can reflect discovery and training
                    events into your working calendar without making Outlook the source of truth.
                  </Text>
                  {outlookConnection?.isConnected && outlookConnection.connectionEmail ? (
                    <Text size="sm" c="dimmed">
                      Connected mailbox: {outlookConnection.connectionEmail}
                    </Text>
                  ) : null}
                </Stack>
                <Group gap="xs">
                  {!outlookConnection?.isConfigured ? (
                    <Badge color="yellow" variant="light">
                      Outlook sync unavailable
                    </Badge>
                  ) : outlookConnection.isConnected ? (
                    <>
                      <Badge color="green" variant="light">
                        Connected
                      </Badge>
                      <Button
                        variant="light"
                        color="gray"
                        loading={isDisconnectingOutlook}
                        onClick={() => void handleDisconnectOutlook()}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      leftSection={<IconLink size={16} />}
                      loading={isConnectingOutlook}
                      onClick={() => void handleStartOutlookConnect()}
                    >
                      Connect Outlook
                    </Button>
                  )}
                </Group>
              </Group>

              {outlookConnection?.isConnected ? (
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <Select
                    label="Target Outlook calendar"
                    description="Use the primary mailbox calendar or choose another editable calendar this mailbox can write to."
                    data={outlookCalendarOptions}
                    value={selectedOutlookCalendarValue}
                    onChange={(value) => void handleOutlookCalendarChange(value)}
                    disabled={isLoadingOutlookCalendars || isUpdatingOutlookSettings}
                    rightSection={isLoadingOutlookCalendars ? <Loader size="xs" /> : undefined}
                  />
                  <Select
                    label="Meeting link preference"
                    description="Teams links are created only for remote-compatible event families such as discovery calls and virtual training."
                    data={[
                      { value: 'none', label: 'No auto meeting link' },
                      { value: 'teams', label: 'Microsoft Teams link' },
                    ]}
                    value={outlookConnection.meetingProvider ?? 'none'}
                    onChange={(value) => void handleMeetingProviderChange(value)}
                    disabled={isUpdatingOutlookSettings}
                  />
                </SimpleGrid>
              ) : null}

              {outlookConnection?.isConnected && selectedOutlookCalendar ? (
                <Alert color="blue" icon={<IconDeviceDesktop size={16} />}>
                  Target calendar: {selectedOutlookCalendar.name}
                  {selectedOutlookCalendar.ownerName ? ` (${selectedOutlookCalendar.ownerName})` : ''}
                  . Teams meeting links are {outlookConnection.meetingProvider === 'teams' ? 'enabled' : 'disabled'}.
                </Alert>
              ) : null}

              {!outlookConnection?.isConfigured ? (
                <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                  Microsoft sign-in can work independently from Outlook mailbox sync. This environment still needs the
                  Outlook sync configuration enabled before users can connect a working calendar.
                </Alert>
              ) : null}
            </Stack>
          </Paper>

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
            <Text c="dimmed">Loading centralized calendar...</Text>
          </Group>
        </Paper>
      ) : (
        <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="lg" verticalSpacing="lg">
          <Paper withBorder radius="xl" p="lg" style={{ gridColumn: 'span 2' }}>
            <Stack gap="md">
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
                          role="button"
                          tabIndex={0}
                          style={{
                            minHeight: 140,
                            background: inCurrentMonth ? undefined : 'rgba(248, 250, 252, 0.7)',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <Stack gap={6}>
                            <Text fw={700} size="sm" {...(!inCurrentMonth ? { c: 'dimmed' as const } : {})}>
                              {day.getDate()}
                            </Text>
                            {items.slice(0, 3).map((item) => {
                              const meta = getEventMeta(item.eventType);
                              return (
                                <Box
                                  key={item.id}
                                  component="button"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedEventId(item.id);
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
                                  <Text size="xs" fw={700} c={`${meta.color}.7`}>
                                    {meta.shortLabel}
                                  </Text>
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
                <SimpleGrid cols={{ base: 1, md: 2, xl: 7 }} spacing="sm">
                  {weekDays.map((day) => {
                    const key = formatDayKey(day);
                    const items = itemsByDay.get(key) ?? [];

                    return (
                      <Card
                        key={key}
                        withBorder
                        radius="lg"
                        p="sm"
                        onClick={() => openSchedulerForDate(day)}
                        onKeyDown={(event) => {
                          if (isActivationKey(event.key)) {
                            event.preventDefault();
                            openSchedulerForDate(day);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        style={{ minHeight: 220, cursor: 'pointer', textAlign: 'left' }}
                      >
                        <Stack gap="sm">
                          <Stack gap={0}>
                            <Text fw={700}>{formatWeekday(day)}</Text>
                            <Text size="xs" c="dimmed">{items.length} event{items.length === 1 ? '' : 's'}</Text>
                          </Stack>
                          {items.length === 0 ? (
                            <Text size="sm" c="dimmed">No scheduled activity. Click to open the scheduler.</Text>
                          ) : (
                            items.map((item) => {
                              const meta = getEventMeta(item.eventType);
                              return (
                                <Box
                                  key={item.id}
                                  component="button"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedEventId(item.id);
                                  }}
                                  style={{
                                    border: '1px solid rgba(226, 232, 240, 0.9)',
                                    borderRadius: 12,
                                    padding: '10px 12px',
                                    textAlign: 'left',
                                    background: selectedEvent?.id === item.id ? 'rgba(239, 246, 255, 0.95)' : '#fff',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Group justify="space-between" align="flex-start">
                                    <Badge color={meta.color} variant="light">
                                      {meta.label}
                                    </Badge>
                                    <Text size="xs" c="dimmed">{formatDateTime(item.startsAt)}</Text>
                                  </Group>
                                  <Text mt={6} fw={600} size="sm">
                                    {item.title}
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    {item.assignedToName ?? item.contactName ?? 'Unassigned'}
                                  </Text>
                                </Box>
                              );
                            })
                          )}
                        </Stack>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              ) : null}

              {view === 'list' ? (
                <Table.ScrollContainer minWidth={900}>
                  <Table highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>When</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Title</Table.Th>
                        <Table.Th>Owner</Table.Th>
                        <Table.Th>Customer / Lead</Table.Th>
                        <Table.Th>Status</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredItems.map((item) => {
                        const meta = getEventMeta(item.eventType);
                        return (
                          <Table.Tr
                            key={item.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedEventId(item.id)}
                          >
                            <Table.Td>{formatDateTime(item.startsAt)}</Table.Td>
                            <Table.Td>
                              <Badge color={meta.color} variant="light">
                                {meta.label}
                              </Badge>
                            </Table.Td>
                            <Table.Td>{item.title}</Table.Td>
                            <Table.Td>{item.assignedToName ?? item.contactName ?? 'Unassigned'}</Table.Td>
                            <Table.Td>{item.accountName ?? item.leadName ?? item.locationName ?? 'Linked record'}</Table.Td>
                            <Table.Td>
                              <Badge color={getStatusColor(item.status)} variant="dot">
                                {normalizeStatusLabel(item.status)}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              ) : null}

              {!isLoading && filteredItems.length === 0 ? (
                <Paper withBorder radius="lg" p="xl">
                  <Text fw={700}>No events in this range</Text>
                  <Text c="dimmed">
                    Try another date range or filter, or schedule discovery/training activity from the owning workflow.
                  </Text>
                </Paper>
              ) : null}
            </Stack>
          </Paper>

          <Paper withBorder radius="xl" p="lg">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Title order={3}>Event detail</Title>
                {selectedEvent ? (
                  <Badge color={getStatusColor(selectedEvent.status)} variant="light">
                    {normalizeStatusLabel(selectedEvent.status)}
                  </Badge>
                ) : null}
              </Group>

              {selectedEvent ? (
                <>
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
                    <Badge color={getEventMeta(selectedEvent.eventType).color} variant="light">
                      {getEventMeta(selectedEvent.eventType).label}
                    </Badge>
                  </Stack>

                  <Divider />

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
                    <DetailRow label="Assigned to" value={selectedEvent.assignedToName} />
                    <DetailRow label="Contact" value={selectedEvent.contactName} />
                    <DetailRow label="Email" value={selectedEvent.contactEmail} />
                    <DetailRow label="Account" value={selectedEvent.accountName} />
                    <DetailRow label="Lead" value={selectedEvent.leadName} />
                    <DetailRow label="Location" value={selectedEvent.locationName} />
                    <DetailRow label="Territory" value={selectedEvent.territoryName} />
                    <DetailRow label="Region" value={selectedEvent.regionName} />
                  </Stack>

                  {selectedEvent.notes ? (
                    <>
                      <Divider />
                      <Stack gap={4}>
                        <Text fw={600} size="sm">Notes</Text>
                        <Text size="sm" c="dimmed">{selectedEvent.notes}</Text>
                      </Stack>
                    </>
                  ) : null}

                  <Divider />

                  {outlookConnection?.isConfigured ? (
                    <>
                      <Stack gap="xs">
                        <Text fw={600} size="sm">Outlook sync</Text>
                        {outlookConnection.isConnected ? (
                          <>
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
                            {selectedEvent.outlookSync?.syncedAt ? (
                              <Text size="sm" c="dimmed">
                                Last synced: {formatDateTime(selectedEvent.outlookSync.syncedAt)}
                              </Text>
                            ) : (
                              <Text size="sm" c="dimmed">
                                This event has not been pushed to Outlook yet. Once synced, future lead/training schedule
                                changes will keep Outlook current automatically.
                              </Text>
                            )}
                            {selectedEvent.outlookSync?.meetingJoinUrl ? (
                              <Text size="sm" c="dimmed">
                                Pulse captured a live provider meeting link for this event.
                              </Text>
                            ) : null}
                            {selectedEvent.outlookSync?.lastSyncError ? (
                              <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                                {selectedEvent.outlookSync.lastSyncError}
                              </Alert>
                            ) : null}
                          </>
                        ) : (
                          <Group justify="space-between" align="center">
                            <Text size="sm" c="dimmed">
                              Connect Outlook to sync this event into your working calendar.
                            </Text>
                            <Button
                              variant="light"
                              leftSection={<IconLink size={16} />}
                              loading={isConnectingOutlook}
                              onClick={() => void handleStartOutlookConnect()}
                            >
                              Connect Outlook
                            </Button>
                          </Group>
                        )}
                      </Stack>
                      <Divider />
                    </>
                  ) : null}

                  <Button component={Link} href={selectedEvent.sourcePath} rightSection={<IconArrowRight size={16} />}>
                    Open source record
                  </Button>
                </>
              ) : (
                <Text c="dimmed">Select an event from the calendar to inspect the linked lead, account, or training context.</Text>
              )}
            </Stack>
          </Paper>
        </SimpleGrid>
      )}

      <CalendarSchedulerModal
        opened={Boolean(schedulerAnchorDate)}
        onClose={() => setSchedulerAnchorDate(null)}
        anchorDate={schedulerAnchorDate}
        apiBaseUrl={apiBaseUrl}
        accessToken={accessToken}
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
