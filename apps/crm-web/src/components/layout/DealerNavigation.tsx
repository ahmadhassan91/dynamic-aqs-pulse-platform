'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge, Box, Group, Stack, Text, ThemeIcon, UnstyledButton, rem } from '@mantine/core';
import type { DealerPortalAccessRoleKey } from '@pulse/contracts';
import { IconBuilding, IconCreditCard, IconHome, IconPackage, type TablerIcon } from '@tabler/icons-react';
import classes from './Navigation.module.css';

type DealerNavItem = {
  label: string;
  link: string;
  icon: TablerIcon;
  badgeForRole?: Partial<Record<DealerPortalAccessRoleKey, string>>;
};

const dealerNavItems: DealerNavItem[] = [
  {
    label: 'Dashboard',
    link: '/dealer/dashboard',
    icon: IconHome,
  },
  {
    label: 'Account Center',
    link: '/dealer/account',
    icon: IconBuilding,
  },
  {
    label: 'Account Health',
    link: '/dealer/account#account-health',
    icon: IconCreditCard,
    badgeForRole: { accounting: 'ERP pending' },
  },
  {
    label: 'Products & Files',
    link: '/dealer/catalog',
    icon: IconPackage,
    badgeForRole: { purchasing: 'Files' },
  },
];

export function DealerNavigation({ accessRole }: { accessRole?: DealerPortalAccessRoleKey | undefined }) {
  const pathname = usePathname();

  return (
    <Stack gap={4}>
      {dealerNavItems.map((item) => {
        const linkPath = item.link.split('#')[0] ?? item.link;
        const isAnchorLink = item.link.includes('#');
        const isActive = !isAnchorLink && (pathname === linkPath || pathname.startsWith(`${linkPath}/`));
        const badge = accessRole ? item.badgeForRole?.[accessRole] : null;

        return (
          <UnstyledButton
            key={item.link}
            component={Link}
            href={item.link}
            className={classes.control ?? ''}
            data-active={isActive || undefined}
          >
            <Group justify="space-between" gap={0}>
              <Box style={{ display: 'flex', alignItems: 'center' }}>
                <ThemeIcon variant="light" size={30}>
                  <item.icon style={{ width: rem(18), height: rem(18) }} />
                </ThemeIcon>
                <Text ml="md">{item.label}</Text>
              </Box>
              {badge ? (
                <Badge size="xs" variant="light">
                  {badge}
                </Badge>
              ) : null}
            </Group>
          </UnstyledButton>
        );
      })}
    </Stack>
  );
}
