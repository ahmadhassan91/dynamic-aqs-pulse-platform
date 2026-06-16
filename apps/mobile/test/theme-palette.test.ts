import test from 'node:test';
import assert from 'node:assert/strict';
import { lightColors, darkColors, highContrastColors, statusColor } from '../src/theme.ts';

const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

test('all palettes define the same keys so every consumer token resolves in any theme', () => {
  const lightKeys = Object.keys(lightColors).sort();
  assert.deepEqual(Object.keys(darkColors).sort(), lightKeys);
  assert.deepEqual(Object.keys(highContrastColors).sort(), lightKeys);
});

test('every palette value is a valid hex colour', () => {
  for (const [name, palette] of Object.entries({ lightColors, darkColors, highContrastColors })) {
    for (const [key, value] of Object.entries(palette)) {
      assert.match(value, HEX, `${name}.${key} = ${value}`);
    }
  }
});

test('statusColor maps to palette-correct fg/bg for each palette', () => {
  for (const palette of [lightColors, darkColors, highContrastColors]) {
    assert.deepEqual(statusColor('active', palette), { fg: palette.success, bg: palette.successSoft });
    assert.deepEqual(statusColor('at risk', palette), { fg: palette.warning, bg: palette.warningSoft });
    assert.deepEqual(statusColor('churned', palette), { fg: palette.danger, bg: palette.dangerSoft });
    assert.deepEqual(statusColor('anything-else', palette), { fg: palette.primary, bg: palette.primarySoft });
  }
});
