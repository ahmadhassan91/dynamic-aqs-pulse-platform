export const colors = {
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

// Brand gradients (RN 0.81 experimental_backgroundImage — no native dep). Diagonal navy→blue→aqua
// hero, vertical blue for the primary CTA.
export const gradients = {
  hero: 'linear-gradient(145deg, #1E3A8A 0%, #1D4ED8 46%, #0E7490 100%)',
  primary: 'linear-gradient(180deg, #3B82F6 0%, #2563EB 58%, #1D4ED8 100%)',
  surface: 'linear-gradient(180deg, #FFFFFF 0%, #F7FAFF 100%)',
};

// Layered shadows (tight contact + soft ambient) read as real elevation, not a flat drop shadow.
export const softShadow = {
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05), 0 10px 26px rgba(15, 23, 42, 0.08)',
};

export const liftShadow = {
  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.10), 0 22px 48px rgba(15, 23, 42, 0.18)',
};

// Coloured glow under the primary CTA so it feels lit, not painted.
export const glowShadow = {
  boxShadow: '0 8px 20px rgba(37, 99, 235, 0.38)',
};

export function statusColor(status?: string) {
  const normalized = status?.toLowerCase() ?? '';
  if (normalized.includes('active') || normalized.includes('qualified') || normalized.includes('converted')) {
    return { fg: colors.success, bg: colors.successSoft };
  }
  if (normalized.includes('risk') || normalized.includes('review') || normalized.includes('pending')) {
    return { fg: colors.warning, bg: colors.warningSoft };
  }
  if (normalized.includes('lost') || normalized.includes('churn') || normalized.includes('inactive')) {
    return { fg: colors.danger, bg: colors.dangerSoft };
  }
  return { fg: colors.primary, bg: colors.primarySoft };
}
