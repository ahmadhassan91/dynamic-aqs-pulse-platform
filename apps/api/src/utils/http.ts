import type { IncomingMessage, ServerResponse } from 'node:http';

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

export function serviceUnavailableResponse(res: ServerResponse, detail: unknown, extras?: Record<string, unknown>) {
  return jsonResponse(res, 503, {
    error: 'SERVICE_UNAVAILABLE',
    detail,
    ...(extras ?? {}),
  });
}

export async function readJsonBody(req: IncomingMessage, maxBytes = 1_000_000): Promise<unknown> {
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
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(error instanceof Error ? `Invalid JSON body: ${error.message}` : 'Invalid JSON body');
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { detail: value };
}
