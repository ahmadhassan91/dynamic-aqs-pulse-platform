import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldOfferCallLog, buildCallDispositionPrompt } from '../src/lib/call-disposition-policy.ts';

test('shouldOfferCallLog: false when the lead has no phone', () => {
  assert.equal(shouldOfferCallLog({}), false);
  assert.equal(shouldOfferCallLog({ phone: '' }), false);
});

test('shouldOfferCallLog: false when initial contact is already logged (no re-prompt)', () => {
  assert.equal(
    shouldOfferCallLog({ phone: '+15551234567', initialContactedAt: '2026-06-01T10:00:00.000Z' }),
    false,
  );
});

test('shouldOfferCallLog: true when phone present and not yet contacted', () => {
  assert.equal(shouldOfferCallLog({ phone: '+15551234567' }), true);
});

test('buildCallDispositionPrompt references the contact name', () => {
  const prompt = buildCallDispositionPrompt('Indoor Comfort HVAC');
  assert.equal(prompt.title, 'Log this call?');
  assert.match(prompt.message, /Indoor Comfort HVAC/);
});
