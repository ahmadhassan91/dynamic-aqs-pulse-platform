import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceNotePresetContext, buildVoiceNoteCreateRequest } from '../src/lib/voice-note-policy.ts';

test('parseVoiceNotePresetContext: builds a lead context option from route params', () => {
  const ctx = parseVoiceNotePresetContext({ presetContextType: 'lead', presetContextId: 'lead-123', presetContextLabel: 'Indoor Comfort' });
  assert.ok(ctx);
  assert.equal(ctx.type, 'lead');
  assert.equal(ctx.id, 'lead-123');
  assert.equal(ctx.key, 'lead:lead-123');
  assert.equal(ctx.label, 'Lead: Indoor Comfort');
});

test('parseVoiceNotePresetContext: generic label when no name is passed', () => {
  const ctx = parseVoiceNotePresetContext({ presetContextType: 'lead', presetContextId: 'lead-9' });
  assert.equal(ctx?.label, 'Lead');
});

test('parseVoiceNotePresetContext: undefined for missing id or non-lead type', () => {
  assert.equal(parseVoiceNotePresetContext({ presetContextType: 'lead' }), undefined);
  assert.equal(parseVoiceNotePresetContext({ presetContextType: 'lead', presetContextId: '  ' }), undefined);
  assert.equal(parseVoiceNotePresetContext({ presetContextType: 'account', presetContextId: 'a-1' }), undefined);
  assert.equal(parseVoiceNotePresetContext({}), undefined);
});

test('parsed lead preset feeds buildVoiceNoteCreateRequest as a leadId-scoped note', () => {
  const ctx = parseVoiceNotePresetContext({ presetContextType: 'lead', presetContextId: 'lead-77', presetContextLabel: 'Acme' });
  assert.ok(ctx);
  const request = buildVoiceNoteCreateRequest({ context: ctx, title: 'Follow-up', transcriptText: 'Called dealer', recordedAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(request.contextType, 'lead');
  assert.equal(request.leadId, 'lead-77');
});
