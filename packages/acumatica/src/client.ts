import { AcumaticaClientError, normalizeAcumaticaError } from './errors.js';
import type { AcumaticaClientOptions, AcumaticaConfig, AcumaticaHealthStatus, AcumaticaRequestOptions } from './types.js';

function buildConfig(options: AcumaticaClientOptions = {}): AcumaticaConfig {
  const username = options.username?.trim();
  const password = options.password?.trim();
  const accessToken = options.accessToken?.trim();

  return {
    baseUrl: options.baseUrl?.trim() || 'https://example.acumatica.local',
    apiVersion: options.apiVersion?.trim() || '24.100.001',
    company: options.company?.trim() || 'Dynamic AQS',
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
    ...(accessToken ? { accessToken } : {}),
  };
}

function serializeQuery(query?: AcumaticaRequestOptions['query']) {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export class AcumaticaClient {
  private readonly config: AcumaticaConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
  private sessionCookie: string | undefined;

  constructor(options: AcumaticaClientOptions = {}) {
    this.config = buildConfig(options);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.logger = options.logger ?? console;
  }

  get endpointBase() {
    return `${this.config.baseUrl.replace(/\/$/, '')}/entity/${this.config.apiVersion}/${this.config.company}`;
  }

  async login() {
    if (!this.config.username || !this.config.password) {
      throw new Error('Acumatica credentials are missing');
    }

    const response = await this.fetchImpl(`${this.config.baseUrl.replace(/\/$/, '')}/entity/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        name: this.config.username,
        password: this.config.password,
        company: this.config.company,
      }),
    });

    if (!response.ok) {
      throw await this.asClientError(response, 'Acumatica login failed');
    }

    const cookie = response.headers.get('set-cookie');
    if (cookie) {
      this.sessionCookie = cookie;
    }
  }

  async logout() {
    await this.request('POST', 'auth/logout');
    this.sessionCookie = undefined;
  }

  async healthCheck(): Promise<AcumaticaHealthStatus> {
    const checkedAt = new Date().toISOString();
    try {
      const response = await this.fetchImpl(`${this.endpointBase}/$metadata`, {
        method: 'GET',
        headers: this.headers(),
      });
      return {
        ok: response.ok,
        statusCode: response.status,
        endpoint: `${this.endpointBase}/$metadata`,
        checkedAt,
        ...(response.ok ? {} : { error: await response.text() }),
      };
    } catch (error) {
      return {
        ok: false,
        statusCode: 503,
        endpoint: `${this.endpointBase}/$metadata`,
        checkedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async get<T>(entity: string, options: AcumaticaRequestOptions = {}): Promise<T> {
    return this.request<T>('GET', entity, undefined, options);
  }

  async post<T>(entity: string, body: unknown, options: AcumaticaRequestOptions = {}): Promise<T> {
    return this.request<T>('POST', entity, body, options);
  }

  async put<T>(entity: string, body: unknown, options: AcumaticaRequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', entity, body, options);
  }

  async delete(entity: string, options: AcumaticaRequestOptions = {}) {
    await this.request<void>('DELETE', entity, undefined, options);
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    entity: string,
    body?: unknown,
    options: AcumaticaRequestOptions = {},
  ): Promise<T> {
    const requestInit: RequestInit = {
      method,
      headers: {
        ...this.headers(),
        ...options.headers,
      },
    };

    if (body !== undefined) {
      requestInit.body = JSON.stringify(body);
    }

    const response = await this.fetchImpl(`${this.endpointBase}/${entity}${serializeQuery(options.query)}`, requestInit);

    if (response.status === 401 && !this.config.accessToken && this.config.username && this.config.password) {
      await this.login();
      return this.request<T>(method, entity, body, options);
    }

    if (!response.ok) {
      throw await this.asClientError(response, `Acumatica ${method} ${entity} failed`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private headers() {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/json',
    };

    if (this.config.accessToken) {
      headers.authorization = `Bearer ${this.config.accessToken}`;
    } else if (this.sessionCookie) {
      headers.cookie = this.sessionCookie;
    }

    return headers;
  }

  private async asClientError(response: Response, fallback: string) {
    let payload: unknown = undefined;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text();
    }
    const error = normalizeAcumaticaError(payload, fallback);
    return new AcumaticaClientError(error.message, response.status, error.payload);
  }
}

export function createAcumaticaClient(options: AcumaticaClientOptions = {}) {
  return new AcumaticaClient(options);
}
