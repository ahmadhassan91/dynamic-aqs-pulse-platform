export type AcumaticaConfig = {
  baseUrl: string;
  apiVersion: string;
  company: string;
  username?: string | undefined;
  password?: string | undefined;
  accessToken?: string | undefined;
};

export type AcumaticaErrorPayload = {
  message?: string;
  exceptionMessage?: string;
  innerException?: string;
  type?: string;
};

export type AcumaticaClientOptions = Partial<AcumaticaConfig> & {
  logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
  fetchImpl?: typeof fetch;
};

export type AcumaticaRequestOptions = {
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
};

export type AcumaticaHealthStatus = {
  ok: boolean;
  statusCode: number;
  endpoint: string;
  checkedAt: string;
  error?: string | undefined;
};
