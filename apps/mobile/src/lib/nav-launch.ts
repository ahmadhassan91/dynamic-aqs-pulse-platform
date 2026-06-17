import { Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { buildNavUrls, isNavProvider, type NavProvider, type NavTarget } from './external-nav';

// Native side of the external-nav handoff (RTE-P1): open the chosen provider and remember it. Kept out
// of external-nav.ts so that module stays free of native imports and unit-testable.

const LAST_NAV_PROVIDER_KEY = 'pulse.nav.lastProvider';

// Open the provider's native app for the target, falling back to the https URL when the app scheme is
// unavailable. canOpenURL returns false when: the app isn't installed; on iOS, the scheme isn't in
// LSApplicationQueriesSchemes (added for comgooglemaps/waze in app.json); and on Android 11+, the
// scheme isn't declared in the manifest <queries>. We do NOT declare Android <queries>, so on Android
// custom schemes intentionally fall through to the https URL — Android App Links route that to the
// installed Google Maps/Waze app anyway. (Adding an expo-build-properties android.queries entry would
// let canOpenURL detect the app directly; deferred as a polish follow-up.)
export async function openNav(provider: NavProvider, target: NavTarget): Promise<void> {
  const { appUrl, webUrl } = buildNavUrls(provider, target);
  try {
    const canOpenApp = await Linking.canOpenURL(appUrl);
    await Linking.openURL(canOpenApp ? appUrl : webUrl);
  } catch {
    await Linking.openURL(webUrl).catch(() => {});
  }
}

export async function loadLastNavProvider(): Promise<NavProvider | null> {
  try {
    const value = await SecureStore.getItemAsync(LAST_NAV_PROVIDER_KEY);
    return isNavProvider(value) ? value : null;
  } catch {
    return null;
  }
}

export async function saveLastNavProvider(provider: NavProvider): Promise<void> {
  await SecureStore.setItemAsync(LAST_NAV_PROVIDER_KEY, provider).catch(() => {});
}
