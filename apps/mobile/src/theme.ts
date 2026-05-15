export const colors = {
  background: '#F6F8FC',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF4FF',
  border: '#DCE4F2',
  text: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
  primary: '#2563EB',
  primarySoft: '#DBEAFE',
  primaryDeep: '#1D4ED8',
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
  lg: 16,
  xl: 22,
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
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
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
