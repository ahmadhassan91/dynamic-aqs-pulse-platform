'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge, Box, Group, Stack, Text, ThemeIcon, UnstyledButton, rem } from '@mantine/core';
import type { DealerPortalAccessRoleKey } from '@pulse/contracts';
import { IconBuilding, IconClipboardList, IconCreditCard, IconHome, IconPackage, IconShoppingCart, type TablerIcon } from '@tabler/icons-react';
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
  },
  {
    label: 'Products and Files',
    link: '/dealer/catalog',
    icon: IconPackage,
    badgeForRole: { purchasing: 'Files' },
  },
  {
    label: 'Cart',
    link: '/dealer/cart',
    icon: IconShoppingCart,
  },
  {
    label: 'Orders',
    link: '/dealer/orders',
    icon: IconClipboardList,
  },
];

export function DealerNavigation({ accessRole }: { accessRole?: DealerPortalAccessRoleKey | undefined }) {
  const pathname = usePathname();
  const [currentHash, setCurrentHash] = useState('');

  useEffect(() => {
    const updateHash = () => setCurrentHash(window.location.hash);

    updateHash();
    window.addEventListener('hashchange', updateHash);
    window.addEventListener('popstate', updateHash);

    return () => {
      window.removeEventListener('hashchange', updateHash);
      window.removeEventListener('popstate', updateHash);
    };
  }, [pathname]);

  return (
    <Stack gap={4}>
      {dealerNavItems.map((item) => {
        const isActive = isDealerNavItemActive(pathname, currentHash, item.link);
        const badge = accessRole ? item.badgeForRole?.[accessRole] : null;

        return (
          <UnstyledButton
            key={item.link}
            component={Link}
            href={item.link}
            className={classes.control ?? ''}
            data-active={isActive || undefined}
            aria-current={isActive ? 'page' : undefined}
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

function isDealerNavItemActive(pathname: string, currentHash: string, link: string) {
  const [linkPath = '', hashFragment] = link.split('#');
  const linkHash = hashFragment ? `#${hashFragment}` : '';

  if (pathname !== linkPath && !pathname.startsWith(`${linkPath}/`)) {
    return false;
  }

  if (linkHash) {
    return currentHash === linkHash;
  }

  if (pathname === linkPath) {
    return currentHash === '';
  }

  return true;
}
