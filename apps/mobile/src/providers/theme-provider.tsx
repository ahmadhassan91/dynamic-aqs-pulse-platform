import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  darkColors,
  darkGradients,
  darkShadows,
  highContrastColors,
  lightColors,
  lightGradients,
  lightShadows,
  statusColor as statusColorFor,
  type Palette,
  type ThemeGradients,
  type ThemeShadows,
} from '@/theme';

const HIGH_CONTRAST_STORAGE_KEY = 'pulse.theme.highContrast';
type ColorScheme = 'light' | 'dark';

export interface ThemeContextValue {
  palette: Palette;
  gradients: ThemeGradients;
  softShadow: ThemeShadows['softShadow'];
  liftShadow: ThemeShadows['liftShadow'];
  glowShadow: ThemeShadows['glowShadow'];
  statusColor: (status?: string) => { fg: string; bg: string };
  scheme: ColorScheme;
  isHighContrast: boolean;
  setHighContrast: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * NFR-MOB-016 — themes the app two ways at once:
 *  - follows the OS light/dark setting (useColorScheme + userInterfaceStyle:'automatic'), and
 *  - an opt-in, persisted "High contrast" override for sunlight/outdoor readability that supersedes
 *    the OS scheme. Consumers read tokens via useTheme().palette (aliased to `colors` at call sites).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(HIGH_CONTRAST_STORAGE_KEY)
      .then((value) => {
        if (active && value === 'true') setIsHighContrast(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const setHighContrast = useCallback((value: boolean) => {
    setIsHighContrast(value);
    void SecureStore.setItemAsync(HIGH_CONTRAST_STORAGE_KEY, value ? 'true' : 'false').catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const scheme: ColorScheme = systemScheme === 'dark' ? 'dark' : 'light';
    const useDark = scheme === 'dark' && !isHighContrast;
    const palette = isHighContrast ? highContrastColors : useDark ? darkColors : lightColors;
    const gradients = useDark ? darkGradients : lightGradients;
    const shadows = useDark ? darkShadows : lightShadows;
    return {
      palette,
      gradients,
      softShadow: shadows.softShadow,
      liftShadow: shadows.liftShadow,
      glowShadow: shadows.glowShadow,
      statusColor: (status?: string) => statusColorFor(status, palette),
      scheme,
      isHighContrast,
      setHighContrast,
    };
  }, [systemScheme, isHighContrast, setHighContrast]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return value;
}
