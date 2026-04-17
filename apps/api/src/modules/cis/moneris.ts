type NormalizeMonerisHostedCaptureResultInput = {
  responseCode: string | undefined;
  errorMessage: string | undefined;
  temporaryToken: string | undefined;
  bin: string | undefined;
  rawProviderPayload: unknown;
};

export type NormalizedMonerisHostedCaptureResult = {
  responseCode?: string;
  errorMessage?: string;
  temporaryToken?: string;
  bin?: string;
  rawProviderPayload?: Record<string, unknown>;
};

export function normalizeMonerisHostedCaptureResult(
  input: NormalizeMonerisHostedCaptureResultInput,
): NormalizedMonerisHostedCaptureResult {
  const rawProviderPayload = normalizeMonerisPayloadRecord(input.rawProviderPayload);
  const nestedResponse = getNestedRecord(rawProviderPayload, 'response');

  const responseCode = firstDefinedString(
    input.responseCode,
    readOptionalString(rawProviderPayload?.responseCode),
    readOptionalString(rawProviderPayload?.response_code),
    readOptionalString(nestedResponse?.responseCode),
    readOptionalString(nestedResponse?.response_code),
  );
  const errorMessage = firstDefinedString(
    input.errorMessage,
    readOptionalString(rawProviderPayload?.errorMessage),
    readOptionalString(rawProviderPayload?.error_message),
    readOptionalString(rawProviderPayload?.message),
    readOptionalString(nestedResponse?.errorMessage),
    readOptionalString(nestedResponse?.error_message),
    readOptionalString(nestedResponse?.message),
  );
  const temporaryToken = firstDefinedString(
    input.temporaryToken,
    readOptionalString(rawProviderPayload?.temporaryToken),
    readOptionalString(rawProviderPayload?.dataKey),
    readOptionalString(rawProviderPayload?.data_key),
    readOptionalString(nestedResponse?.temporaryToken),
    readOptionalString(nestedResponse?.dataKey),
    readOptionalString(nestedResponse?.data_key),
  );
  const bin = firstDefinedString(
    input.bin,
    readOptionalString(rawProviderPayload?.bin),
    readOptionalString(rawProviderPayload?.bin_number),
    readOptionalString(nestedResponse?.bin),
    readOptionalString(nestedResponse?.bin_number),
  );

  return {
    ...(responseCode ? { responseCode } : {}),
    ...(errorMessage ? { errorMessage } : {}),
    ...(temporaryToken ? { temporaryToken } : {}),
    ...(bin ? { bin } : {}),
    ...(rawProviderPayload ? { rawProviderPayload } : {}),
  };
}

function normalizeMonerisPayloadRecord(value: unknown): Record<string, unknown> | undefined {
  if (isObjectRecord(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (isObjectRecord(parsed)) {
      return parsed;
    }
  } catch {
    // Fall through to query-string parsing.
  }

  const params = new URLSearchParams(trimmed);
  if (params.size === 0) {
    return undefined;
  }

  const record: Record<string, unknown> = {};
  for (const [key, entry] of params.entries()) {
    record[key] = entry;
  }

  return record;
}

function getNestedRecord(
  source: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | undefined {
  const value = source?.[key];
  return isObjectRecord(value) ? value : undefined;
}

function firstDefinedString(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0);
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
