// NFR-MOB-016 — themeable palettes for outdoor-readable field use.
// `lightColors` is the canonical key set; `Palette` is derived from it so darkColors /
// highContrastColors are compile-time-forced to define every key (no consumer can resolve a
// missing colour). `colors` re-exports lightColors as the default so any module that still
// imports it statically keeps working while the app migrates to the useTheme() hook.

export const lightColors = {
  background: '#F3F6FB',
  backgroundElevated: '#EAF1FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF4FF',
  surfacePressed: '#F8FAFC',
  border: '#DCE4F2',
  borderStrong: '#C6D3E5',
  text: '#0F172A',
  textInverse: '#FFFFFF',
  muted: '#64748B',
  subtle: '#94A3B8',
  primary: '#2563EB',
  primarySoft: '#DBEAFE',
  primaryDeep: '#1D4ED8',
  ink: '#172033',
  aqua: '#0891B2',
  aquaSoft: '#DFF7FB',
  violet: '#7C3AED',
  violetSoft: '#EDE9FE',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  white: '#FFFFFF',
};

export type Palette = typeof lightColors;

// Dark mode — deep navy surfaces, brightened accents for legibility on dark, soft tints darkened.
export const darkColors: Palette = {
  background: '#0B1220',
  backgroundElevated: '#111A2E',
  surface: '#16213A',
  surfaceMuted: '#1B2840',
  surfacePressed: '#202E48',
  border: '#2A3A57',
  borderStrong: '#3A4D70',
  text: '#F1F5F9',
  textInverse: '#0F172A',
  muted: '#94A3B8',
  subtle: '#64748B',
  primary: '#3B82F6',
  primarySoft: '#1E3A5F',
  primaryDeep: '#60A5FA',
  ink: '#E2E8F0',
  aqua: '#22D3EE',
  aquaSoft: '#0E3A44',
  violet: '#A78BFA',
  violetSoft: '#2E2348',
  success: '#4ADE80',
  successSoft: '#10331F',
  warning: '#FBBF24',
  warningSoft: '#3A2E0A',
  danger: '#F87171',
  dangerSoft: '#3A1414',
  white: '#FFFFFF',
};

// High contrast — outdoor/sunlight readability: pure-black text, strong dark borders, deep accents
// on a white base, with maximal foreground/background contrast for badges and controls.
export const highContrastColors: Palette = {
  background: '#FFFFFF',
  backgroundElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  surfacePressed: '#E2E8F0',
  border: '#1E293B',
  borderStrong: '#0F172A',
  text: '#000000',
  textInverse: '#FFFFFF',
  muted: '#1E293B',
  subtle: '#334155',
  primary: '#1D4ED8',
  primarySoft: '#DBEAFE',
  primaryDeep: '#1E3A8A',
  ink: '#000000',
  aqua: '#0E7490',
  aquaSoft: '#CFFAFE',
  violet: '#6D28D9',
  violetSoft: '#EDE9FE',
  success: '#15803D',
  successSoft: '#DCFCE7',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  white: '#FFFFFF',
};

export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 30,
  full: 999,
};

export const typography = {
  // Negative tracking on display sizes reads as premium/native; positive tracking on the uppercase
  // caption gives eyebrows an engineered look.
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const, letterSpacing: -0.6, fontFamily: 'Inter_800ExtraBold' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const, letterSpacing: -0.4, fontFamily: 'Inter_800ExtraBold' },
  subtitle: { fontSize: 17, lineHeight: 24, fontWeight: '700' as const, letterSpacing: -0.2, fontFamily: 'Inter_700Bold' },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const, fontFamily: 'Inter_400Regular' },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: '500' as const, fontFamily: 'Inter_500Medium' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.4, fontFamily: 'Inter_600SemiBold' },
};

export interface ThemeShadows {
  softShadow: { boxShadow: string };
  liftShadow: { boxShadow: string };
  glowShadow: { boxShadow: string };
}

export interface ThemeGradients {
  hero: string;
  primary: string;
  surface: string;
}

// Brand gradients (RN 0.81 experimental_backgroundImage — no native dep).
export const lightGradients: ThemeGradients = {
  hero: 'linear-gradient(145deg, #1E3A8A 0%, #1D4ED8 46%, #0E7490 100%)',
  primary: 'linear-gradient(180deg, #3B82F6 0%, #2563EB 58%, #1D4ED8 100%)',
  surface: 'linear-gradient(180deg, #FFFFFF 0%, #F7FAFF 100%)',
};

export const darkGradients: ThemeGradients = {
  hero: 'linear-gradient(145deg, #1E3A8A 0%, #1D4ED8 46%, #155E75 100%)',
  primary: 'linear-gradient(180deg, #3B82F6 0%, #2563EB 58%, #1D4ED8 100%)',
  surface: 'linear-gradient(180deg, #16213A 0%, #111A2E 100%)',
};

// Layered shadows read as elevation on light; on dark we lean on border/surface contrast instead of
// ambient navy shadows (which read as muddy halos on dark surfaces).
export const lightShadows: ThemeShadows = {
  softShadow: { boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05), 0 10px 26px rgba(15, 23, 42, 0.08)' },
  liftShadow: { boxShadow: '0 2px 6px rgba(15, 23, 42, 0.10), 0 22px 48px rgba(15, 23, 42, 0.18)' },
  glowShadow: { boxShadow: '0 8px 20px rgba(37, 99, 235, 0.38)' },
};

export const darkShadows: ThemeShadows = {
  softShadow: { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.40), 0 10px 26px rgba(0, 0, 0, 0.50)' },
  liftShadow: { boxShadow: '0 2px 6px rgba(0, 0, 0, 0.50), 0 22px 48px rgba(0, 0, 0, 0.60)' },
  glowShadow: { boxShadow: '0 8px 20px rgba(59, 130, 246, 0.45)' },
};

// Default (light) shadow exports kept for any module not yet on the useTheme() hook.
export const softShadow = lightShadows.softShadow;
export const liftShadow = lightShadows.liftShadow;
export const glowShadow = lightShadows.glowShadow;
export const gradients = lightGradients;

export function statusColor(status?: string, palette: Palette = lightColors) {
  const normalized = status?.toLowerCase() ?? '';
  if (normalized.includes('active') || normalized.includes('qualified') || normalized.includes('converted')) {
    return { fg: palette.success, bg: palette.successSoft };
  }
  if (normalized.includes('risk') || normalized.includes('review') || normalized.includes('pending')) {
    return { fg: palette.warning, bg: palette.warningSoft };
  }
  if (normalized.includes('lost') || normalized.includes('churn') || normalized.includes('inactive')) {
    return { fg: palette.danger, bg: palette.dangerSoft };
  }
  return { fg: palette.primary, bg: palette.primarySoft };
}
