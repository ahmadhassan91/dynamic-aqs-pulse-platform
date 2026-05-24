import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeMobileLiveApiStatus } from '../src/lib/mobile-live-api-status.ts';

test('marks live API ready when all dashboard sections respond', () => {
  const status = summarizeMobileLiveApiStatus([
    { key: 'leads', label: 'Leads', result: 'fulfilled', count: 3 },
    { key: 'accounts', label: 'Accounts', result: 'fulfilled', count: 2 },
    { key: 'lead_queue', label: 'Lead queue', result: 'fulfilled', count: 1 },
  ]);

  assert.equal(status.overall, 'ready');
  assert.equal(status.loadedCount, 3);
  assert.equal(status.failedCount, 0);
  assert.match(status.message, /working/);
});

test('keeps partial mobile dashboard honest when one CRM section fails', () => {
  const status = summarizeMobileLiveApiStatus([
    { key: 'leads', label: 'Leads', result: 'fulfilled', count: 3 },
    { key: 'accounts', label: 'Accounts', result: 'rejected', count: 0 },
    { key: 'lead_queue', label: 'Lead queue', result: 'fulfilled', count: 0 },
  ]);

  assert.equal(status.overall, 'partial');
  assert.equal(status.failedCount, 1);
  assert.equal(status.emptyCount, 1);
  assert.match(status.message, /Accounts/);
  assert.deepEqual(status.sections.map((section) => section.status), ['loaded', 'failed', 'empty']);
});

test('treats all rejected mobile sections as unavailable rather than ready', () => {
  const status = summarizeMobileLiveApiStatus([
    { key: 'leads', label: 'Leads', result: 'rejected', count: 0 },
    { key: 'accounts', label: 'Accounts', result: 'rejected', count: 0 },
  ]);

  assert.equal(status.overall, 'unavailable');
  assert.equal(status.failedCount, 2);
  assert.match(status.message, /No live CRM sections/);
});
