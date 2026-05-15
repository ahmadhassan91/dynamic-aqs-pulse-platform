import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, radius, softShadow, spacing, statusColor, typography } from '@/theme';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }}
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
    <View style={{ gap: 3 }}>
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

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: radius.md,
        backgroundColor: disabled ? colors.border : colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <Text style={{ ...typography.callout, color: disabled ? colors.subtle : colors.white, fontWeight: '800' }}>{label}</Text>
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
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
          color: colors.text,
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
