'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Alert, Button, Center, Group, Loader, Stack, Text } from '@mantine/core';
import { getDefaultWorkspacePath } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';

export function DealerPortalProtectedWorkspace({ children }: { children: ReactNode }) {
  const { auth, isHydrated, logout } = usePulseSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isHydrated || auth) {
      return;
    }

    router.replace(`/dealer/login?next=${encodeURIComponent(pathname)}`);
  }, [auth, isHydrated, pathname, router]);

  if (!isHydrated) {
    return (
      <Center py="xl">
        <Stack gap="xs" align="center">
          <Loader color="blue" />
          <Text size="sm" c="dimmed">
            Restoring your dealer portal session...
          </Text>
        </Stack>
      </Center>
    );
  }

  if (!auth) {
    return (
      <Center py="xl">
        <Stack gap="xs" align="center">
          <Loader color="blue" />
          <Text size="sm" c="dimmed">
            Redirecting to dealer sign in...
          </Text>
        </Stack>
      </Center>
    );
  }

  if (auth.identity.role !== 'DEALER_PORTAL_USER') {
    const internalPath = getDefaultWorkspacePath(auth.identity.role);

    return (
      <Alert color="yellow" variant="light" maw={720} mx="auto">
        <Stack gap="md">
          <Text fw={600}>This signed-in account does not have dealer portal access.</Text>
          <Text size="sm" c="dimmed">
            Use a dealer portal user set up for this company to continue here, or return to the internal Pulse workspace.
          </Text>
          <Group gap="sm">
            <Button component={Link} href={internalPath} variant="filled">
              Open Internal Workspace
            </Button>
            <Button
              variant="default"
              onClick={() => {
                void logout();
              }}
            >
              Sign Out
            </Button>
          </Group>
        </Stack>
      </Alert>
    );
  }

  return <>{children}</>;
}
