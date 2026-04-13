'use client';

import type { ReactNode } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { PulseSessionProvider } from '@/lib/pulse-session';

const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      <PulseSessionProvider>{children}</PulseSessionProvider>
    </MantineProvider>
  );
}
