import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { deriveResponsiveLayout, type ResponsiveLayout } from '@/lib/responsive-layout';

// FR-MOB-009 — reactive responsive layout from the live window width. The pure derivation lives in
// responsive-layout.ts; this only feeds useWindowDimensions() into it so screens re-flow on rotation.
// Memoised on width so the returned object keeps a stable identity across unrelated re-renders.
export function useResponsiveLayout(): ResponsiveLayout {
  const { width } = useWindowDimensions();
  return useMemo(() => deriveResponsiveLayout(width), [width]);
}
