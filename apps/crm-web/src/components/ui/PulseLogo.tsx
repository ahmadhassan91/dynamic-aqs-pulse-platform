'use client';

import { Box, Group, Text } from '@mantine/core';

export function PulseLogo({ compact = false }: { compact?: boolean }) {
  const iconSize = compact ? 30 : 46;

  return (
    <Group gap={compact ? 8 : 10} align="center" wrap="nowrap">
      <Box
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: iconSize * 0.32,
          background: 'linear-gradient(145deg, #3B82F6, #2563EB)',
          boxShadow: '0 10px 22px rgba(59, 130, 246, 0.33)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          style={{
            position: 'absolute',
            top: iconSize * 0.18,
            left: iconSize * 0.18,
            right: iconSize * 0.18,
            bottom: iconSize * 0.18,
            borderRadius: 999,
            border: '1.5px solid rgba(255,255,255,0.5)',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            top: iconSize * 0.3,
            left: iconSize * 0.3,
            right: iconSize * 0.3,
            bottom: iconSize * 0.3,
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.72)',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            width: iconSize * 0.24,
            height: iconSize * 0.24,
            borderRadius: 999,
            background: '#ffffff',
            top: iconSize * 0.38,
            left: iconSize * 0.38,
            boxShadow: '0 0 8px rgba(255,255,255,0.5)',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            width: iconSize * 0.14,
            height: iconSize * 0.14,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.94)',
            top: iconSize * 0.19,
            left: iconSize * 0.14,
          }}
        />
        <Box
          style={{
            position: 'absolute',
            width: iconSize * 0.12,
            height: iconSize * 0.12,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.94)',
            top: iconSize * 0.65,
            left: iconSize * 0.42,
          }}
        />
        <Box
          style={{
            position: 'absolute',
            width: iconSize * 0.14,
            height: iconSize * 0.14,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.94)',
            top: iconSize * 0.28,
            right: iconSize * 0.12,
          }}
        />
        <Box
          style={{
            position: 'absolute',
            left: iconSize * 0.18,
            right: iconSize * 0.18,
            top: iconSize * 0.48,
            height: 1.4,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.6)',
          }}
        />
      </Box>

      <Box>
        <Text fw={800} size={compact ? 'md' : 'xl'} c="var(--mantine-color-text)" style={{ letterSpacing: compact ? 0.2 : 0.4, lineHeight: 1 }}>
          Pulse
        </Text>
        <Text
          fw={700}
          c="dimmed"
          size={compact ? '10px' : '12px'}
          style={{ letterSpacing: compact ? 1.1 : 1.3, textTransform: 'uppercase', lineHeight: 1.1 }}
        >
          CRM
        </Text>
      </Box>
    </Group>
  );
}
