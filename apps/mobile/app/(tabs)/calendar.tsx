import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { CalendarEventSummary, CalendarWorkspaceResponse } from '@pulse/contracts/calendar';
import type { AccountSummary } from '@pulse/contracts/accounts';
import { Card, EmptyState, ErrorState, HeroCard, LoadingState, NativeIcon, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { createTrainingSessionRecord, fetchCalendarWorkspace } from '@/lib/api';
import { humanize } from '@/lib/format';
import { useFieldData } from '@/hooks/use-mobile-data';
import { useSession } from '@/providers/session-provider';
import { colors, radius, softShadow, spacing, typography } from '@/theme';

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
const DURATIONS = [30, 60, 90, 120];

function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isoDayKey(iso: string) {
  return dayKey(new Date(iso));
}

function monthMatrix(year: number, month: number) {
  // Weeks start Monday. Returns rows of 7 cells (Date or null for padding).
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (first.getDay() + 6) % 7;
  const cells: Array<Date | null> = [];
  for (let i = 0; i < leadingBlanks; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: Array<Array<Date | null>> = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatSelectedDay(key: string) {
  const date = new Date(`${key}T12:00:00`);
  const today = dayKey(new Date());
  const label = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  return key === today ? `Today · ${label}` : label;
}

export default function CalendarScreen() {
  const { apiBaseUrl, auth } = useSession();
  const { accounts } = useFieldData(100);
  const now = new Date();
  const [visibleYear, setVisibleYear] = useState(now.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(() => dayKey(now));
  const [workspace, setWorkspace] = useState<CalendarWorkspaceResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isScheduling, setIsScheduling] = useState(false);
  const [accountQuery, setAccountQuery] = useState('');
  const [scheduleAccount, setScheduleAccount] = useState<AccountSummary | null>(null);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleDuration, setScheduleDuration] = useState(60);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!auth) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const start = new Date(visibleYear, visibleMonth, 1);
      const end = new Date(visibleYear, visibleMonth + 1, 0);
      const response = await fetchCalendarWorkspace(apiBaseUrl, auth.tokens.accessToken, {
        startDate: dayKey(start),
        endDate: dayKey(end),
      });
      setWorkspace(response);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load the calendar.');
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, auth, visibleYear, visibleMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const eventsByDay = useMemo(() => {
    const groups = new Map<string, CalendarEventSummary[]>();
    for (const event of workspace?.items ?? []) {
      const key = isoDayKey(event.startsAt);
      const existing = groups.get(key);
      if (existing) {
        existing.push(event);
      } else {
        groups.set(key, [event]);
      }
    }
    for (const events of groups.values()) {
      events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    return groups;
  }, [workspace]);

  const selectedEvents = eventsByDay.get(selectedDay) ?? [];
  const laterThisMonth = useMemo(() => {
    return Array.from(eventsByDay.entries())
      .filter(([key]) => key > selectedDay)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [eventsByDay, selectedDay]);

  const matrix = useMemo(() => monthMatrix(visibleYear, visibleMonth), [visibleYear, visibleMonth]);
  const monthLabel = new Date(visibleYear, visibleMonth, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const todayKey = dayKey(new Date());

  function shiftMonth(delta: number) {
    const next = new Date(visibleYear, visibleMonth + delta, 1);
    setVisibleYear(next.getFullYear());
    setVisibleMonth(next.getMonth());
  }

  const slotIsPast = useCallback(
    (slot: string) => new Date(`${selectedDay}T${slot}:00`).getTime() <= Date.now(),
    [selectedDay],
  );

  function openScheduler() {
    setScheduleMessage(null);
    if (slotIsPast(scheduleTime)) {
      const nextSlot = TIME_SLOTS.find((slot) => !slotIsPast(slot));
      if (nextSlot) setScheduleTime(nextSlot);
    }
    setIsScheduling(true);
  }

  const filteredAccounts = useMemo(() => {
    const query = accountQuery.trim().toLowerCase();
    const pool = query
      ? accounts.filter((account) => account.displayName.toLowerCase().includes(query))
      : accounts;
    return pool.slice(0, 5);
  }, [accounts, accountQuery]);

  async function submitSchedule() {
    if (!auth || !scheduleAccount || scheduleBusy) return;
    setScheduleBusy(true);
    setScheduleMessage(null);
    try {
      const scheduledAt = new Date(`${selectedDay}T${scheduleTime}:00`).toISOString();
      await createTrainingSessionRecord(apiBaseUrl, auth.tokens.accessToken, scheduleAccount.id, {
        trainerUserId: auth.identity.userId,
        activityKind: 'training',
        title: `Training — ${scheduleAccount.displayName}`,
        scheduledAt,
        durationMinutes: scheduleDuration,
      });
      setScheduleMessage({ kind: 'success', text: `Scheduled for ${formatSelectedDay(selectedDay)} at ${scheduleTime}. It will push to Outlook once sync is connected.` });
      setIsScheduling(false);
      setScheduleAccount(null);
      setAccountQuery('');
      await load();
    } catch (error) {
      setScheduleMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Could not schedule the session.' });
    } finally {
      setScheduleBusy(false);
    }
  }

  const outlook = workspace?.outlookConnection;

  return (
    <Screen>
      <HeroCard title="Calendar" eyebrow="Field schedule" icon={{ name: 'calendar', fallback: 'C' }}>
        <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
          Tap a day to see its schedule or book training on the spot — every CRM event shows its
          Outlook sync status.
        </Text>
      </HeroCard>

      {/* Month grid */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => shiftMonth(-1)} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, transform: [{ scale: pressed ? 0.9 : 1 }] })}>
            <NativeIcon name="chevron.left" fallback="<" color={colors.primary} size={15} />
          </Pressable>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>{monthLabel}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => shiftMonth(1)} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, transform: [{ scale: pressed ? 0.9 : 1 }] })}>
            <NativeIcon name="chevron.right" fallback=">" color={colors.primary} size={15} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAY_LABELS.map((label, index) => (
            <Text key={`${label}-${index}`} style={{ flex: 1, textAlign: 'center', ...typography.caption, color: colors.subtle }}>
              {label}
            </Text>
          ))}
        </View>
        {matrix.map((week, weekIndex) => (
          <View key={weekIndex} style={{ flexDirection: 'row' }}>
            {week.map((date, cellIndex) => {
              if (!date) return <View key={cellIndex} style={{ flex: 1, minHeight: 44 }} />;
              const key = dayKey(date);
              const isSelected = key === selectedDay;
              const isToday = key === todayKey;
              const hasEvents = eventsByDay.has(key);
              return (
                <Pressable
                  key={cellIndex}
                  accessibilityRole="button"
                  accessibilityLabel={`${date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}${hasEvents ? ', has events' : ''}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelectedDay(key)}
                  style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelected ? colors.primary : 'transparent',
                      borderWidth: isToday && !isSelected ? 1.5 : 0,
                      borderColor: colors.primary,
                    }}
                  >
                    <Text style={{ ...typography.callout, fontWeight: isSelected || isToday ? '800' : '500', color: isSelected ? colors.white : colors.text, fontVariant: ['tabular-nums'] }}>
                      {date.getDate()}
                    </Text>
                  </View>
                  <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 2, backgroundColor: hasEvents ? (isSelected ? colors.primaryDeep : colors.primary) : 'transparent' }} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      {/* Outlook status */}
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
              : 'Events you schedule here are saved in Pulse now and will push to your Outlook calendar automatically once an admin connects Outlook from Pulse web.'}
          </Text>
          {outlook.lastSyncError ? (
            <Text selectable style={{ ...typography.caption, color: colors.danger }}>
              Last sync error: {outlook.lastSyncError}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {scheduleMessage ? (
        <Card style={{ backgroundColor: scheduleMessage.kind === 'success' ? colors.successSoft : colors.dangerSoft }}>
          <Text selectable style={{ ...typography.callout, color: scheduleMessage.kind === 'success' ? colors.success : colors.danger }}>
            {scheduleMessage.text}
          </Text>
        </Card>
      ) : null}

      {/* Selected day */}
      <SectionTitle
        title={formatSelectedDay(selectedDay)}
        detail={selectedEvents.length === 0 ? 'No events — book training below.' : `${selectedEvents.length} event${selectedEvents.length === 1 ? '' : 's'}`}
      />
      {selectedEvents.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}

      {/* Inline scheduling */}
      {isScheduling ? (
        <Card style={{ backgroundColor: colors.surfaceMuted }}>
          <SectionTitle title="Schedule training" detail={`On ${formatSelectedDay(selectedDay)} — change the day by tapping the calendar.`} />
          <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
            Account
          </Text>
          {scheduleAccount ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Pill label={scheduleAccount.displayName} tone="active" />
              </View>
              <SecondaryButton label="Change" onPress={() => setScheduleAccount(null)} />
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <TextInput
                value={accountQuery}
                onChangeText={setAccountQuery}
                placeholder="Search your accounts..."
                placeholderTextColor={colors.subtle}
                accessibilityLabel="Search accounts to schedule training"
                style={{ minHeight: 46, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text, ...typography.body }}
              />
              {filteredAccounts.map((account) => (
                <Pressable
                  key={account.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${account.displayName}`}
                  onPress={() => setScheduleAccount(account)}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderWidth: 1, borderColor: colors.border })}
                >
                  <NativeIcon name="building.2.fill" fallback="A" color={colors.primary} size={15} />
                  <Text style={{ ...typography.callout, color: colors.text }}>{account.displayName}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
            Start time
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {TIME_SLOTS.map((slot) => {
              const past = slotIsPast(slot);
              const selected = scheduleTime === slot;
              return (
                <Pressable
                  key={slot}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: past }}
                  disabled={past}
                  onPress={() => setScheduleTime(slot)}
                  style={{ paddingHorizontal: 12, minHeight: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.primary : past ? colors.surfacePressed : colors.surface, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, opacity: past ? 0.45 : 1 }}
                >
                  <Text style={{ ...typography.caption, color: selected ? colors.white : past ? colors.subtle : colors.text, fontVariant: ['tabular-nums'] }}>{slot}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
            Duration
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {DURATIONS.map((minutes) => (
              <Pressable
                key={minutes}
                accessibilityRole="button"
                accessibilityState={{ selected: scheduleDuration === minutes }}
                onPress={() => setScheduleDuration(minutes)}
                style={{ paddingHorizontal: 12, minHeight: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: scheduleDuration === minutes ? colors.primary : colors.surface, borderWidth: 1, borderColor: scheduleDuration === minutes ? colors.primary : colors.border }}
              >
                <Text style={{ ...typography.caption, color: scheduleDuration === minutes ? colors.white : colors.text, fontVariant: ['tabular-nums'] }}>{minutes} min</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Cancel" onPress={() => { setIsScheduling(false); setScheduleMessage(null); }} />
            </View>
            <View style={{ flex: 1.4 }}>
              <PrimaryButton
                label={scheduleBusy ? 'Scheduling...' : 'Schedule'}
                icon={{ name: 'checkmark.circle.fill', fallback: 'S' }}
                onPress={() => void submitSchedule()}
                disabled={!scheduleAccount || scheduleBusy}
              />
            </View>
          </View>
        </Card>
      ) : (
        <PrimaryButton
          label={`Schedule training · ${formatSelectedDay(selectedDay).replace(/^Today · /, '')}`}
          icon={{ name: 'plus.circle.fill', fallback: '+' }}
          onPress={openScheduler}
        />
      )}

      {isLoading && !workspace ? <LoadingState label="Loading your schedule..." /> : null}

      {/* Later this month */}
      {laterThisMonth.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Later this month" />
          {laterThisMonth.map(([key, events]) => (
            <View key={key} style={{ gap: spacing.md }}>
              <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
                {formatSelectedDay(key)}
              </Text>
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {!isLoading && selectedEvents.length === 0 && laterThisMonth.length === 0 && !errorMessage ? (
        <EmptyState title="Nothing scheduled this month" detail="Book a training session above — it lands here and pushes to Outlook once sync is connected." />
      ) : null}
    </Screen>
  );
}

function EventCard({ event }: { event: CalendarEventSummary }) {
  return (
    <Card>
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
  );
}
