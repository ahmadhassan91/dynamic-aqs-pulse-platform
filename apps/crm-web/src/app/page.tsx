'use client';

import { useEffect } from 'react';
import { Center, Loader, Stack, Text } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { getDefaultWorkspacePath } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';

export default function HomePage() {
  const router = useRouter();
  const { auth, isHydrated } = usePulseSession();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    router.replace(getDefaultWorkspacePath(auth?.identity.role));
  }, [auth?.identity.role, isHydrated, router]);

  return (
    <Center mih="100vh">
      <Stack gap="xs" align="center">
        <Loader color="blue" />
        <Text size="sm" c="dimmed">
          Opening your Pulse workspace...
        </Text>
      </Stack>
    </Center>
  );
}
