import type { ServerResponse } from 'node:http';

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

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { detail: value };
}

