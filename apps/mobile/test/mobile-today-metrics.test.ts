import test from 'node:test';
import assert from 'node:assert/strict';
import { countOverdueRoseSites } from '../src/lib/today-metrics.ts';
import { MOBILE_ADVANCEABLE_STAGES } from '../src/lib/lead-stage-policy.ts';

// --- countOverdueRoseSites ---

test('countOverdueRoseSites returns 0 for empty list', () => {
  assert.equal(countOverdueRoseSites([], new Date('2026-06-08T12:00:00.000Z')), 0);
});

test('countOverdueRoseSites returns 0 for site with no nextAuditDueAt', () => {
  assert.equal(countOverdueRoseSites([{}, {}], new Date('2026-06-08T12:00:00.000Z')), 0);
});

test('countOverdueRoseSites: site due exactly at now is NOT overdue (strict less-than)', () => {
  const now = new Date('2026-06-08T12:00:00.000Z');
  const sites = [{ nextAuditDueAt: '2026-06-08T12:00:00.000Z' }];
  assert.equal(countOverdueRoseSites(sites, now), 0);
});

test('countOverdueRoseSites: site 1ms past due is overdue', () => {
  const now = new Date('2026-06-08T12:00:00.001Z');
  const sites = [{ nextAuditDueAt: '2026-06-08T12:00:00.000Z' }];
  assert.equal(countOverdueRoseSites(sites, now), 1);
});

test('countOverdueRoseSites: site 1ms before due is not overdue', () => {
  const now = new Date('2026-06-08T11:59:59.999Z');
  const sites = [{ nextAuditDueAt: '2026-06-08T12:00:00.000Z' }];
  assert.equal(countOverdueRoseSites(sites, now), 0);
});

test('countOverdueRoseSites counts only overdue sites in a mixed list', () => {
  const now = new Date('2026-06-08T12:00:00.000Z');
  const sites = [
    { nextAuditDueAt: '2026-06-07T00:00:00.000Z' }, // overdue
    { nextAuditDueAt: '2026-06-09T00:00:00.000Z' }, // future
    {},                                               // no date
    { nextAuditDueAt: '2026-06-08T11:59:59.999Z' }, // overdue (1ms before now)
  ];
  assert.equal(countOverdueRoseSites(sites, now), 2);
});

// --- MOBILE_ADVANCEABLE_STAGES ---

test('MOBILE_ADVANCEABLE_STAGES excludes onboarding_completed', () => {
  assert.equal(MOBILE_ADVANCEABLE_STAGES.includes('onboarding_completed'), false);
});

test('MOBILE_ADVANCEABLE_STAGES excludes customer_active', () => {
  assert.equal(MOBILE_ADVANCEABLE_STAGES.includes('customer_active'), false);
});

test('MOBILE_ADVANCEABLE_STAGES includes new', () => {
  assert.equal(MOBILE_ADVANCEABLE_STAGES.includes('new'), true);
});

test('MOBILE_ADVANCEABLE_STAGES includes discovery_scheduled', () => {
  assert.equal(MOBILE_ADVANCEABLE_STAGES.includes('discovery_scheduled'), true);
});

test('MOBILE_ADVANCEABLE_STAGES includes discovery_completed', () => {
  assert.equal(MOBILE_ADVANCEABLE_STAGES.includes('discovery_completed'), true);
});

test('MOBILE_ADVANCEABLE_STAGES includes cis_sent', () => {
  assert.equal(MOBILE_ADVANCEABLE_STAGES.includes('cis_sent'), true);
});

test('MOBILE_ADVANCEABLE_STAGES includes cis_signed', () => {
  assert.equal(MOBILE_ADVANCEABLE_STAGES.includes('cis_signed'), true);
});

test('MOBILE_ADVANCEABLE_STAGES has exactly 5 entries (all LEAD_STAGES minus 2 excluded)', () => {
  assert.equal(MOBILE_ADVANCEABLE_STAGES.length, 5);
});
