import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import type { CalendarEventSummary, CalendarWorkspaceResponse } from '@pulse/contracts/calendar';
import { Card, EmptyState, ErrorState, HeroCard, LoadingState, NativeIcon, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { fetchCalendarWorkspace } from '@/lib/api';
import { humanize } from '@/lib/format';
import { useSession } from '@/providers/session-provider';
import { colors, radius, spacing, typography } from '@/theme';

const RANGE_DAYS = 14;

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function formatDayHeading(key: string) {
  const date = new Date(`${key}T12:00:00`);
  const today = dayKey(new Date().toISOString());
  const tomorrow = dayKey(new Date(Date.now() + 86400000).toISOString());
  const label = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  if (key === today) return `Today · ${label}`;
  if (key === tomorrow) return `Tomorrow · ${label}`;
  return label;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function CalendarScreen() {
  const { apiBaseUrl, auth } = useSession();
  const [workspace, setWorkspace] = useState<CalendarWorkspaceResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!auth) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const start = new Date();
      const end = new Date(start.getTime() + RANGE_DAYS * 86400000);
      const response = await fetchCalendarWorkspace(apiBaseUrl, auth.tokens.accessToken, {
        startDate: toDateInput(start),
        endDate: toDateInput(end),
      });
      setWorkspace(response);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load the calendar.');
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const eventsByDay = useMemo(() => {
    const groups = new Map<string, CalendarEventSummary[]>();
    for (const event of workspace?.items ?? []) {
      const key = dayKey(event.startsAt);
      const existing = groups.get(key);
      if (existing) {
        existing.push(event);
      } else {
        groups.set(key, [event]);
      }
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [workspace]);

  const outlook = workspace?.outlookConnection;

  return (
    <Screen>
      <HeroCard title="Calendar" eyebrow="Field schedule" icon={{ name: 'calendar', fallback: 'C' }}>
        <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
          Your next {RANGE_DAYS} days across training, discovery, visits, and audits — with Outlook
          sync status on every event.
        </Text>
      </HeroCard>

      {outlook ? (
        <Card style={{ backgroundColor: outlook.isConnected ? colors.successSoft : colors.surfaceMuted }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <NativeIcon
              name={outlook.isConnected ? 'checkmark.seal.fill' : 'arrow.triangle.2.circlepath'}
              fallback="O"
              color={outlook.isConnected ? colors.success : colors.muted}
            />
            <Text selectable style={{ ...typography.subtitle, color: outlook.isConnected ? colors.success : colors.text, flex: 1 }}>
              {outlook.isConnected ? 'Outlook connected' : 'Outlook not connected'}
            </Text>
          </View>
          <Text selectable style={{ ...typography.caption, color: colors.muted }}>
            {outlook.isConnected
              ? `${outlook.connectionEmail ?? 'Connected account'}${outlook.targetCalendarName ? ` · ${outlook.targetCalendarName}` : ''}${outlook.lastSyncedAt ? ` · last synced ${formatTime(outlook.lastSyncedAt)}` : ''}`
              : outlook.availabilityMessage ?? 'Connect Outlook from the Pulse web calendar to mirror CRM events into your mailbox calendar.'}
          </Text>
          {outlook.lastSyncError ? (
            <Text selectable style={{ ...typography.caption, color: colors.danger }}>
              Last sync error: {outlook.lastSyncError}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            label="Schedule training"
            icon={{ name: 'plus.circle.fill', fallback: '+' }}
            onPress={() => router.push('/training')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SecondaryButton label="Refresh" icon={{ name: 'arrow.clockwise', fallback: 'R' }} onPress={() => void load()} />
        </View>
      </View>
      <Text selectable style={{ ...typography.caption, color: colors.muted }}>
        Scheduling here creates the CRM event and pushes it to Outlook when sync is connected — the
        direction agreed in discovery (CRM → Outlook).
      </Text>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading && !workspace ? <LoadingState label="Loading your schedule..." /> : null}

      {!isLoading && eventsByDay.length === 0 && !errorMessage ? (
        <EmptyState
          title="No scheduled events"
          detail={`Nothing on the books for the next ${RANGE_DAYS} days. Schedule a training session or check back after the office adds events.`}
        />
      ) : null}

      {eventsByDay.map(([key, events]) => (
        <View key={key} style={{ gap: spacing.md }}>
          <SectionTitle title={formatDayHeading(key)} detail={`${events.length} event${events.length === 1 ? '' : 's'}`} />
          {events.map((event) => (
            <Card key={event.id}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                <View style={{ minWidth: 74, gap: 2 }}>
                  <Text selectable style={{ ...typography.subtitle, color: colors.primary, fontVariant: ['tabular-nums'] }}>
                    {formatTime(event.startsAt)}
                  </Text>
                  {event.endsAt ? (
                    <Text selectable style={{ ...typography.caption, color: colors.subtle, fontVariant: ['tabular-nums'] }}>
                      to {formatTime(event.endsAt)}
                    </Text>
                  ) : null}
                </View>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
                    {event.title}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    <Pill label={humanize(event.eventType)} tone={event.status} />
                    {event.status !== 'scheduled' ? <Pill label={humanize(event.status)} tone={event.status} /> : null}
                  </View>
                  {event.accountName || event.leadName ? (
                    <Text selectable style={{ ...typography.caption, color: colors.muted }}>
                      {event.accountName ?? event.leadName}
                      {event.locationName ? ` · ${event.locationName}` : ''}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: radius.full,
                        backgroundColor: event.outlookSync?.lastSyncError
                          ? colors.danger
                          : event.outlookSync?.syncedAt
                            ? colors.success
                            : colors.subtle,
                      }}
                    />
                    <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
                      {event.outlookSync?.lastSyncError
                        ? 'Outlook sync error'
                        : event.outlookSync?.syncedAt
                          ? 'Synced to Outlook'
                          : 'Not synced to Outlook'}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          ))}
        </View>
      ))}
    </Screen>
  );
}
