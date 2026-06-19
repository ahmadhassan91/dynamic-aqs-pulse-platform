'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Box, Collapse, Group, Stack, Text, ThemeIcon, UnstyledButton, rem } from '@mantine/core';
import {
  IconBuildingStore,
  IconCalendar,
  IconChartBar,
  IconChevronRight,
  IconClipboardList,
  IconMapPin,
  IconPackage,
  IconSchool,
  IconShield,
  IconShoppingCart,
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
  const hasNestedLinks = Boolean(links && links.length > 1);
  const directLink = link ?? (links?.length === 1 ? links[0]?.link : undefined);
  const isActive = directLink
    ? isNavigationLinkActive(pathname, searchParams, directLink)
    : Boolean(links?.some((item) => isNavigationLinkActive(pathname, searchParams, item.link)));
  const [manualOpened, setManualOpened] = useState(initiallyOpened || isActive);
  const opened = manualOpened || isActive;

  if (directLink && !hasNestedLinks) {
    return (
      <UnstyledButton
        component={Link}
        href={directLink}
        className={classes.control ?? ''}
        data-active={isActive || undefined}
        aria-current={isActive ? 'page' : undefined}
      >
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
            <Text
              key={item.link}
              component={Link}
              href={item.link}
              className={classes.link ?? ''}
              data-active={itemActive || undefined}
              aria-current={itemActive ? 'page' : undefined}
            >
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
  const territoryNavigationLinks = getTerritoryNavigationLinks().map((item) =>
    item.label === 'Territory Map' ? { ...item, link: '/territory_map' } : item,
  );

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
        { label: 'Lead Work Queue', link: '/leads' },
        { label: 'Website Forms', link: '/leads/forms' },
        { label: 'Workflow Queue', link: '/leads/activities' },
        ...(role && canAccessModule(role, 'cis') ? [{ label: 'Finance Queue', link: '/leads/finance' }] : []),
        { label: 'Insights', link: '/leads/analytics' },
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

  // Order-on-behalf triage — single-screen back-office queue for submitted orders.
  if (role && canAccessModule(role, 'orders')) {
    navItems.push({ label: 'Orders', icon: IconShoppingCart, link: '/orders' });
  }

  // Consignment is a single-screen module — flattened from a one-child collapsible
  // into a direct link, so users reach it in one click.
  if (role && canAccessModule(role, 'consignment')) {
    navItems.push({ label: 'Consignment', icon: IconClipboardList, link: '/consignment' });
  }

  if (role && canAccessModule(role, 'reports')) {
    navItems.push({ label: 'Reports', icon: IconChartBar, link: '/reports' });
  }

  const canSeeProductManagement = Boolean(role && canAccessModule(role, 'product_management'));
  const canSeeDigitalAssets = Boolean(role && canAccessModule(role, 'digital_assets'));
  const productsAndFilesLinks: NavLink[] = [
    ...(canSeeProductManagement ? [
      { label: 'Dealer Preview', link: '/product-management?tab=preview' },
      { label: 'Products', link: '/product-management?tab=products' },
      { label: 'Who Sees What', link: '/product-management?tab=visibility' },
    ] : []),
    ...(canSeeDigitalAssets ? [
      { label: 'Asset Library', link: '/digital-assets?tab=library' },
      { label: 'Share Sets', link: '/digital-assets?tab=collections' },
      { label: 'Needs Attention', link: '/digital-assets?tab=delivery-health' },
    ] : []),
  ];

  if (productsAndFilesLinks.length) {
    // Daily product work stays to two doors; setup/source review remain in the
    // Product and Digital Asset workspace More menus.
    navItems.push({
      label: 'Products and Files',
      icon: IconPackage,
      links: productsAndFilesLinks,
    });
  }

  // Training is a single-screen module — flattened from a one-child collapsible
  // into a direct link.
  if (role && canAccessModule(role, 'training')) {
    navItems.push({ label: 'Training', icon: IconSchool, link: '/training' });
  }

  if (role && canAccessModule(role, 'admin')) {
    navItems.push({
      label: 'Users & Access',
      icon: IconShield,
      link: '/admin/users',
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
