// Per-contact tap-to-call / tap-to-email URL builders (FR-MOB-035). Pure — no native imports —
// so it is unit-testable under `node --test`; the native Linking.openURL call lives in the screen.
// Mirrors external-nav.ts: free OS URL schemes (tel:/mailto:), no provider, no key.

// Keep a leading + (country code), drop everything except digits. Returns null when no number.
export function buildTelUrl(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `tel:${hasPlus ? '+' : ''}${digits}`;
}

export function buildMailtoUrl(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  if (!trimmed) return null;
  return `mailto:${trimmed}`;
}

// Prefer the main phone, fall back to mobile. Returns null when neither is usable.
export function chooseCallNumber(contact: { phone?: string | null; mobilePhone?: string | null }): string | null {
  const phone = contact.phone?.trim();
  if (phone) return phone;
  const mobile = contact.mobilePhone?.trim();
  if (mobile) return mobile;
  return null;
}
