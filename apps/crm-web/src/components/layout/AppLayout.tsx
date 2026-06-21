'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ActionIcon, AppShell, Badge, Box, Burger, Button, Group, Menu, Text, ThemeIcon, rem, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconLogout, IconMoon, IconSun, IconUser } from '@tabler/icons-react';
import { Navigation } from './Navigation';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Logo } from '@/components/ui/Logo';
import { usePulseSession } from '@/lib/pulse-session';

export function AppLayout({ children }: { children: ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  const { auth, logout } = usePulseSession();
  const currentAuth = auth;
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const toggleColorScheme = () => setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');

  const displayName =
    currentAuth?.identity.displayName
    ?? currentAuth?.identity.email
    ?? 'Pulse User';

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 280, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding={0}
      style={{ minHeight: '100vh' }}
    >
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Logo />
          </Group>

          <Group gap="sm">
            <NotificationBell />
            <ActionIcon
              variant="default"
              size="lg"
              onClick={toggleColorScheme}
              aria-label={computedColorScheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {computedColorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
            {currentAuth ? (
              <Menu width={220} position="bottom-end" transitionProps={{ transition: 'pop-top-right' }} withinPortal>
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
                    <Group gap={7}>
                      <ThemeIcon variant="light" radius="xl" size={30}>
                        <IconUser size={16} />
                      </ThemeIcon>
                      <Text fw={500} size="sm" lh={1} mr={3}>
                        {displayName}
                      </Text>
                      <Badge size="xs" color="grape" variant="light" styles={{ label: { color: 'var(--mantine-color-grape-9)' } }}>
                        {currentAuth.identity.role}
                      </Badge>
                      <IconChevronDown style={{ width: rem(12), height: rem(12) }} stroke={1.5} />
                    </Group>
                  </Box>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Session</Menu.Label>
                  <Menu.Item leftSection={<IconUser style={{ width: rem(16), height: rem(16) }} />}>
                    {currentAuth.identity.email ?? 'Signed in'}
                  </Menu.Item>
                  <Menu.Item
                    color="red"
                    leftSection={<IconLogout style={{ width: rem(16), height: rem(16) }} />}
                    onClick={() => {
                      void logout();
                    }}
                  >
                    Logout
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            ) : (
              <Button component={Link} href="/auth/login" variant="light" leftSection={<IconUser size={16} />}>
                Sign in
              </Button>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 60px)' }}>
        <Navigation />
      </AppShell.Navbar>

      <AppShell.Main id="main-content" tabIndex={-1}>{children}</AppShell.Main>
    </AppShell>
  );
}
