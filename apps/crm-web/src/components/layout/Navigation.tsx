'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Box, Collapse, Group, Stack, Text, ThemeIcon, UnstyledButton, rem } from '@mantine/core';
import {
  IconBuildingStore,
  IconCalendar,
  IconChevronRight,
  IconClipboardList,
  IconMapPin,
  IconPackage,
  IconPhoto,
  IconSchool,
  IconShield,
  IconUserPlus,
  type TablerIcon,
} from '@tabler/icons-react';
import classes from './Navigation.module.css';
import { canAccessModule, canPerformAction } from '@/lib/access';
import { getTerritoryNavigationLinks } from '@/lib/prototype-parity';
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
  const searchParams = useSearchParams();
  const hasLinks = Boolean(links?.length);
  const isActive = link
    ? isNavigationLinkActive(pathname, searchParams, link)
    : Boolean(links?.some((item) => isNavigationLinkActive(pathname, searchParams, item.link)));
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
          const itemActive = isNavigationLinkActive(pathname, searchParams, item.link);
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
  const territoryNavigationLinks = getTerritoryNavigationLinks();

  // Calendar — single consistent slot at the top whenever the user has access,
  // regardless of which other modules they can see.
  if (!role || canAccessModule(role, 'calendar')) {
    navItems.push({ label: 'Calendar', icon: IconCalendar, link: '/calendar' });
  }

  if (!role || canAccessModule(role, 'leads')) {
    navItems.push({
      label: 'Leads',
      icon: IconUserPlus,
      initiallyOpened: true,
      links: [
        { label: 'Pipeline', link: '/leads' },
        { label: 'Website Forms', link: '/leads/forms' },
        { label: 'Workflow Queue', link: '/leads/activities' },
        ...(role && canAccessModule(role, 'cis') ? [{ label: 'Finance Queue', link: '/leads/finance' }] : []),
        { label: 'Analytics', link: '/leads/analytics' },
      ],
    });
  }

  if (role && canAccessModule(role, 'territories')) {
    navItems.push({
      label: 'Territories',
      icon: IconMapPin,
      links: territoryNavigationLinks,
    });
  }

  if (role && canAccessModule(role, 'customers')) {
    navItems.push({
      label: 'Accounts',
      icon: IconBuildingStore,
      links: [
        { label: 'All Accounts', link: '/customers' },
        { label: 'Field Activity', link: '/customers/field-activity' },
      ],
    });
  }

  // Consignment is a single-screen module — flattened from a one-child collapsible
  // into a direct link, so users reach it in one click.
  if (role && canAccessModule(role, 'consignment')) {
    navItems.push({ label: 'Consignment', icon: IconClipboardList, link: '/consignment' });
  }

  if (role && canAccessModule(role, 'product_management')) {
    navItems.push({
      label: 'Products',
      icon: IconPackage,
      links: [
        { label: 'Who Sees It', link: '/product-management?tab=visibility' },
        { label: 'Products', link: '/product-management?tab=products' },
        { label: 'Files & Readiness', link: '/product-management?tab=readiness' },
        { label: 'Ready To Publish', link: '/product-management?tab=publish' },
        { label: 'Catalog Setup', link: '/product-management?tab=categories' },
      ],
    });
  }

  if (role && canAccessModule(role, 'digital_assets')) {
    navItems.push({
      label: 'Digital Assets',
      icon: IconPhoto,
      links: [
        { label: 'Asset Library', link: '/digital-assets?tab=library' },
        { label: 'Collections', link: '/digital-assets?tab=collections' },
        { label: 'Migration Manifest', link: '/digital-assets?tab=migration' },
        { label: 'Delivery Health', link: '/digital-assets?tab=delivery-health' },
      ],
    });
  }

  // Training is a single-screen module — flattened from a one-child collapsible
  // into a direct link.
  if (role && canAccessModule(role, 'training')) {
    navItems.push({ label: 'Training', icon: IconSchool, link: '/training' });
  }

  if (role && canAccessModule(role, 'admin')) {
    navItems.push({
      label: 'Administration',
      icon: IconShield,
      links: [
        { label: 'Admin Dashboard', link: '/admin' },
        { label: 'User Management', link: '/admin/users' },
        { label: 'Roles & Permissions', link: '/admin/roles' },
        ...(canPerformAction(role, 'product.manage') ? [{ label: 'Catalog Rules', link: '/admin/catalog-rules' }] : []),
        { label: 'Integrations', link: '/admin/integrations' },
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

function isNavigationLinkActive(
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
  link: string,
) {
  const [targetPath = '', targetQuery] = link.split('?');
  if (pathname !== normalizeLink(targetPath)) {
    return false;
  }

  if (!targetQuery) {
    return true;
  }

  const targetParams = new URLSearchParams(targetQuery);
  const targetTab = targetParams.get('tab');
  const currentTab = searchParams.get('tab');

  if (targetTab === 'dashboard') {
    return currentTab === null || currentTab === 'dashboard';
  }

  return Array.from(targetParams.entries()).every(([key, value]) => searchParams.get(key) === value);
}
