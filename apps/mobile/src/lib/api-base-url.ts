export const defaultApiBaseUrl = process.env.EXPO_PUBLIC_PULSE_API_URL?.trim() || 'https://pulse-crm.theclustox.com';

const allowedApiHosts = new Set(['pulse-crm.theclustox.com', 'localhost', '127.0.0.1']);

export function normalizeApiBaseUrl(value: string) {
  const trimmed = value.trim() || defaultApiBaseUrl;
  const parsed = new URL(trimmed);
  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !isLocal) {
    throw new Error('Pulse API connection must use HTTPS.');
  }
  if (!allowedApiHosts.has(parsed.hostname)) {
    throw new Error('This API host is not approved for Pulse Field.');
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.toString().replace(/\/$/, '');
}
