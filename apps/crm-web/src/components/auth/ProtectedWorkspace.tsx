'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Center, Loader, Stack, Text } from '@mantine/core';
import type { WorkspaceActionKey, WorkspaceModuleKey } from '@pulse/contracts';
import { RoleAccessNotice } from '@/components/layout/RoleAccessNotice';
import { canAccessModule, canPerformAction } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';

export function ProtectedWorkspace({
  children,
  requiredModule,
  requiredAction,
}: {
  children: ReactNode;
  requiredModule?: WorkspaceModuleKey;
  requiredAction?: WorkspaceActionKey;
}) {
  const { auth, isHydrated } = usePulseSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isHydrated || auth) {
      return;
    }

    const nextPath = typeof window !== 'undefined' && window.location.search
      ? `${pathname}${window.location.search}`
      : pathname;

    router.replace(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  }, [auth, isHydrated, pathname, router]);

  if (!isHydrated) {
    return (
      <Center py="xl">
        <Stack gap="xs" align="center">
          <Loader color="blue" />
          <Text size="sm" c="dimmed">
            Restoring your Pulse session...
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
            Redirecting to sign in...
          </Text>
        </Stack>
      </Center>
    );
  }

  if (requiredModule && !canAccessModule(auth.identity.role, requiredModule)) {
    return <RoleAccessNotice pathname={pathname} />;
  }

  if (requiredAction && !canPerformAction(auth.identity.role, requiredAction)) {
    return <RoleAccessNotice pathname={pathname} />;
  }

  return <>{children}</>;
}
