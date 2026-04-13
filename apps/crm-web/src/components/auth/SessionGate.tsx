'use client';

import { Alert, Button, Card, Group, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconAlertCircle, IconLock } from '@tabler/icons-react';
import { usePulseSession } from '@/lib/pulse-session';

export function SessionGate({
  title = 'Sign in to Pulse CRM',
  description = 'Use an internal Pulse account to continue into the live production workspace.',
}: {
  title?: string;
  description?: string;
}) {
  const {
    apiBaseUrl,
    authError,
    email,
    isLoggingIn,
    login,
    password,
    setApiBaseUrl,
    setEmail,
    setPassword,
  } = usePulseSession();

  return (
    <Card withBorder radius="xl" p="xl" maw={560} mx="auto" className="premium-hero-panel">
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2}>{title}</Title>
          <Text c="dimmed">{description}</Text>
        </Stack>

        <form onSubmit={login}>
          <Stack gap="md">
          <TextInput
            label="API base URL"
            value={apiBaseUrl}
            onChange={(event) => setApiBaseUrl(event.currentTarget.value)}
            placeholder="http://localhost:4000"
          />
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            placeholder="admin@pulse.local"
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            placeholder="Enter your Pulse password"
          />

          {authError ? (
            <Alert color="red" icon={<IconAlertCircle size={16} />} className="premium-subhero-panel">
              {authError}
            </Alert>
          ) : null}

          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              Sessions stay in this browser session only.
            </Text>
            <Button type="submit" leftSection={<IconLock size={16} />} loading={isLoggingIn}>
              Sign in
            </Button>
          </Group>
          </Stack>
        </form>
      </Stack>
    </Card>
  );
}
