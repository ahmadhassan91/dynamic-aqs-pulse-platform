'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Button, Card, Stack, Text, Title } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';

export function SessionGate({
  title = 'Sign in to Pulse CRM',
  description = 'Use an internal Pulse account to continue into the live production workspace.',
}: {
  title?: string;
  description?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextHref = useMemo(() => {
    const query = searchParams?.toString();
    const nextPath = query ? `${pathname}?${query}` : pathname;
    return `/auth/login?next=${encodeURIComponent(nextPath)}`;
  }, [pathname, searchParams]);

  return (
    <Card withBorder radius="xl" p="xl" maw={560} mx="auto" className="premium-hero-panel">
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2}>{title}</Title>
          <Text c="dimmed">{description}</Text>
        </Stack>
        <Text size="sm" c="dimmed">
          You&apos;ll continue through the same authenticated Pulse login flow used across the rest of the CRM.
        </Text>
        <Button component={Link} href={nextHref} leftSection={<IconLock size={16} />} size="md" w="fit-content">
          Go to sign in
        </Button>
      </Stack>
    </Card>
  );
}
