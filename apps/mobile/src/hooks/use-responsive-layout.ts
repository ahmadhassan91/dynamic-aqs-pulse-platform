import { useWindowDimensions } from 'react-native';
import { deriveResponsiveLayout, type ResponsiveLayout } from '@/lib/responsive-layout';

// FR-MOB-009 — reactive responsive layout from the live window width. The pure derivation lives in
// responsive-layout.ts; this only feeds useWindowDimensions() into it so screens re-flow on rotation.
export function useResponsiveLayout(): ResponsiveLayout {
  const { width } = useWindowDimensions();
  return deriveResponsiveLayout(width);
}
