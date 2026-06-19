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
import { StaleServerActionRecovery } from '@/components/providers/StaleServerActionRecovery';

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

// Scheme-aware design tokens, emitted by Mantine itself (so they flip with the color scheme and
// are not subject to globals.css cascade/build-cache issues).
// - --mantine-color-dimmed: darkened in light for WCAG AA body text (~7:1).
// - --pulse-*: brand/surface/border tokens, with dark-mode equivalents.
const resolveCssVariables = () => ({
  variables: {},
  light: {
    '--mantine-color-dimmed': '#4b5563',
    '--pulse-brand-blue': '#1d4ed8',
    '--pulse-brand-blue-soft': '#dbeafe',
    '--pulse-warning-orange': '#f97316',
    '--pulse-warning-orange-soft': '#ffedd5',
    '--pulse-blocker-red': '#dc2626',
    '--pulse-blocker-red-soft': '#fee2e2',
    '--pulse-surface': '#ffffff',
    '--pulse-surface-muted': '#f8fafc',
    '--pulse-border': '#e2e8f0',
  },
  dark: {
    '--mantine-color-dimmed': '#a6adba',
    '--pulse-brand-blue': '#4dabf7',
    '--pulse-brand-blue-soft': '#1b2a44',
    '--pulse-warning-orange': '#ffa94d',
    '--pulse-warning-orange-soft': '#3a2a17',
    '--pulse-blocker-red': '#ff8787',
    '--pulse-blocker-red-soft': '#3a1f22',
    '--pulse-surface': '#1a1b1e',
    '--pulse-surface-muted': '#141517',
    '--pulse-border': '#2c2e33',
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light" cssVariablesResolver={resolveCssVariables}>
      <Notifications position="top-right" />
      <StaleServerActionRecovery />
      <PulseSessionProvider>{children}</PulseSessionProvider>
    </MantineProvider>
  );
}
