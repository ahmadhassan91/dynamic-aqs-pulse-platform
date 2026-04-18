'use client';

import Link from 'next/link';
import {
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import type { CalendarEventSummary, CalendarEventTypeKey } from '@pulse/contracts';

const TERRITORY_CALENDAR_EVENT_META: Record<CalendarEventTypeKey, { label: string; color: string }> = {
  discovery_call: {
    label: 'Discovery Call',
    color: 'violet',
  },
  virtual_training: {
    label: 'Training Session',
    color: 'grape',
  },
  account_training: {
    label: 'Training Session',
    color: 'grape',
  },
  on_site_visit: {
    label: 'Site Visit',
    color: 'teal',
  },
  consignment_audit: {
    label: 'Consignment Audit',
    color: 'orange',
  },
};

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function buildSubtitle(item: CalendarEventSummary) {
  if (item.assignedToName) {
    return `TM: ${item.assignedToName}`;
  }

  if (item.territoryName) {
    return `Territory: ${item.territoryName}`;
  }

  if (item.accountName) {
    return `Account: ${item.accountName}`;
  }

  if (item.leadName) {
    return `Lead: ${item.leadName}`;
  }

  return item.sourceModule === 'training' ? 'Training workflow' : 'Calendar activity';
}

export function TerritoryCalendarFeed({
  items,
  isLoading = false,
}: {
  items: CalendarEventSummary[];
  isLoading?: boolean;
}) {
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600} size="sm" c="dark.6">Upcoming Visits, Training, and Audits</Text>
        <Button component={Link} href="/calendar" size="compact-sm" radius="xl" variant="light">
          Calendar View
        </Button>
      </Group>

      {isLoading ? (
        <Paper p="xl" withBorder radius="xl">
          <Center>
            <Loader size="sm" />
          </Center>
        </Paper>
      ) : null}

      {!isLoading ? (
        <Stack gap="sm">
          {items.length > 0 ? items.map((item) => {
            const meta = TERRITORY_CALENDAR_EVENT_META[item.eventType];
            return (
              <Paper key={item.id} p="md" withBorder radius="xl">
                <Group justify="space-between" align="center" gap="md" wrap="nowrap">
                  <Group gap="md" wrap="nowrap">
                    <Badge
                      size="lg"
                      radius="xl"
                      color={meta.color}
                      variant="light"
                      style={{ minWidth: 148, justifyContent: 'center' }}
                    >
                      {meta.label}
                    </Badge>
                    <Stack gap={2}>
                      <Text size="lg" fw={600}>{item.title}</Text>
                      <Text size="sm" c="dimmed">{buildSubtitle(item)}</Text>
                    </Stack>
                  </Group>
                  <Group gap="md" wrap="nowrap">
                    <Text size="lg" fw={500}>{formatDateLabel(item.startsAt)}</Text>
                    <Button component={Link} href={item.sourcePath} size="sm" variant="light" radius="xl">
                      Open
                    </Button>
                  </Group>
                </Group>
              </Paper>
            );
          }) : (
            <Paper p="md" withBorder radius="xl">
              <Text size="sm" c="dimmed">
                No upcoming visits, training sessions, or audits are currently scheduled.
              </Text>
            </Paper>
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}
