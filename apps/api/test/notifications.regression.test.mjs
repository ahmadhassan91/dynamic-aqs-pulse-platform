import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let listUserNotifications;
let getUnreadNotificationCount;
let markNotificationsRead;
let archiveNotification;
let upsertUserNotification;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  const configModule = await import('../dist/config.js');
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));
  ({ listUserNotifications, getUnreadNotificationCount, markNotificationsRead, archiveNotification, upsertUserNotification } = await import('../dist/modules/notifications/service.js'));
  config = configModule.loadAppConfig(process.env);
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
  await ensureBootstrapAdminSeeded(config);
});

async function adminActor() {
  const auth = await loginWithPassword(
    config,
    { email: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL, password: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD },
    {},
  );
  return {
    userId: auth.identity.userId,
    sessionId: auth.session.sessionId,
    role: auth.identity.role,
    actorType: auth.identity.actorType,
    email: auth.identity.email,
    displayName: auth.identity.displayName ?? 'Admin',
  };
}

async function makeUser(email) {
  const user = await prisma.user.create({ data: { email, displayName: email, roleCode: 'TERRITORY_MANAGER', userType: 'INTERNAL', isActive: true } });
  return { userId: user.id, sessionId: `test-${user.id}`, role: 'TERRITORY_MANAGER', actorType: 'internal', email: user.email, displayName: user.displayName };
}

test('per-user notification inbox: list, count, mark-read, archive, scoping, idempotent upsert', SERIAL, async () => {
  const actor = await adminActor();
  const other = await makeUser('other-notif@pulse.local');

  await upsertUserNotification({ recipientUserId: actor.userId, category: 'lead', eventType: 'lead_assigned', title: 'New lead', severity: 'warning', dedupeKey: 'k1', deepLinkType: 'lead', deepLinkId: 'lead-1' });
  await upsertUserNotification({ recipientUserId: actor.userId, category: 'consignment', eventType: 'rose_overdue', title: 'ROSE overdue', severity: 'critical', dedupeKey: 'k2' });
  await upsertUserNotification({ recipientUserId: other.userId, category: 'lead', eventType: 'lead_assigned', title: 'Not yours', dedupeKey: 'k1' });

  // Idempotent: re-upsert with the same (user, dedupeKey) refreshes, does not duplicate.
  await upsertUserNotification({ recipientUserId: actor.userId, category: 'lead', eventType: 'lead_assigned', title: 'New lead (updated)', severity: 'warning', dedupeKey: 'k1' });

  const list = await listUserNotifications(actor, {});
  assert.equal(list.total, 2);
  assert.equal(list.unreadCount, 2);
  assert.equal(list.items.every((n) => n.isRead === false), true);

  assert.equal((await getUnreadNotificationCount(actor)).unreadCount, 2);
  assert.equal((await listUserNotifications(actor, { status: 'unread' })).items.length, 2);

  const consignment = await listUserNotifications(actor, { category: 'consignment' });
  assert.equal(consignment.total, 1);
  assert.equal(consignment.items[0].title, 'ROSE overdue');
  assert.equal(consignment.items[0].severity, 'critical');

  const leadNotification = list.items.find((n) => n.title.startsWith('New lead'));
  assert.ok(leadNotification);
  assert.equal(leadNotification.deepLinkType, 'lead');

  const markedOne = await markNotificationsRead(actor, { ids: [leadNotification.id] });
  assert.equal(markedOne.updated, 1);
  assert.equal(markedOne.unreadCount, 1);

  const markedAll = await markNotificationsRead(actor, { all: true });
  assert.equal(markedAll.unreadCount, 0);

  const archived = await archiveNotification(actor, leadNotification.id);
  assert.ok(archived);
  const afterArchive = await listUserNotifications(actor, {});
  assert.equal(afterArchive.total, 1); // archived excluded from the default feed
  assert.equal((await listUserNotifications(actor, { status: 'archived' })).total, 1);

  // Scoping: the other user only sees their own.
  const otherList = await listUserNotifications(other, {});
  assert.equal(otherList.total, 1);
  assert.equal(otherList.items[0].title, 'Not yours');

  // Cross-user mark-read is impossible: actor cannot affect other's notifications.
  assert.equal((await getUnreadNotificationCount(other)).unreadCount, 1);
});
