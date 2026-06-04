import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AuthBundle } from '@/lib/api';

const sessionKey = 'pulse.field.session.v1';
const chunkManifestKey = `${sessionKey}.chunks`;
const chunkKeyPrefix = `${sessionKey}.chunk.`;
const maxSecureStoreValueLength = 1800;
const maxSessionChunks = 16;

export type StoredSession = {
  apiBaseUrl?: string;
  auth: AuthBundle;
};

export async function loadStoredSession() {
  const value = await readSessionValue();
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (isStoredSessionEnvelope(parsed)) {
      return parsed;
    }
    if (isStoredAuthBundle(parsed)) {
      return { auth: parsed };
    }
    await clearStoredSession();
    return null;
  } catch {
    await clearStoredSession();
    return null;
  }
}

export async function saveStoredSession(session: StoredSession) {
  await writeSessionValue(JSON.stringify(session));
}

export async function clearStoredSession() {
  await deleteSessionValue();
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

async function readSessionValue() {
  if (Platform.OS === 'web') {
    return readValue(sessionKey);
  }

  const manifestValue = await readValue(chunkManifestKey);
  if (!manifestValue) {
    return readValue(sessionKey);
  }

  try {
    const manifest = JSON.parse(manifestValue) as { count?: unknown };
    const count = typeof manifest.count === 'number' ? manifest.count : 0;
    if (!Number.isInteger(count) || count < 1 || count > maxSessionChunks) {
      await deleteSessionValue();
      return null;
    }

    const chunks = await Promise.all(Array.from({ length: count }, (_, index) => readValue(`${chunkKeyPrefix}${index}`)));
    if (chunks.some((chunk) => chunk === null)) {
      await deleteSessionValue();
      return null;
    }

    return chunks.join('');
  } catch {
    await deleteSessionValue();
    return null;
  }
}

async function writeSessionValue(value: string) {
  if (Platform.OS === 'web') {
    await writeValue(sessionKey, value);
    return;
  }

  await deleteSessionValue();

  const chunks = splitSecureStoreValue(value);
  try {
    await Promise.all(chunks.map((chunk, index) => writeValue(`${chunkKeyPrefix}${index}`, chunk)));
    await writeValue(chunkManifestKey, JSON.stringify({ count: chunks.length }));
  } catch (error) {
    await deleteSessionValue();
    throw error;
  }
}

async function deleteSessionValue() {
  await deleteValue(sessionKey);
  await deleteValue(chunkManifestKey);
  await Promise.all(Array.from({ length: maxSessionChunks }, (_, index) => deleteValue(`${chunkKeyPrefix}${index}`)));
}

function splitSecureStoreValue(value: string) {
  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; offset += maxSecureStoreValueLength) {
    chunks.push(value.slice(offset, offset + maxSecureStoreValueLength));
  }
  return chunks.length ? chunks : [''];
}

function isStoredSessionEnvelope(value: unknown): value is StoredSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredSession>;
  return Boolean(candidate.auth && isStoredAuthBundle(candidate.auth));
}

function isStoredAuthBundle(value: unknown): value is AuthBundle {
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
