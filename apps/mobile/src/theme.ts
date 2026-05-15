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
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const },
  subtitle: { fontSize: 17, lineHeight: 24, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: '500' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
};

export const softShadow = {
  boxShadow: '0 14px 34px rgba(15, 23, 42, 0.08)',
};

export const liftShadow = {
  boxShadow: '0 18px 44px rgba(15, 23, 42, 0.12)',
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
