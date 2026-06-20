import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMailtoUrl, buildTelUrl, chooseCallNumber } from '../src/lib/contact-link.ts';

test('buildTelUrl strips formatting and keeps digits', () => {
  assert.equal(buildTelUrl('(512) 555-0199'), 'tel:5125550199');
});

test('buildTelUrl preserves a leading + country code', () => {
  assert.equal(buildTelUrl('+1 512 555 0199'), 'tel:+15125550199');
});

test('buildTelUrl returns null for empty / digitless / nullish', () => {
  assert.equal(buildTelUrl(''), null);
  assert.equal(buildTelUrl('   '), null);
  assert.equal(buildTelUrl('n/a'), null);
  assert.equal(buildTelUrl(null), null);
  assert.equal(buildTelUrl(undefined), null);
});

test('buildMailtoUrl trims and prefixes mailto:', () => {
  assert.equal(buildMailtoUrl('  a@b.com '), 'mailto:a@b.com');
});

test('buildMailtoUrl returns null for empty / nullish', () => {
  assert.equal(buildMailtoUrl(''), null);
  assert.equal(buildMailtoUrl('   '), null);
  assert.equal(buildMailtoUrl(null), null);
  assert.equal(buildMailtoUrl(undefined), null);
});

test('chooseCallNumber prefers phone, falls back to mobile, else null', () => {
  assert.equal(chooseCallNumber({ phone: '111', mobilePhone: '222' }), '111');
  assert.equal(chooseCallNumber({ mobilePhone: '222' }), '222');
  assert.equal(chooseCallNumber({ phone: '   ', mobilePhone: '222' }), '222');
  assert.equal(chooseCallNumber({}), null);
  assert.equal(chooseCallNumber({ phone: null, mobilePhone: null }), null);
});
