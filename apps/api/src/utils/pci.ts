// PCI boundary guard (NFR-CIS-03 / BR-CIS-03 / BR-L-08).
//
// Raw payment-card numbers must never be written to any Pulse table, log, or audit record. The card-on-file
// capture path is hosted/tokenized (and, per the 2026-04-20 client signal, being eliminated), so a PAN never
// legitimately reaches Pulse — but users can still paste a card number into a free-text field (a CIS note, a
// lead note, the public CIS form). Discovery sessions flagged exactly this: "some CIS do have credit cards in
// them."
//
// This is a defense-in-depth guard for user-supplied free text. It rejects input that contains a Luhn-valid
// 13–19 digit sequence with a payment-card prefix (the structure of a real PAN). It keys on the Major Industry
// Identifier + Luhn checksum to keep false positives low — timestamps, order IDs, and phone numbers almost
// never satisfy both.

/** Returns true when the all-digits string satisfies the Luhn checksum (the structure of a card PAN). */
function passesLuhnChecksum(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = digits.charCodeAt(i) - 48; // '0' === 48
    if (double) {
      value *= 2;
      if (value > 9) {
        value -= 9;
      }
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

// Invisible copy-paste artifacts (soft hyphen U+00AD, zero-width space/non-joiner/joiner U+200B–U+200D, BOM
// U+FEFF) — stripped entirely before matching so a PAN obfuscated with them ("4111<zwsp>1111…") is still seen.
const INVISIBLE_FORMATTING = /[\u00ad\u200b\u200c\u200d\ufeff]/g;

// Card-shaped separators between digit groups: any whitespace (space, tab, newline, no-break / thin / unicode
// spaces — all covered by \s), a dot, and ASCII / Unicode hyphens (U+2010–U+2015, U+002D). Deliberately EXCLUDES
// comma / slash / colon / parentheses — those are list, date, time, and phone punctuation, and matching across
// them would wrongly flag CSV number lists, dates, and parenthesised phone numbers (worsening the phone
// false-positive). A pasted PAN uses no separator, spaces, dashes, or dots, so this catches the realistic
// copy-paste formats without the false-positive blow-up of an "any non-digit separator" rule. A single
// separator is allowed between digits (not a greedy run), so "1234, 5678, …"-style lists do not concatenate.
const PAN_CANDIDATE = /\d(?:[\s.\u2010-\u2015\u002d]?\d){12,18}/g;

/** Returns true when the text appears to contain a payment card number (a Luhn-valid 13–19 digit PAN). */
export function containsLikelyPaymentCardNumber(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.replace(INVISIBLE_FORMATTING, '');
  for (const match of normalized.matchAll(PAN_CANDIDATE)) {
    const digits = match[0].replace(/\D/g, '');
    // Require length 13–19, a payment-card Major Industry Identifier (2–6: Visa 4, Mastercard 2/5, Amex 3,
    // Discover 6, Diners/JCB 3/6), and a valid Luhn checksum. The MII + Luhn combination keeps every real
    // consumer card while excluding the common Luhn-valid-by-chance false positives — millisecond timestamps
    // (start with 1) and most order / account / phone IDs.
    if (digits.length >= 13 && digits.length <= 19 && /^[2-6]/.test(digits) && passesLuhnChecksum(digits)) {
      return true;
    }
  }

  return false;
}

const PCI_REJECTION_SUFFIX =
  'appears to contain payment card data, which cannot be stored in Pulse. Remove the card number; card-on-file capture is handled through the secure hosted payment step.';

/**
 * Throws if `value` contains a likely payment card number. Call this on every user-supplied free-text field
 * that is persisted on the CIS / lead boundary, so raw PAN data is refused rather than stored.
 */
export function assertNoRawPaymentCardData(value: string | null | undefined, fieldName: string): void {
  if (containsLikelyPaymentCardNumber(value)) {
    throw new Error(`${fieldName} ${PCI_REJECTION_SUFFIX}`);
  }
}

/**
 * Scans every string value of a record (one level deep) for a likely payment card number. Use on a submitted
 * structured form (e.g. the public CIS form) so a PAN typed into any field — not just a field named like a
 * card — is refused before the form is persisted.
 */
export function assertNoRawPaymentCardDataInRecord(
  record: object | null | undefined,
  fieldLabel = 'This form',
): void {
  if (!record) {
    return;
  }

  for (const value of Object.values(record)) {
    if (typeof value === 'string' && containsLikelyPaymentCardNumber(value)) {
      throw new Error(`${fieldLabel} ${PCI_REJECTION_SUFFIX}`);
    }
  }
}
