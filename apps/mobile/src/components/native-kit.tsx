import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, liftShadow, radius, softShadow, spacing, statusColor, typography } from '@/theme';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 52, gap: spacing.lg }}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
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

export function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 145,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.xs,
        borderCurve: 'continuous',
        ...softShadow,
      }}
    >
      <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text selectable style={{ fontSize: 30, lineHeight: 35, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      {detail ? (
        <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

export function Pill({ label, tone }: { label: string; tone?: string }) {
  const palette = statusColor(tone ?? label);
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: radius.full, backgroundColor: palette.bg, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text selectable style={{ ...typography.caption, color: palette.fg }}>
        {label.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

export function NativeIcon({ fallback, name, size = 18, color = colors.text }: { fallback: string; name: string; size?: number; color?: string }) {
  if (Platform.OS === 'ios') {
    return <Image source={`sf:${name}`} style={{ width: size, height: size, tintColor: color }} contentFit="contain" />;
  }
  return (
    <Text selectable={false} style={{ color, fontSize: Math.max(13, size - 1), lineHeight: size + 2, fontWeight: '800' }}>
      {fallback}
    </Text>
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
  return (
    <View
      style={{
        backgroundColor: colors.ink,
        borderRadius: radius.xxl,
        padding: spacing.xl,
        gap: spacing.lg,
        overflow: 'hidden',
        borderCurve: 'continuous',
        ...liftShadow,
      }}
    >
      <View style={{ position: 'absolute', right: -42, top: -38, width: 154, height: 154, borderRadius: radius.full, backgroundColor: 'rgba(37, 99, 235, 0.3)' }} />
      <View style={{ position: 'absolute', left: -38, bottom: -58, width: 132, height: 132, borderRadius: radius.full, backgroundColor: 'rgba(8, 145, 178, 0.24)' }} />
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: radius.lg,
        backgroundColor: disabled ? colors.border : colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        borderCurve: 'continuous',
        opacity: pressed ? 0.86 : 1,
      })}
    >
      {icon ? <NativeIcon name={icon.name} fallback={icon.fallback} color={disabled ? colors.subtle : colors.white} /> : null}
      <Text style={{ ...typography.callout, color: disabled ? colors.subtle : colors.white, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled, icon }: { label: string; onPress: () => void; disabled?: boolean; icon?: { name: string; fallback: string } }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
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
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon ? <NativeIcon name={icon.name} fallback={icon.fallback} color={disabled ? colors.subtle : colors.primary} /> : null}
      <Text style={{ ...typography.callout, color: disabled ? colors.subtle : colors.primary, fontWeight: '800', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.subtle}
        style={{
          minHeight: 48,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
          color: colors.text,
          borderCurve: 'continuous',
          ...typography.body,
        }}
      />
    </View>
  );
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
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
        {...props}
        placeholderTextColor={colors.subtle}
        style={{ flex: 1, minHeight: 48, color: colors.text, ...typography.body }}
      />
    </View>
  );
}
