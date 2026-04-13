'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Collapse, Group, Stack, Text, ThemeIcon, UnstyledButton, rem } from '@mantine/core';
import {
  IconChevronRight,
  IconHome,
  IconShield,
  IconUserPlus,
  type TablerIcon,
} from '@tabler/icons-react';
import classes from './Navigation.module.css';
import { canAccessModule } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';

type NavLink = {
  label: string;
  link: string;
};

type LinksGroupProps = {
  icon: TablerIcon;
  label: string;
  initiallyOpened?: boolean;
  link?: string;
  links?: NavLink[];
};

function LinksGroup({ icon: Icon, label, initiallyOpened, link, links }: LinksGroupProps) {
  const pathname = usePathname();
  const hasLinks = Boolean(links?.length);
  const isActive = link ? pathname === normalizeLink(link) : Boolean(links?.some((item) => pathname === normalizeLink(item.link)));
  const [manualOpened, setManualOpened] = useState(initiallyOpened || isActive);
  const opened = manualOpened || isActive;

  if (link && !hasLinks) {
    return (
      <UnstyledButton component={Link} href={link} className={classes.control ?? ''} data-active={isActive || undefined}>
        <Group justify="space-between" gap={0}>
          <Box style={{ display: 'flex', alignItems: 'center' }}>
            <ThemeIcon variant="light" size={30}>
              <Icon style={{ width: rem(18), height: rem(18) }} />
            </ThemeIcon>
            <Box ml="md">{label}</Box>
          </Box>
        </Group>
      </UnstyledButton>
    );
  }

  return (
    <>
      <UnstyledButton onClick={() => setManualOpened((value) => !value)} className={classes.control ?? ''} data-active={isActive || undefined}>
        <Group justify="space-between" gap={0}>
          <Box style={{ display: 'flex', alignItems: 'center' }}>
            <ThemeIcon variant="light" size={30}>
              <Icon style={{ width: rem(18), height: rem(18) }} />
            </ThemeIcon>
            <Box ml="md">{label}</Box>
          </Box>
          <IconChevronRight
            className={classes.chevron}
            stroke={1.5}
            style={{
              width: rem(16),
              height: rem(16),
              transform: opened ? 'rotate(90deg)' : 'none',
            }}
          />
        </Group>
      </UnstyledButton>
      <Collapse in={opened}>
        {links?.map((item) => {
          const itemActive = pathname === normalizeLink(item.link);
          return (
            <Text key={item.link} component={Link} href={item.link} className={classes.link ?? ''} data-active={itemActive || undefined}>
              {item.label}
            </Text>
          );
        })}
      </Collapse>
    </>
  );
}

export function Navigation() {
  const { auth } = usePulseSession();

  const role = auth?.identity.role;
  const navItems: LinksGroupProps[] = [];

  if (!role || canAccessModule(role, 'leads')) {
    navItems.push({ label: 'Home', icon: IconHome, link: '/leads' });
    navItems.push({
      label: 'Lead Management',
      icon: IconUserPlus,
      initiallyOpened: true,
      links: [
        { label: 'Lead Pipeline', link: '/leads' },
        { label: 'Website Forms', link: '/leads/forms' },
        { label: 'Workflow Queue', link: '/leads/activities' },
        ...(role && canAccessModule(role, 'cis') ? [{ label: 'Finance Queue', link: '/leads/finance' }] : []),
        { label: 'Analytics', link: '/leads/analytics' },
      ],
    });
  }

  if (role && canAccessModule(role, 'admin')) {
    navItems.push({
      label: 'Administration',
      icon: IconShield,
      links: [
        { label: 'Admin Dashboard', link: '/admin' },
        { label: 'User Management', link: '/admin/users' },
        { label: 'Roles & Permissions', link: '/admin/roles' },
        { label: 'Activity Monitor', link: '/admin/activity' },
      ],
    });
  }

  return (
    <Stack gap={4}>
      {navItems.map((item) => (
        <LinksGroup key={item.label} {...item} />
      ))}
    </Stack>
  );
}

function normalizeLink(value: string) {
  return value.split('?')[0] ?? value;
}
