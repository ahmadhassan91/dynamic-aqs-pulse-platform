import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateNextRoseAuditDueDate,
  calculatePoFollowUpDueDate,
} from '../dist/modules/consignment/service.js';

test('consignment ROSE audit cadence is 90 days from BLUE baseline or last completion', () => {
  const anchor = new Date('2026-04-30T12:00:00.000Z');
  assert.equal(calculateNextRoseAuditDueDate(anchor).toISOString(), '2026-07-29T12:00:00.000Z');
});

test('consignment PO follow-up clock uses five business days after true-up', () => {
  const friday = new Date('2026-05-01T09:00:00.000Z');
  assert.equal(calculatePoFollowUpDueDate(friday).toISOString(), '2026-05-08T09:00:00.000Z');
});

