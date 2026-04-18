import { canPerformAction } from '@pulse/auth';
import type {
  CisFinanceDecisionRecord,
  CisFormDataRecord,
  CisPaymentCaptureAttemptRecord,
  CisPaymentVaultReferenceRecord,
} from '@pulse/contracts';
import type { AuthenticatedActor } from '../auth/types.js';

export function canViewCustomerFinancials(actor: Pick<AuthenticatedActor, 'role'>) {
  return canPerformAction(actor.role, 'customer.financials_view');
}

export function maskCisFormFinancialFields(
  actor: Pick<AuthenticatedActor, 'role'>,
  formData: CisFormDataRecord,
): CisFormDataRecord {
  if (canViewCustomerFinancials(actor)) {
    return formData;
  }

  const {
    apContactName: _apContactName,
    apDirectPhone: _apDirectPhone,
    apEmail: _apEmail,
    paymentMethod: _paymentMethod,
    achAuthorized: _achAuthorized,
    cardOnFileAuthorized: _cardOnFileAuthorized,
    ...masked
  } = formData;

  return masked;
}

export function maskCisFinanceDecisionFields(
  actor: Pick<AuthenticatedActor, 'role'>,
  financeDecision: CisFinanceDecisionRecord,
): CisFinanceDecisionRecord {
  if (canViewCustomerFinancials(actor)) {
    return financeDecision;
  }

  const {
    creditLineAmount: _creditLineAmount,
    paymentTerms: _paymentTerms,
    ...masked
  } = financeDecision;

  return masked;
}

export function maskCisPaymentCaptureAttemptFinancialFields(
  actor: Pick<AuthenticatedActor, 'role'>,
  attempt: CisPaymentCaptureAttemptRecord,
): CisPaymentCaptureAttemptRecord {
  if (canViewCustomerFinancials(actor)) {
    return attempt;
  }

  const {
    providerProfileId: _providerProfileId,
    providerResultCode: _providerResultCode,
    providerErrorMessage: _providerErrorMessage,
    bin: _bin,
    hasTemporaryToken: _hasTemporaryToken,
    ...masked
  } = attempt;

  return {
    ...masked,
    hasTemporaryToken: false,
  };
}

export function maskCisPaymentVaultReferenceFinancialFields(
  actor: Pick<AuthenticatedActor, 'role'>,
  reference: CisPaymentVaultReferenceRecord,
): CisPaymentVaultReferenceRecord {
  if (canViewCustomerFinancials(actor)) {
    return reference;
  }

  const {
    sourceCaptureAttemptId: _sourceCaptureAttemptId,
    last4: _last4,
    brand: _brand,
    authorizationCapturedAt: _authorizationCapturedAt,
    hasVaultToken: _hasVaultToken,
    hasVaultCustomerRef: _hasVaultCustomerRef,
    ...masked
  } = reference;

  return {
    ...masked,
    hasVaultToken: false,
    hasVaultCustomerRef: false,
  };
}
