import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { prisma } from '@pulse/db';
import { createAcumaticaClient, type AcumaticaClient, type AcumaticaHealthStatus } from '@pulse/acumatica';
import type { AppConfig } from './config.js';
import { handleMigrationRoutes } from './modules/migrations/http.js';
import { SYSTEM_HEALTH_CHECK_QUEUE } from './queue/definitions.js';
import { createPgBossQueueManager } from './queue/queue-manager.js';
import type { QueueJobEnvelope, QueueManager } from './queue/contracts.js';
import { createWorkerRuntime } from './worker/worker-runtime.js';
import { jsonResponse, notFoundResponse } from './utils/http.js';
import { createAppLogger, type AppLogger } from './utils/logger.js';

export type PulseServerRuntime = {
  logger: AppLogger;
  server: Server;
  close: () => Promise<void>;
};

type RequestContext = {
  config: AppConfig;
  logger: AppLogger;
  queue: QueueManager;
  workers: ReturnType<typeof createWorkerRuntime>;
  createAcumatica: () => AcumaticaClient;
};

type DependencyHealth = {
  ok: boolean;
  checkedAt: string;
  error?: string | undefined;
};

export async function createPulseServer(config: AppConfig): Promise<PulseServerRuntime> {
  const logger = createAppLogger(config.logging.level);
  const queue = createPgBossQueueManager(config, logger);
  const workers = createWorkerRuntime(queue, logger);
  const createAcumatica = () =>
    createAcumaticaClient({
      baseUrl: config.acumatica.baseUrl,
      apiVersion: config.acumatica.apiVersion,
      company: config.acumatica.company,
      username: config.acumatica.username,
      password: config.acumatica.password,
      accessToken: config.acumatica.accessToken,
      logger,
    });

  workers.register(SYSTEM_HEALTH_CHECK_QUEUE, async (job) => ({
    ok: true,
    jobId: job.id,
    correlationId: job.payload.correlationId,
    processedAt: new Date().toISOString(),
  }));

  await prisma.$connect();

  try {
    await workers.start();
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }

  const server = createServer(async (req, res) => {
    await routeRequest(req, res, {
      config,
      logger,
      queue,
      workers,
      createAcumatica,
    });
  });

  let closed = false;

  return {
    logger,
    server,
    close: async () => {
      if (closed) {
        return;
      }

      closed = true;
      await Promise.allSettled([workers.stop(), closeHttpServer(server)]);
      await prisma.$disconnect();
      logger.info('app.shutdown.complete', {});
    },
  };
}

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
    const [database, queue, workers, acumatica] = await Promise.all([
      getDatabaseHealth(),
      ctx.queue.status(),
      ctx.workers.status(),
      getAcumaticaHealth(ctx.createAcumatica),
    ]);
    const ready = database.ok && queue.ok;

    return jsonResponse(res, ready ? 200 : 503, {
      status: ready ? 'ok' : 'degraded',
      phase: 'ready',
      database,
      queue,
      workers,
      acumatica,
    });
  }

  if (method === 'GET' && url.pathname === '/api/v1/meta') {
    return jsonResponse(res, 200, {
      service: ctx.config.app.name,
      version: ctx.config.app.version,
      environment: ctx.config.environment.name,
      segmentAware: true,
      dataCore: 'postgresql',
      queueRuntime: 'pg-boss',
    });
  }

  if (method === 'GET' && url.pathname === '/api/v1/health/db') {
    const database = await getDatabaseHealth();
    return jsonResponse(res, database.ok ? 200 : 503, database);
  }

  if (method === 'GET' && url.pathname === '/api/v1/health/queue') {
    const queue = await ctx.queue.status();
    return jsonResponse(res, queue.ok ? 200 : 503, queue);
  }

  if (method === 'GET' && url.pathname === '/api/v1/health/acumatica') {
    const acumatica = await getAcumaticaHealth(ctx.createAcumatica);
    return jsonResponse(res, acumatica.ok ? 200 : 503, acumatica);
  }

  if (method === 'POST' && url.pathname === '/api/v1/jobs/health-check') {
    const payload: QueueJobEnvelope<{ requestId: string; createdAt: string }> = {
      jobType: SYSTEM_HEALTH_CHECK_QUEUE.name,
      triggeredBy: 'system',
      triggerSource: 'api',
      correlationId: crypto.randomUUID(),
      data: {
        requestId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      },
      metadata: {
        singletonKey: 'system-health-check',
      },
    };

    const job = await ctx.queue.enqueue(SYSTEM_HEALTH_CHECK_QUEUE, payload);
    return jsonResponse(res, 202, job);
  }

  const migrationRouteHandled = await handleMigrationRoutes(req, res, url, ctx.config.migration.adminToken);
  if (migrationRouteHandled !== false) {
    return;
  }

  return notFoundResponse(res, {
    path: url.pathname,
    method,
  });
}

async function getDatabaseHealth(): Promise<DependencyHealth> {
  const checkedAt = new Date().toISOString();

  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return {
      ok: true,
      checkedAt,
    };
  } catch (error) {
    return {
      ok: false,
      checkedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getAcumaticaHealth(createAcumatica: () => AcumaticaClient): Promise<AcumaticaHealthStatus> {
  return createAcumatica().healthCheck();
}

async function closeHttpServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
