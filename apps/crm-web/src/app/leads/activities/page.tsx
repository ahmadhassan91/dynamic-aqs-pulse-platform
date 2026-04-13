import Link from 'next/link';
import { Breadcrumbs, Stack, Text, Title } from '@mantine/core';
import ActivityManager from '@/components/leads/ActivityManager';

export default function LeadsWorkflowQueuePage() {
  return (
    <Stack gap="md">
      <Breadcrumbs>
        <Link href="/leads" style={{ color: 'var(--mantine-color-blue-6)', textDecoration: 'none' }}>
          Leads
        </Link>
        <Text>Workflow Queue</Text>
      </Breadcrumbs>

      <div>
        <Title order={1}>Workflow Queue</Title>
        <Text size="sm" c="dimmed">
          Workflow-driven queue derived from live lead stage, SLA, next required action, and recent operational history.
        </Text>
      </div>

      <ActivityManager />
    </Stack>
  );
}
