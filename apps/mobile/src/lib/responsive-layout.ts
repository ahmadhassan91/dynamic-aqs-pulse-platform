// FR-MOB-009 — pure width→layout derivation so the responsive logic is unit-testable; the native hook
// (use-responsive-layout.ts) wraps useWindowDimensions and calls this. On phones the content fills the
// width; on iPad the content column is capped + centred so cards and text don't stretch. Final pixel
// verification (tab bar in landscape, hero gradients, safe-area insets) still needs a device.

export const RESPONSIVE_BREAKPOINTS = { tablet: 700, wide: 1100 } as const;

export interface ResponsiveLayout {
  width: number;
  isTablet: boolean;
  isWide: boolean;
  contentMaxWidth: number;
  columns: number;
}

export function deriveResponsiveLayout(width: number): ResponsiveLayout {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const isTablet = safeWidth >= RESPONSIVE_BREAKPOINTS.tablet;
  const isWide = safeWidth >= RESPONSIVE_BREAKPOINTS.wide;
  // Cap the content column on large screens; phones use their own width (a no-op cap), and an unknown
  // width falls back to a sensible default so the column never collapses.
  const contentMaxWidth = isWide ? 1040 : isTablet ? 760 : safeWidth > 0 ? safeWidth : 720;
  const columns = isWide ? 3 : isTablet ? 2 : 1;
  return { width: safeWidth, isTablet, isWide, contentMaxWidth, columns };
}
