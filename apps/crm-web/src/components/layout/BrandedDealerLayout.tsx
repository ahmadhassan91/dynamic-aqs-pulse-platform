'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ActionIcon, AppShell, Badge, Box, Burger, Button, Group, Menu, Stack, Text, ThemeIcon, rem } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBell, IconChevronDown, IconLogout, IconUser } from '@tabler/icons-react';
import { DealerNavigation } from './DealerNavigation';
import { PulseLogo } from '@/components/ui/PulseLogo';
import { usePulseSession } from '@/lib/pulse-session';
import type { DealerPortalAccessRoleKey, DealerPortalDashboardResponse } from '@pulse/contracts';

export function BrandedDealerLayout({
  children,
  dashboard,
}: {
  children: ReactNode;
  dashboard?: DealerPortalDashboardResponse | null;
}) {
  const [opened, { toggle }] = useDisclosure();
  const { auth, logout } = usePulseSession();
  const pathname = usePathname();
  const currentUser = dashboard?.currentUser;
  const portalAccount = dashboard?.portalAccount;
  const companyName = portalAccount?.accountDisplayName ?? currentUser?.displayName ?? auth?.identity.displayName ?? 'Dealer Portal';
  const roleProfile = currentUser ? getRoleProfile(currentUser.accessRole) : null;
  const isDashboard = pathname === '/dealer/dashboard';

  return (
    <AppShell
      header={{ height: 72 }}
      navbar={{ width: 290, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding={0}
      style={{ minHeight: '100vh' }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="md">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Link href="/dealer/dashboard" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Box style={{ transform: 'scale(1.03)', transformOrigin: 'left center' }}>
                <PulseLogo />
              </Box>
            </Link>
          </Group>

          <Group gap="sm">
            <ActionIcon variant="subtle" size="lg" color="gray" aria-label="Notifications">
              <IconBell size={18} />
            </ActionIcon>
            <Menu width={280} position="bottom-end" transitionProps={{ transition: 'pop-top-right' }} withinPortal>
              <Menu.Target>
                <Box
                  component="div"
                  role="button"
                  tabIndex={0}
                  style={{
                    appearance: 'none',
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                    margin: 0,
                    padding: 0,
                  }}
                >
                  <Group gap={8}>
                    <ThemeIcon variant="light" radius="xl" size={36}>
                      <IconUser size={18} />
                    </ThemeIcon>
                    <Stack gap={2} align="flex-start">
                      <Text fw={600} size="sm" lh={1}>
                        {companyName}
                      </Text>
                      <Group gap={6}>
                        <Text size="xs" c="dimmed">
                          {currentUser?.displayName ?? auth?.identity.displayName ?? auth?.identity.email ?? 'Dealer User'}
                        </Text>
                        {portalAccount?.status ? (
                          <Badge size="xs" color={statusColor(portalAccount.status)} variant="light">
                            {portalAccount.status.replace(/_/g, ' ')}
                          </Badge>
                        ) : null}
                        {roleProfile ? (
                          <Badge size="xs" color={roleProfile.color} variant="light">
                            {roleProfile.label}
                          </Badge>
                        ) : null}
                      </Group>
                    </Stack>
                    <IconChevronDown style={{ width: rem(12), height: rem(12) }} stroke={1.5} />
                  </Group>
                </Box>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Dealer Portal Session</Menu.Label>
                <Menu.Item leftSection={<IconUser style={{ width: rem(16), height: rem(16) }} />}>
                  {auth?.identity.email ?? 'Signed in'}
                </Menu.Item>
                {roleProfile ? (
                  <Menu.Item>
                    <Stack gap={2}>
                      <Text size="sm" fw={600}>
                        {roleProfile.label}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {roleProfile.description}
                      </Text>
                    </Stack>
                  </Menu.Item>
                ) : null}
                <Menu.Item component={Link} href="/dealer/account">
                  Account Center
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout style={{ width: rem(16), height: rem(16) }} />}
                  onClick={() => {
                    void logout();
                  }}
                >
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 72px)' }}>
        <Stack gap="md">
          {!isDashboard ? (
            <Button component={Link} href="/dealer/dashboard" variant="light" fullWidth justify="flex-start">
              Dashboard
            </Button>
          ) : null}
          {roleProfile ? (
            <Stack gap={4}>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Portal Role
              </Text>
              <Group gap="xs">
                <Badge color={roleProfile.color} variant="light">
                  {roleProfile.label}
                </Badge>
                <Text size="xs" c="dimmed">
                  {roleProfile.shortDescription}
                </Text>
              </Group>
            </Stack>
          ) : null}
          <DealerNavigation accessRole={currentUser?.accessRole} />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <div className="residential-content-container">
          {children}
        </div>
      </AppShell.Main>
    </AppShell>
  );
}

function getRoleProfile(role: DealerPortalAccessRoleKey) {
  const profiles: Record<DealerPortalAccessRoleKey, {
    label: string;
    color: string;
    shortDescription: string;
    description: string;
  }> = {
    admin: {
      label: 'Admin',
      color: 'blue',
      shortDescription: 'Users and access',
      description: 'Admin access highlights who can use this dealer account.',
    },
    purchasing: {
      label: 'Purchasing',
      color: 'green',
      shortDescription: 'Products and files',
      description: 'Purchasing access highlights products and files published for this account.',
    },
    accounting: {
      label: 'Accounting',
      color: 'orange',
      shortDescription: 'Account health',
      description: 'Accounting access highlights account health once finance data is connected.',
    },
    viewer: {
      label: 'Viewer',
      color: 'gray',
      shortDescription: 'Read-only',
      description: 'Viewer access is read-only across dealer portal company, catalog, and account-health surfaces.',
    },
  };

  return profiles[role];
}

function statusColor(status: string) {
  if (status === 'active') {
    return 'green';
  }

  if (status === 'suspended') {
    return 'orange';
  }

  if (status === 'deactivated') {
    return 'red';
  }

  return 'gray';
}
