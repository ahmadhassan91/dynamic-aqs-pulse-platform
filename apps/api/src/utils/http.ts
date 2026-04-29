import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';

export function jsonResponse(res: ServerResponse, statusCode: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'x-content-type-options': 'nosniff',
  });
  res.end(payload);
}

export function notFoundResponse(res: ServerResponse, body: unknown) {
  return jsonResponse(res, 404, {
    error: 'NOT_FOUND',
    ...asObject(body),
  });
}

export function badRequestResponse(res: ServerResponse, detail: unknown, extras?: Record<string, unknown>) {
  return jsonResponse(res, 400, {
    error: 'BAD_REQUEST',
    detail,
    ...(extras ?? {}),
  });
}

export function unauthorizedResponse(res: ServerResponse, detail: unknown, extras?: Record<string, unknown>) {
  return jsonResponse(res, 401, {
    error: 'UNAUTHORIZED',
    detail,
    ...(extras ?? {}),
  });
}

export function forbiddenResponse(res: ServerResponse, detail: unknown, extras?: Record<string, unknown>) {
  return jsonResponse(res, 403, {
    error: 'FORBIDDEN',
    detail,
    ...(extras ?? {}),
  });
}

export function methodNotAllowedResponse(res: ServerResponse, method: string, allowed: string[]) {
  res.setHeader('allow', allowed.join(', '));
  return jsonResponse(res, 405, {
    error: 'METHOD_NOT_ALLOWED',
    method,
    allowed,
  });
}

export function tooManyRequestsResponse(res: ServerResponse, detail: unknown, retryAfterSeconds: number, extras?: Record<string, unknown>) {
  res.setHeader('retry-after', String(Math.max(1, Math.ceil(retryAfterSeconds))));
  return jsonResponse(res, 429, {
    error: 'TOO_MANY_REQUESTS',
    detail,
    ...(extras ?? {}),
  });
}

export function serviceUnavailableResponse(res: ServerResponse, detail: unknown, extras?: Record<string, unknown>) {
  return jsonResponse(res, 503, {
    error: 'SERVICE_UNAVAILABLE',
    detail,
    ...(extras ?? {}),
  });
}

export async function readTextBody(req: IncomingMessage, maxBytes = 1_000_000): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      throw new Error(`Request body exceeds ${maxBytes} bytes`);
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return '';
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw;
}

export async function readJsonBody(req: IncomingMessage, maxBytes = 1_000_000): Promise<unknown> {
  const raw = await readTextBody(req, maxBytes);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(error instanceof Error ? `Invalid JSON body: ${error.message}` : 'Invalid JSON body');
  }
}

export function matchPath(pathname: string, pattern: string): Record<string, string> | null {
  const actualParts = pathname.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);

  if (actualParts.length !== patternParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (const [index, patternPart] of patternParts.entries()) {
    const actualPart = actualParts[index];
    if (!actualPart) {
      return null;
    }

    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = actualPart;
      continue;
    }

    if (patternPart !== actualPart) {
      return null;
    }
  }

  return params;
}

export function matchesPath(pathname: string, pattern: string) {
  return matchPath(pathname, pattern) !== null;
}

export function readTrimmedQuery(url: URL, key: string) {
  const value = url.searchParams.get(key)?.trim();
  return value ? value : undefined;
}

export function readIntegerQuery(url: URL, key: string) {
  const value = url.searchParams.get(key);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { detail: value };
}
