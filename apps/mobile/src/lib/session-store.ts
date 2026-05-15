import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AuthBundle } from '@/lib/api';

const sessionKey = 'pulse.field.session.v1';

export async function loadStoredSession() {
  const value = await readValue(sessionKey);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (isStoredSession(parsed)) {
      return parsed;
    }
    await clearStoredSession();
    return null;
  } catch {
    await clearStoredSession();
    return null;
  }
}

export async function saveStoredSession(session: AuthBundle) {
  await writeValue(sessionKey, JSON.stringify(session));
}

export async function clearStoredSession() {
  await deleteValue(sessionKey);
}

async function readValue(key: string) {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function writeValue(key: string, value: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteValue(key: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function isStoredSession(value: unknown): value is AuthBundle {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuthBundle>;
  return Boolean(
    candidate.identity
      && typeof candidate.identity === 'object'
      && candidate.identity.userId
      && candidate.tokens
      && typeof candidate.tokens === 'object'
      && candidate.tokens.accessToken
      && candidate.tokens.refreshToken
      && candidate.session
      && typeof candidate.session === 'object'
      && candidate.session.sessionId,
  );
}
