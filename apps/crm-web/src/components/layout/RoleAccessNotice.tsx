'use client';

import Link from 'next/link';
import { Alert, Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { getAccessibleLandingTargets } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';

export function RoleAccessNotice({ pathname }: { pathname: string }) {
  const { auth } = usePulseSession();

  const landingPaths = auth
    ? getAccessibleLandingTargets(auth.identity.role)
    : [];

  return (
    <Paper withBorder radius="xl" p="xl" maw={860} mx="auto" my="xl">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={6}>
            <Title order={2}>Role-specific workspace access</Title>
            <Text c="dimmed" size="sm">
              This screen is not part of the current role scope. The production workspace uses the same role-aware access pattern as the approved prototype so each team only sees the workflow surfaces they own.
            </Text>
          </Stack>
          {auth ? (
            <Badge color="grape" variant="light">
              {auth.identity.role}
            </Badge>
          ) : null}
        </Group>

        <Alert color="blue" variant="light" icon={<IconLock size={16} />}>
          <Text size="sm">
            Requested route: <strong>{pathname}</strong>
          </Text>
        </Alert>

        <Stack gap="xs">
          <Text fw={700} size="sm">Accessible workspaces for this role</Text>
          {landingPaths.length ? (
            <Group gap="sm" wrap="wrap">
              {landingPaths.map((item) => (
                <Button key={item.href} component={Link} href={item.href} variant="light" size="xs">
                  {item.label}
                </Button>
              ))}
            </Group>
          ) : (
            <Text size="sm" c="dimmed">
              No additional routed workspace is live for this role yet.
            </Text>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
