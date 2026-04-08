import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { AppConfig } from './config.js';
import { createInMemoryQueueManager } from './queue/queue-manager.js';
import { createWorkerRuntime } from './worker/worker-runtime.js';
import { createAcumaticaClient } from '@pulse/acumatica';
import { createAppLogger, type AppLogger } from './utils/logger.js';
import { jsonResponse, notFoundResponse } from './utils/http.js';

export function createPulseServer(config: AppConfig) {
  const logger = createAppLogger(config.logging.level);
  const queue = createInMemoryQueueManager(logger);
  const workers = createWorkerRuntime(queue, logger);
  const acumatica = createAcumaticaClient({
    baseUrl: config.acumatica.baseUrl,
    apiVersion: config.acumatica.apiVersion,
    company: config.acumatica.company,
    username: config.acumatica.username,
    password: config.acumatica.password,
    accessToken: config.acumatica.accessToken,
    logger,
  });

  queue.register('system.health-check', async () => ({ ok: true }));
  workers.register('system.health-check', async () => ({ ok: true }));
  queue.start();
  workers.start();

  return createServer(async (req, res) => {
    await routeRequest(req, res, { config, logger, queue, workers, acumatica });
  });
}

type RequestContext = {
  config: AppConfig;
  logger: AppLogger;
  queue: ReturnType<typeof createInMemoryQueueManager>;
  workers: ReturnType<typeof createWorkerRuntime>;
  acumatica: ReturnType<typeof createAcumaticaClient>;
};

async function routeRequest(req: IncomingMessage, res: ServerResponse, ctx: RequestContext) {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (method === 'GET' && (url.pathname === '/health/live' || url.pathname === '/api/v1/health/live')) {
    return jsonResponse(res, 200, {
      status: 'ok',
      phase: 'live',
      service: ctx.config.app.name,
    });
  }

  if (method === 'GET' && (url.pathname === '/health/ready' || url.pathname === '/api/v1/health/ready')) {
    const acumaticaStatus = await ctx.acumatica.healthCheck();
    return jsonResponse(res, 200, {
      status: 'ok',
      phase: 'ready',
      queue: ctx.queue.status(),
      workers: ctx.workers.status(),
      acumatica: acumaticaStatus,
    });
  }

  if (method === 'GET' && url.pathname === '/api/v1/meta') {
    return jsonResponse(res, 200, {
      service: ctx.config.app.name,
      version: ctx.config.app.version,
      environment: ctx.config.environment.name,
      segmentAware: true,
      dataCore: 'postgresql',
    });
  }

  if (method === 'GET' && url.pathname === '/api/v1/health/acumatica') {
    return jsonResponse(res, 200, await ctx.acumatica.healthCheck());
  }

  if (method === 'POST' && url.pathname === '/api/v1/jobs/health-check') {
    const job = await ctx.queue.enqueue('system.health-check', {
      requestId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
    return jsonResponse(res, 202, job);
  }

  return notFoundResponse(res, {
    path: url.pathname,
    method,
  });
}

