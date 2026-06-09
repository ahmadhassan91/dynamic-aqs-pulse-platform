'use client';

import type { ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  MantineProvider,
  Modal,
  NavLink,
  Paper,
  createTheme,
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { PulseSessionProvider } from '@/lib/pulse-session';

const theme = createTheme({
  colors: {
    pulseBlue: [
      '#eff6ff',
      '#dbeafe',
      '#bfdbfe',
      '#93c5fd',
      '#60a5fa',
      '#3b82f6',
      '#2563eb',
      '#1d4ed8',
      '#1e40af',
      '#1e3a8a',
    ],
    pulseOrange: [
      '#fff7ed',
      '#ffedd5',
      '#fed7aa',
      '#fdba74',
      '#fb923c',
      '#f97316',
      '#ea580c',
      '#c2410c',
      '#9a3412',
      '#7c2d12',
    ],
    pulseRed: [
      '#fef2f2',
      '#fee2e2',
      '#fecaca',
      '#fca5a5',
      '#f87171',
      '#ef4444',
      '#dc2626',
      '#b91c1c',
      '#991b1b',
      '#7f1d1d',
    ],
  },
  primaryColor: 'pulseBlue',
  primaryShade: 7,
  defaultRadius: 'md',
  components: {
    Alert: Alert.extend({
      defaultProps: {
        radius: 'md',
      },
    }),
    Badge: Badge.extend({
      defaultProps: {
        radius: 'sm',
        variant: 'light',
      },
    }),
    Button: Button.extend({
      defaultProps: {
        color: 'pulseBlue',
        radius: 'md',
      },
    }),
    Card: Card.extend({
      defaultProps: {
        radius: 'md',
        shadow: 'none',
      },
    }),
    Drawer: Drawer.extend({
      defaultProps: {
        radius: 0,
        shadow: 'md',
      },
    }),
    Modal: Modal.extend({
      defaultProps: {
        radius: 'md',
        shadow: 'md',
      },
    }),
    NavLink: NavLink.extend({
      defaultProps: {
        color: 'pulseBlue',
      },
    }),
    Paper: Paper.extend({
      defaultProps: {
        radius: 'md',
        shadow: 'none',
      },
    }),
  },
});

// WCAG AA: Mantine's default dimmed text (gray.6, ~3.5:1 on white) fails the 4.5:1 body floor.
// Emit a darker dimmed token via the resolver — applied by Mantine itself, so it is not subject
// to globals.css build caching/cascade. (Dark value reserved for future dark-mode work.)
const resolveCssVariables = () => ({
  variables: {},
  light: { '--mantine-color-dimmed': '#4b5563' },
  dark: { '--mantine-color-dimmed': '#9ca3af' },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light" cssVariablesResolver={resolveCssVariables}>
      <Notifications position="top-right" />
      <PulseSessionProvider>{children}</PulseSessionProvider>
    </MantineProvider>
  );
}
