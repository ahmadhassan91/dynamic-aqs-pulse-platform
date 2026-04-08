import type { AcumaticaErrorPayload } from './types.js';

export class AcumaticaClientError extends Error {
  readonly statusCode: number;
  readonly payload?: AcumaticaErrorPayload | undefined;

  constructor(message: string, statusCode: number, payload?: AcumaticaErrorPayload) {
    super(message);
    this.name = 'AcumaticaClientError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

export function normalizeAcumaticaError(payload: unknown, fallbackMessage: string): AcumaticaClientError {
  if (payload && typeof payload === 'object') {
    const typed = payload as AcumaticaErrorPayload;
    return new AcumaticaClientError(
      typed.message || typed.exceptionMessage || fallbackMessage,
      500,
      typed,
    );
  }

  return new AcumaticaClientError(fallbackMessage, 500);
}
