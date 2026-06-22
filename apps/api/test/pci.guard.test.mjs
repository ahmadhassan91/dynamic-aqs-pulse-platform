import test from 'node:test';
import assert from 'node:assert/strict';

const { containsLikelyPaymentCardNumber, assertNoRawPaymentCardData, assertNoRawPaymentCardDataInRecord } =
  await import('../dist/utils/pci.js');

test('containsLikelyPaymentCardNumber detects Luhn-valid card numbers in free text', () => {
  assert.equal(containsLikelyPaymentCardNumber('4111111111111111'), true); // Visa test PAN
  assert.equal(containsLikelyPaymentCardNumber('pay with 4242 4242 4242 4242 please'), true); // spaced
  assert.equal(containsLikelyPaymentCardNumber('card 4111-1111-1111-1111'), true); // dashed
  assert.equal(containsLikelyPaymentCardNumber('378282246310005'), true); // Amex 15-digit test PAN
  assert.equal(containsLikelyPaymentCardNumber('5555555555554444'), true); // Mastercard test PAN
});

test('containsLikelyPaymentCardNumber does not flag ordinary text or non-card numbers', () => {
  assert.equal(containsLikelyPaymentCardNumber(undefined), false);
  assert.equal(containsLikelyPaymentCardNumber(''), false);
  assert.equal(containsLikelyPaymentCardNumber('Call me at 555-100-2200'), false); // too few digits
  assert.equal(containsLikelyPaymentCardNumber('4242424242424241'), false); // 16 digits, fails Luhn
  assert.equal(containsLikelyPaymentCardNumber('Customer prefers email contact only'), false);
});

test('assertNoRawPaymentCardData throws on a PAN and is silent otherwise', () => {
  assert.throws(() => assertNoRawPaymentCardData('balance to 4111 1111 1111 1111', 'CIS note'), /payment card data/i);
  assert.doesNotThrow(() => assertNoRawPaymentCardData('Customer prefers email contact', 'CIS note'));
  assert.doesNotThrow(() => assertNoRawPaymentCardData(undefined, 'CIS note'));
});

test('assertNoRawPaymentCardDataInRecord scans every string value of a form', () => {
  assert.throws(
    () => assertNoRawPaymentCardDataInRecord({ companyName: 'ACME', notes: 'card 4111111111111111' }, 'The CIS form'),
    /payment card data/i,
  );
  assert.doesNotThrow(() =>
    assertNoRawPaymentCardDataInRecord(
      { companyName: 'ACME HVAC', numOfTechs: 4, primaryContactName: 'Jane Doe', companyWebsite: 'acme.example.com' },
      'The CIS form',
    ),
  );
  assert.doesNotThrow(() => assertNoRawPaymentCardDataInRecord(null));
});
