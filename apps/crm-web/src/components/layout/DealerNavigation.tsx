'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Group, Stack, Text, ThemeIcon, UnstyledButton, rem } from '@mantine/core';
import { IconBuilding, IconHome, IconPackage, type TablerIcon } from '@tabler/icons-react';
import classes from './Navigation.module.css';

type DealerNavItem = {
  label: string;
  link: string;
  icon: TablerIcon;
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
    label: 'Products & Files',
    link: '/dealer/catalog',
    icon: IconPackage,
  },
];

export function DealerNavigation() {
  const pathname = usePathname();

  return (
    <Stack gap={4}>
      {dealerNavItems.map((item) => {
        const isActive = pathname === item.link || pathname.startsWith(`${item.link}/`);

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
            </Group>
          </UnstyledButton>
        );
      })}
    </Stack>
  );
}
