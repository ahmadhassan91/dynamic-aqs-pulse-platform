import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NAV_PROVIDERS,
  buildMultiStopGoogleUrl,
  buildNavUrls,
  isNavProvider,
  isValidTarget,
} from '../src/lib/external-nav.ts';

const target = { latitude: 30.2672, longitude: -97.7431, label: 'Austin HQ' };

test('buildNavUrls formats Apple Maps app + web links (lat/lng, driving)', () => {
  assert.deepEqual(buildNavUrls('apple', target), {
    appUrl: 'maps://?daddr=30.2672,-97.7431&dirflg=d',
    webUrl: 'https://maps.apple.com/?daddr=30.2672,-97.7431&dirflg=d',
  });
});

test('buildNavUrls formats Google Maps app + web links (driving directions)', () => {
  assert.deepEqual(buildNavUrls('google', target), {
    appUrl: 'comgooglemaps://?daddr=30.2672,-97.7431&directionsmode=driving',
    webUrl: 'https://www.google.com/maps/dir/?api=1&destination=30.2672,-97.7431&travelmode=driving',
  });
});

test('buildNavUrls formats Waze app + web links', () => {
  assert.deepEqual(buildNavUrls('waze', target), {
    appUrl: 'waze://?ll=30.2672,-97.7431&navigate=yes',
    webUrl: 'https://waze.com/ul?ll=30.2672,-97.7431&navigate=yes',
  });
});

test('buildMultiStopGoogleUrl returns null for fewer than 2 valid stops', () => {
  assert.equal(buildMultiStopGoogleUrl([]), null);
  assert.equal(buildMultiStopGoogleUrl([target]), null);
  // an invalid stop does not count toward the minimum
  assert.equal(buildMultiStopGoogleUrl([target, { latitude: NaN, longitude: 0 }]), null);
});

test('buildMultiStopGoogleUrl: 2 stops → first is a waypoint, last is the destination (origin = device)', () => {
  const url = buildMultiStopGoogleUrl([
    { latitude: 1, longitude: 2 },
    { latitude: 3, longitude: 4 },
  ]);
  assert.equal(
    url,
    'https://www.google.com/maps/dir/?api=1&destination=3%2C4&travelmode=driving&waypoints=1%2C2',
  );
});

test('buildMultiStopGoogleUrl: 3 stops → last is destination, the rest are waypoints', () => {
  const url = buildMultiStopGoogleUrl([
    { latitude: 1, longitude: 2 },
    { latitude: 3, longitude: 4 },
    { latitude: 5, longitude: 6 },
  ]);
  assert.equal(
    url,
    'https://www.google.com/maps/dir/?api=1&destination=5%2C6&travelmode=driving&waypoints=1%2C2%7C3%2C4',
  );
});

test('isValidTarget rejects missing, null, and non-finite coordinates', () => {
  assert.equal(isValidTarget(target), true);
  assert.equal(isValidTarget({ latitude: 0, longitude: 0 }), true);
  assert.equal(isValidTarget(null), false);
  assert.equal(isValidTarget(undefined), false);
  assert.equal(isValidTarget({ latitude: 1 }), false);
  assert.equal(isValidTarget({ latitude: NaN, longitude: 2 }), false);
  assert.equal(isValidTarget({ latitude: 1, longitude: null }), false);
});

test('isNavProvider guards the persisted-preference round-trip', () => {
  assert.equal(isNavProvider('waze'), true);
  assert.equal(isNavProvider('google'), true);
  assert.equal(isNavProvider('apple'), true);
  assert.equal(isNavProvider('bing'), false);
  assert.equal(isNavProvider(null), false);
  assert.equal(isNavProvider(undefined), false);
});

test('NAV_PROVIDERS covers exactly the three supported providers', () => {
  assert.deepEqual(NAV_PROVIDERS.map((p) => p.id).sort(), ['apple', 'google', 'waze']);
});
