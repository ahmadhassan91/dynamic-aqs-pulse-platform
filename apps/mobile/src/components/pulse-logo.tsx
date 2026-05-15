import { Text, View } from 'react-native';
import { colors } from '@/theme';

export function PulseLogo({ compact = false }: { compact?: boolean }) {
  const size = compact ? 34 : 48;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 9 : 11 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: colors.primary,
          overflow: 'hidden',
          boxShadow: '0 10px 22px rgba(37, 99, 235, 0.32)',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: size * 0.18,
            left: size * 0.18,
            right: size * 0.18,
            bottom: size * 0.18,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.5)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: size * 0.3,
            left: size * 0.3,
            right: size * 0.3,
            bottom: size * 0.3,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.72)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: size * 0.38,
            left: size * 0.38,
            width: size * 0.24,
            height: size * 0.24,
            borderRadius: 999,
            backgroundColor: colors.white,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: size * 0.14,
            height: size * 0.14,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.94)',
            top: size * 0.19,
            left: size * 0.14,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: size * 0.12,
            height: size * 0.12,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.94)',
            top: size * 0.65,
            left: size * 0.42,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: size * 0.14,
            height: size * 0.14,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.94)',
            top: size * 0.28,
            right: size * 0.12,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: size * 0.18,
            right: size * 0.18,
            top: size * 0.48,
            height: 1.4,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.6)',
          }}
        />
      </View>
      <View>
        <Text style={{ color: colors.text, fontSize: compact ? 20 : 26, lineHeight: compact ? 23 : 28, fontWeight: '800' }}>
          Pulse
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontSize: compact ? 10 : 12,
            lineHeight: compact ? 11 : 13,
            fontWeight: '800',
            letterSpacing: compact ? 1.2 : 1.4,
          }}
        >
          CRM
        </Text>
      </View>
    </View>
  );
}
