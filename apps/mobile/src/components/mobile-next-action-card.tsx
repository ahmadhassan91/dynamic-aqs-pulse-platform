import { Text, View } from 'react-native';
import type { MobileNextAction } from '@/lib/mobile-next-action';
import { radius, spacing, typography } from '@/theme';
import type { Palette } from '@/theme';
import { useTheme } from '@/providers/theme-provider';
import { Card, NativeIcon, Pill, PrimaryButton } from './native-kit';

export function MobileNextActionCard({
  action,
  eyebrow = 'Next action',
  onPress,
}: {
  action: MobileNextAction;
  eyebrow?: string;
  onPress: (action: MobileNextAction) => void;
}) {
  const { palette: colors } = useTheme();
  const palette = actionPalette(action.tone, colors);
  return (
    <Card style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.lg,
            backgroundColor: palette.iconBg,
            alignItems: 'center',
            justifyContent: 'center',
            borderCurve: 'continuous',
          }}
        >
          <NativeIcon name={actionIcon(action.kind)} fallback="!" color={palette.iconFg} size={19} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, alignItems: 'flex-start' }}>
            <Text selectable style={{ ...typography.caption, color: colors.subtle, fontWeight: '800', textTransform: 'uppercase' }}>
              {eyebrow}
            </Text>
            {action.sourceLabel ? <Pill label={action.sourceLabel} tone={action.tone} /> : null}
          </View>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            {action.title}
          </Text>
          <Text selectable style={{ ...typography.callout, color: colors.muted }}>
            {action.detail}
          </Text>
        </View>
      </View>
      <PrimaryButton label={action.actionLabel} icon={{ name: 'arrow.right.circle.fill', fallback: 'Go' }} onPress={() => onPress(action)} />
    </Card>
  );
}

function actionIcon(kind: MobileNextAction['kind']) {
  if (kind === 'route_checkout' || kind === 'route_plan') return 'map.fill';
  if (kind === 'sync_review' || kind === 'sync_retry') return 'arrow.triangle.2.circlepath';
  if (kind === 'lead_urgent' || kind === 'lead_sla') return 'person.crop.circle.badge.exclamationmark.fill';
  if (kind === 'training_due') return 'graduationcap.fill';
  if (kind === 'consignment_due' || kind === 'consignment_work') return 'shippingbox.fill';
  if (kind === 'voice_note_review') return 'mic.circle.fill';
  return 'checkmark.circle.fill';
}

function actionPalette(tone: MobileNextAction['tone'], colors: Palette) {
  if (tone === 'danger') {
    return { border: '#FCA5A5', iconBg: colors.dangerSoft, iconFg: colors.danger, surface: '#FFF7F7' };
  }
  if (tone === 'warning' || tone === 'review') {
    return { border: '#F8D37A', iconBg: colors.warningSoft, iconFg: colors.warning, surface: '#FFFBEB' };
  }
  if (tone === 'pending') {
    return { border: colors.borderStrong, iconBg: colors.surfaceMuted, iconFg: colors.primary, surface: colors.surface };
  }
  return { border: colors.border, iconBg: colors.successSoft, iconFg: colors.success, surface: colors.surface };
}
