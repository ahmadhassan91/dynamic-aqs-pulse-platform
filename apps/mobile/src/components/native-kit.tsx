import type { ReactElement, ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { radius, spacing, typography } from '@/theme';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { useTheme } from '@/providers/theme-provider';

export function Screen({ children }: { children: ReactNode }) {
  const { palette: colors } = useTheme();
  // FR-MOB-009 — cap + centre the content column so cards/text don't stretch on iPad (no-op on phones).
  const { contentMaxWidth } = useResponsiveLayout();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 136 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center', gap: spacing.lg }}>
        {children}
      </View>
    </ScrollView>
  );
}

// Virtualized list screen: a FlatList with the same padding/background as Screen, plus a
// non-virtualized header region. Use this instead of <Screen>{items.map(...)}</Screen> for any
// data-driven list so large territories/queues don't render every row up-front (P0-3).
export function ListScreen<T>({
  data,
  renderItem,
  keyExtractor,
  header,
  empty,
}: {
  data: ReadonlyArray<T>;
  renderItem: (item: T, index: number) => ReactElement | null;
  keyExtractor: (item: T, index: number) => string;
  header?: ReactNode;
  empty?: ReactNode;
}) {
  const { palette: colors } = useTheme();
  // FR-MOB-009 — cap + centre the list column on iPad (no-op on phones).
  const { contentMaxWidth } = useResponsiveLayout();
  return (
    <FlatList
      data={data as T[]}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 136, gap: spacing.md, width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
      keyExtractor={keyExtractor}
      renderItem={({ item, index }) => renderItem(item, index)}
      ListHeaderComponent={header ? <View style={{ gap: spacing.lg, marginBottom: spacing.md }}>{header}</View> : null}
      ListEmptyComponent={empty ? <>{empty}</> : null}
      removeClippedSubviews
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={11}
    />
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { palette: colors, softShadow } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.md,
        borderCurve: 'continuous',
        ...softShadow,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  const { palette: colors } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
        {title}
      </Text>
      {detail ? (
        <Text selectable style={{ ...typography.callout, color: colors.muted }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

export function MetricCard({ label, value, detail, badge }: { label: string; value: string; detail?: string; badge?: 'warning' | 'danger' }) {
  const { palette: colors, softShadow } = useTheme();
  const badgeBg = badge === 'danger' ? colors.dangerSoft : badge === 'warning' ? colors.warningSoft : undefined;
  const badgeBorder = badge === 'danger' ? colors.danger : badge === 'warning' ? colors.warning : colors.border;
  return (
    <View
      style={{
        flex: 1,
        minWidth: 145,
        backgroundColor: badgeBg ?? colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: badgeBorder,
        padding: spacing.lg,
        gap: spacing.xs,
        borderCurve: 'continuous',
        ...softShadow,
      }}
    >
      <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text selectable style={{ fontSize: 30, lineHeight: 35, fontWeight: '800', color: badge === 'danger' ? colors.danger : badge === 'warning' ? colors.warning : colors.text, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      {detail ? (
        <Text selectable style={{ ...typography.caption, color: badge ? (badge === 'danger' ? colors.danger : colors.warning) : colors.subtle }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

export function Pill({ label, tone }: { label: string; tone?: string }) {
  const { statusColor } = useTheme();
  const palette = statusColor(tone ?? label);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: radius.full, backgroundColor: palette.bg, paddingLeft: 8, paddingRight: 11, paddingVertical: 5 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.fg }} />
      <Text selectable style={{ ...typography.caption, color: palette.fg, textTransform: 'capitalize' }}>
        {label.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

// Map the app's SF-Symbol-style names to Ionicons (expo-image has no SF-symbol support, so the
// previous `sf:` source rendered nothing). Ionicons is the closest match to the iOS look.
const SF_TO_IONICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  'house.fill': 'home',
  'person.crop.circle.badge.plus': 'person-add',
  'building.2.fill': 'business',
  'map.fill': 'map',
  'car.fill': 'car',
  'mappin.and.ellipse': 'location',
  'mic.circle.fill': 'mic-circle',
  'mic.fill': 'mic',
  'shippingbox.fill': 'cube',
  'ellipsis.circle.fill': 'ellipsis-horizontal-circle',
  'graduationcap.fill': 'school',
  'bell.fill': 'notifications',
  'arrow.clockwise': 'reload',
  'arrow.clockwise.circle.fill': 'refresh-circle',
  'arrow.right.circle.fill': 'arrow-forward-circle',
  'arrow.triangle.2.circlepath': 'sync',
  'arrow.triangle.2.circlepath.circle.fill': 'sync-circle',
  'arrow.up.arrow.down.circle.fill': 'swap-vertical',
  'arrow.up.doc.fill': 'cloud-upload',
  'arrow.up.right.square.fill': 'open',
  'bolt.horizontal.circle.fill': 'flash',
  calendar: 'calendar',
  'camera.fill': 'camera',
  'camera.viewfinder': 'scan',
  checkmark: 'checkmark',
  desktopcomputer: 'desktop',
  checklist: 'checkmark-done-circle',
  'checkmark.circle.fill': 'checkmark-circle',
  'checkmark.seal.fill': 'ribbon',
  'chevron.left': 'chevron-back',
  'chevron.right': 'chevron-forward',
  'chevron.up': 'chevron-up',
  'chevron.down': 'chevron-down',
  'doc.text.magnifyingglass': 'document-text',
  'doc.text.viewfinder': 'scan',
  'iphone.gen3': 'phone-portrait',
  'location.fill': 'location',
  'location.north.fill': 'navigate',
  magnifyingglass: 'search',
  'magnifyingglass.circle.fill': 'search-circle',
  'paperplane.fill': 'paper-plane',
  'pencil.and.list.clipboard': 'clipboard',
  'person.3.fill': 'people',
  'phone.fill': 'call',
  'envelope.fill': 'mail',
  'photo.on.rectangle.angled': 'images',
  'plus.circle.fill': 'add-circle',
  'minus.circle.fill': 'remove-circle',
  'rectangle.portrait.and.arrow.right': 'log-out',
  'square.and.arrow.up': 'share-outline',
  'square.and.arrow.up.fill': 'share',
  'stop.fill': 'stop',
  'text.viewfinder': 'scan',
  'trash.fill': 'trash',
  'list.bullet': 'list',
  'doc.on.doc.fill': 'copy',
  'arrow.down.circle.fill': 'arrow-down-circle',
  'xmark.circle': 'close-circle-outline',
  'xmark.circle.fill': 'close-circle',
};

export function NativeIcon({
  name,
  size = 18,
  color,
  decorative = true,
  label,
}: { fallback?: string; name: string; size?: number; color?: string; decorative?: boolean; label?: string }) {
  const { palette: colors } = useTheme();
  const resolvedColor = color ?? colors.text;
  const ionName = SF_TO_IONICON[name] ?? 'ellipse-outline';
  const announced = Boolean(label);
  // NFR-MOB-017: icons are decorative by default so the underlying glyph name (e.g. 'mic') is not announced by
  // screen readers; the parent control carries the accessible name. Pass `label` only for an icon that must be
  // announced on its own (then it is exposed as an image with that label).
  return (
    <Ionicons
      name={ionName}
      size={size + 2}
      color={resolvedColor}
      accessibilityElementsHidden={decorative && !announced}
      importantForAccessibility={decorative && !announced ? 'no-hide-descendants' : 'auto'}
      {...(announced ? { accessibilityRole: 'image' as const, accessibilityLabel: label } : {})}
    />
  );
}

export function HeroCard({
  children,
  eyebrow,
  icon,
  title,
}: {
  children?: ReactNode;
  eyebrow?: string;
  icon?: { name: string; fallback: string };
  title: string;
}) {
  const { palette: colors, gradients, liftShadow } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.ink,
        experimental_backgroundImage: gradients.hero,
        borderRadius: radius.xxl,
        padding: spacing.xl,
        gap: spacing.lg,
        overflow: 'hidden',
        borderCurve: 'continuous',
        ...liftShadow,
      }}
    >
      <View style={{ position: 'absolute', right: -42, top: -38, width: 154, height: 154, borderRadius: radius.full, backgroundColor: 'rgba(96, 165, 250, 0.34)' }} />
      <View style={{ position: 'absolute', left: -38, bottom: -58, width: 132, height: 132, borderRadius: radius.full, backgroundColor: 'rgba(34, 211, 238, 0.20)' }} />
      <View style={{ position: 'absolute', right: 28, bottom: -20, width: 70, height: 70, borderRadius: radius.full, backgroundColor: 'rgba(255, 255, 255, 0.06)' }} />
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        {icon ? (
          <View style={{ width: 44, height: 44, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
            <NativeIcon name={icon.name} fallback={icon.fallback} color={colors.textInverse} size={20} />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          {eyebrow ? (
            <Text selectable style={{ ...typography.caption, color: '#BFD7FF', textTransform: 'uppercase' }}>
              {eyebrow}
            </Text>
          ) : null}
          <Text selectable style={{ ...typography.largeTitle, color: colors.textInverse }}>
            {title}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, icon }: { label: string; onPress: () => void; disabled?: boolean; icon?: { name: string; fallback: string } }) {
  const { palette: colors, gradients, glowShadow } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => ({
        minHeight: 50,
        borderRadius: radius.lg,
        backgroundColor: disabled ? colors.border : colors.primary,
        ...(disabled ? null : { experimental_backgroundImage: gradients.primary, ...glowShadow }),
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.xl,
        borderCurve: 'continuous',
        transform: [{ scale: pressed ? 0.97 : 1 }],
        opacity: pressed ? 0.96 : 1,
      })}
    >
      {icon ? <NativeIcon name={icon.name} fallback={icon.fallback} color={disabled ? colors.subtle : colors.white} /> : null}
      <Text style={{ ...typography.callout, color: disabled ? colors.subtle : colors.white, fontFamily: 'Inter_700Bold' }}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled, icon }: { label: string; onPress: () => void; disabled?: boolean; icon?: { name: string; fallback: string } }) {
  const { palette: colors, softShadow } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: disabled ? colors.surfacePressed : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.xl,
        ...softShadow,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        opacity: pressed ? 0.9 : 1,
      })}
    >
      {icon ? <NativeIcon name={icon.name} fallback={icon.fallback} color={disabled ? colors.subtle : colors.primary} /> : null}
      <Text
        onPress={disabled ? undefined : onPress}
        style={{ ...typography.callout, color: disabled ? colors.subtle : colors.primary, fontFamily: 'Inter_700Bold', textAlign: 'center' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Segmented tab control (FR-MOB-036). A disabled tab renders greyed and non-pressable.
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const { palette: colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: 3, gap: 2, borderCurve: 'continuous' }}>
      {tabs.map((tab) => {
        const active = tab.key === value;
        const disabled = Boolean(tab.disabled);
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={tab.label}
            disabled={disabled}
            onPress={() => onChange(tab.key)}
            style={{
              flex: 1,
              minHeight: 38,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? colors.surface : 'transparent',
              ...(active ? { borderWidth: 1, borderColor: colors.border } : null),
              opacity: disabled ? 0.45 : 1,
              borderCurve: 'continuous',
            }}
          >
            <Text style={{ ...typography.caption, fontFamily: 'Inter_700Bold', color: disabled ? colors.subtle : active ? colors.primary : colors.muted }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label: string; style?: TextStyle }) {
  const { palette: colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        {...props}
        placeholderTextColor={colors.subtle}
        style={[{
          minHeight: 48,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
          color: colors.text,
          borderCurve: 'continuous',
          ...typography.body,
        }, style]}
      />
    </View>
  );
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  const { palette: colors } = useTheme();
  return (
    <Card>
      <ActivityIndicator color={colors.primary} />
      <Text selectable style={{ ...typography.callout, color: colors.muted, textAlign: 'center' }}>
        {label}
      </Text>
    </Card>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  const { palette: colors } = useTheme();
  return (
    <Card style={{ alignItems: 'center' }}>
      <Text selectable style={{ ...typography.subtitle, color: colors.text, textAlign: 'center' }}>
        {title}
      </Text>
      <Text selectable style={{ ...typography.callout, color: colors.muted, textAlign: 'center' }}>
        {detail}
      </Text>
    </Card>
  );
}

export function ErrorState({ message }: { message: string }) {
  const { palette: colors } = useTheme();
  return (
    <Card style={{ borderColor: colors.dangerSoft, backgroundColor: '#FFF7F7' }}>
      <Text selectable style={{ ...typography.subtitle, color: colors.danger }}>
        Something needs attention
      </Text>
      <Text selectable style={{ ...typography.callout, color: colors.danger }}>
        {message}
      </Text>
    </Card>
  );
}

export function SearchField(props: TextInputProps) {
  const { palette: colors, softShadow } = useTheme();
  return (
    <View
      style={{
        minHeight: 50,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderCurve: 'continuous',
        ...softShadow,
      }}
    >
      <NativeIcon name="magnifyingglass" fallback="S" color={colors.subtle} />
      <TextInput
        accessibilityLabel="Search"
        {...props}
        placeholderTextColor={colors.subtle}
        style={{ flex: 1, minHeight: 48, color: colors.text, ...typography.body }}
      />
    </View>
  );
}
