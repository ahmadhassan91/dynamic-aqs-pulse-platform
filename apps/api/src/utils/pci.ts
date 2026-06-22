// PCI boundary guard (NFR-CIS-03 / BR-CIS-03 / BR-L-08).
//
// Raw payment-card numbers must never be written to any Pulse table, log, or audit record. The card-on-file
// capture path is hosted/tokenized, so a PAN never legitimately reaches Pulse — but users can still paste a
// card number into a free-text field (a CIS note, a lead note, the public CIS form). Discovery sessions
// flagged exactly this: "some CIS do have credit cards in them."
//
// This is a defense-in-depth guard for user-supplied free text. It rejects input that contains a Luhn-valid
// 13–19 digit sequence (the structure of a real PAN), allowing spaces or dashes as group separators so that
// "4111 1111 1111 1111" and "4111-1111-1111-1111" are both caught. It deliberately keys on Luhn validity to
// keep false positives low — arbitrary long numbers (order IDs, phone strings) almost never satisfy Luhn.

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

/** Returns true when the text appears to contain a payment card number (a Luhn-valid 13–19 digit run). */
export function containsLikelyPaymentCardNumber(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  // A digit, then 12–18 more digits each optionally preceded by a single space or dash (13–19 digits total).
  const candidatePattern = /\d(?:[ -]?\d){12,18}/g;
  for (const match of value.matchAll(candidatePattern)) {
    const digits = match[0].replace(/[ -]/g, '');
    if (digits.length >= 13 && digits.length <= 19 && passesLuhnChecksum(digits)) {
      return true;
    }
  }

  return false;
}

/**
 * Throws if `value` contains a likely payment card number. Call this on every user-supplied free-text field
 * that is persisted on the CIS / lead boundary, so raw PAN data is refused rather than stored.
 */
const PCI_REJECTION_SUFFIX =
  'appears to contain payment card data, which cannot be stored in Pulse. Remove the card number; card-on-file capture is handled through the secure hosted payment step.';

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
