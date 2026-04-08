import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import {
  badRequestResponse,
  jsonResponse,
  methodNotAllowedResponse,
  notFoundResponse,
  readJsonBody,
  serviceUnavailableResponse,
  unauthorizedResponse,
} from '../../utils/http.js';
import {
  captureSourceSnapshots,
  createMigrationRun,
  getMigrationRunSummary,
  normalizeMigrationSnapshots,
  stageMigrationRecords,
} from './service.js';
import type {
  CaptureSourceSnapshotsRequest,
  CreateMigrationRunRequest,
  NormalizeMigrationSnapshotsRequest,
  StageMigrationRecordsRequest,
} from './types.js';

const MIGRATION_TOKEN_HEADER = 'x-pulse-migration-token';

export async function handleMigrationRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  adminToken?: string,
) {
  const method = req.method ?? 'GET';
  const pathname = url.pathname;
  const isMigrationRoute =
    pathname === '/api/v1/migrations/runs'
    || /^\/api\/v1\/migrations\/runs\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/migrations\/runs\/[^/]+\/snapshots$/.test(pathname)
    || /^\/api\/v1\/migrations\/runs\/[^/]+\/normalize$/.test(pathname)
    || /^\/api\/v1\/migrations\/runs\/[^/]+\/stage$/.test(pathname);

  if (!isMigrationRoute) {
    return false;
  }

  if (!adminToken) {
    return serviceUnavailableResponse(res, 'Migration endpoints are disabled until MIGRATION_ADMIN_TOKEN is configured');
  }

  if (!requestHasValidAdminToken(req, adminToken)) {
    return unauthorizedResponse(res, 'Missing or invalid migration admin token', {
      header: MIGRATION_TOKEN_HEADER,
    });
  }

  if (pathname === '/api/v1/migrations/runs') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(res, method, ['POST']);
    }

    try {
      const body = (await readJsonBody(req)) as CreateMigrationRunRequest;
      const run = await createMigrationRun(body);
      return jsonResponse(res, 201, run);
    } catch (error) {
      return badRequestResponse(res, error instanceof Error ? error.message : String(error));
    }
  }

  const runMatch = pathname.match(/^\/api\/v1\/migrations\/runs\/([^/]+)$/);
  if (runMatch) {
    const runId = runMatch[1];
    if (!runId) {
      return false;
    }

    if (method !== 'GET') {
      return methodNotAllowedResponse(res, method, ['GET']);
    }

    const summary = await getMigrationRunSummary(runId);
    if (!summary) {
      return notFoundResponse(res, {
        entity: 'MigrationRun',
        id: runId,
      });
    }

    return jsonResponse(res, 200, summary);
  }

  const snapshotMatch = pathname.match(/^\/api\/v1\/migrations\/runs\/([^/]+)\/snapshots$/);
  if (snapshotMatch) {
    const runId = snapshotMatch[1];
    if (!runId) {
      return false;
    }

    if (method !== 'POST') {
      return methodNotAllowedResponse(res, method, ['POST']);
    }

    try {
      const body = (await readJsonBody(req)) as CaptureSourceSnapshotsRequest;
      const result = await captureSourceSnapshots(runId, body);
      return jsonResponse(res, 202, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message.includes('not found') ? 404 : 400;
      if (statusCode === 404) {
        return notFoundResponse(res, { detail: message });
      }

      return badRequestResponse(res, message);
    }
  }

  const stageMatch = pathname.match(/^\/api\/v1\/migrations\/runs\/([^/]+)\/stage$/);
  if (stageMatch) {
    const runId = stageMatch[1];
    if (!runId) {
      return false;
    }

    if (method !== 'POST') {
      return methodNotAllowedResponse(res, method, ['POST']);
    }

    try {
      const body = (await readJsonBody(req)) as StageMigrationRecordsRequest;
      const result = await stageMigrationRecords(runId, body);
      return jsonResponse(res, 202, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message.includes('not found') ? 404 : 400;
      if (statusCode === 404) {
        return notFoundResponse(res, { detail: message });
      }

      return badRequestResponse(res, message);
    }
  }

  const normalizeMatch = pathname.match(/^\/api\/v1\/migrations\/runs\/([^/]+)\/normalize$/);
  if (normalizeMatch) {
    const runId = normalizeMatch[1];
    if (!runId) {
      return false;
    }

    if (method !== 'POST') {
      return methodNotAllowedResponse(res, method, ['POST']);
    }

    try {
      const body = (await readJsonBody(req)) as NormalizeMigrationSnapshotsRequest;
      const result = await normalizeMigrationSnapshots(runId, body);
      return jsonResponse(res, 202, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = message.includes('not found') ? 404 : 400;
      if (statusCode === 404) {
        return notFoundResponse(res, { detail: message });
      }

      return badRequestResponse(res, message);
    }
  }

  return false;
}

function requestHasValidAdminToken(req: IncomingMessage, adminToken: string) {
  const headerValue = req.headers[MIGRATION_TOKEN_HEADER];
  const providedToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!providedToken) {
    return false;
  }

  const expectedBuffer = Buffer.from(adminToken);
  const providedBuffer = Buffer.from(providedToken);
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
