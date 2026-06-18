import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { prisma } from '@pulse/db';
import { createAcumaticaClient, type AcumaticaClient, type AcumaticaHealthStatus } from '@pulse/acumatica';
import type { AppConfig } from './config.js';
import { handleAdminRoutes } from './modules/admin/http.js';
import { handleAccountRoutes } from './modules/accounts/http.js';
import { handleAuthRoutes } from './modules/auth/http.js';
import { handleCalendarRoutes } from './modules/calendar/http.js';
import { handleCisRoutes } from './modules/cis/http.js';
import { handleConsignmentRoutes } from './modules/consignment/http.js';
import { handleDealerPortalRoutes } from './modules/dealer-portal/http.js';
import { handleDigitalAssetRoutes } from './modules/digital-assets/http.js';
import { handleLeadRoutes } from './modules/leads/http.js';
import { handleOrderRoutes } from './modules/orders/http.js';
import { processConsignmentOperationalAlertScanJob } from './modules/consignment/alerts.js';
import {
  ensureLeadOperationalAlertRecipientsSeeded,
  ensureLeadRoutingPolicySeeded,
  ensureWebsiteLeadConfigSeeded,
  processLeadOperationalAlertDeliveryJob,
  processLeadOperationalAlertScanJob,
} from './modules/leads/service.js';
import { handleMigrationRoutes } from './modules/migrations/http.js';
import { handleMobileVoiceNoteRoutes } from './modules/mobile-voice-notes/http.js';
import { handleProductManagementRoutes } from './modules/product-management/http.js';
import { handleReferenceRoutes } from './modules/reference/http.js';
import { ensureReferenceDataSeeded } from './modules/reference/service.js';
import { handleReportRoutes } from './modules/reports/http.js';
import { processDueReportSchedules } from './modules/reports/service.js';
import { handleTerritoryRoutes } from './modules/territories/http.js';
import { ensureTerritoryPolicySeeded } from './modules/territories/service.js';
import { handleTrainingRoutes } from './modules/training/http.js';
import { ensureTrainingSeeded } from './modules/training/service.js';
import {
  CONSIGNMENT_OPERATIONAL_ALERT_SCAN_QUEUE,
  LEAD_OPERATIONAL_ALERT_DELIVERY_QUEUE,
  LEAD_OPERATIONAL_ALERT_SCAN_QUEUE,
  REPORT_SCHEDULE_SCAN_QUEUE,
  SYSTEM_HEALTH_CHECK_QUEUE,
} from './queue/definitions.js';
import { createPgBossQueueManager } from './queue/queue-manager.js';
import type { QueueJobEnvelope, QueueManager } from './queue/contracts.js';
import { createWorkerRuntime } from './worker/worker-runtime.js';
import { jsonResponse, notFoundResponse } from './utils/http.js';
import { createAppLogger, type AppLogger } from './utils/logger.js';
import { createFixedWindowRateLimiter, type FixedWindowRateLimiter } from './utils/rate-limit.js';

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
  websiteLeadCaptureLimiter: FixedWindowRateLimiter;
  websiteLeadCapturePreflightLimiter: FixedWindowRateLimiter;
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
  const websiteLeadCaptureLimiter = createFixedWindowRateLimiter({
    windowSeconds: config.leads.websiteLeadCaptureRateLimitWindowSeconds,
    max: config.leads.websiteLeadCaptureRateLimitMax,
  });
  const websiteLeadCapturePreflightLimiter = createFixedWindowRateLimiter({
    windowSeconds: config.leads.websiteLeadCaptureRateLimitWindowSeconds,
    max: config.leads.websiteLeadCapturePreflightRateLimitMax,
  });
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
  workers.register(LEAD_OPERATIONAL_ALERT_DELIVERY_QUEUE, async (job) => (
    processLeadOperationalAlertDeliveryJob(config, logger, job)
  ));
  workers.register(LEAD_OPERATIONAL_ALERT_SCAN_QUEUE, async (job) => (
    processLeadOperationalAlertScanJob(job, { queue, logger })
  ));
  workers.register(CONSIGNMENT_OPERATIONAL_ALERT_SCAN_QUEUE, async (job) => (
    processConsignmentOperationalAlertScanJob(job, { logger })
  ));
  workers.register(REPORT_SCHEDULE_SCAN_QUEUE, async () => processDueReportSchedules());

  await prisma.$connect();
  await ensureReferenceDataSeeded();
  await ensureLeadRoutingPolicySeeded();
  await ensureLeadOperationalAlertRecipientsSeeded();
  await ensureWebsiteLeadConfigSeeded();
  await ensureTerritoryPolicySeeded();
  await ensureTrainingSeeded();

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
      websiteLeadCaptureLimiter,
      websiteLeadCapturePreflightLimiter,
    });
  });

  let closed = false;
  const leadOperationalAlertTimer = config.leads.operationalAlertScanIntervalMinutes > 0
    ? setInterval(() => {
        void queue.enqueue(LEAD_OPERATIONAL_ALERT_SCAN_QUEUE, {
          jobType: LEAD_OPERATIONAL_ALERT_SCAN_QUEUE.name,
          triggeredBy: 'system',
          triggerSource: 'scheduler',
          correlationId: `lead-operational-alert-scan-${Date.now()}`,
          metadata: {
            singletonKey: 'lead-operational-alert-scan',
            expireInSeconds: 60 * 10,
          },
          data: {
            limit: 250,
          },
        }).catch((error) => {
          logger.warn('queue.enqueue_failed', {
            type: LEAD_OPERATIONAL_ALERT_SCAN_QUEUE.name,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }, config.leads.operationalAlertScanIntervalMinutes * 60 * 1000)
    : undefined;
  leadOperationalAlertTimer?.unref();

  // Consignment time-pressure engine — PRD section 4A.5.
  // Reuse the lead operational-alert scan cadence so a single ops/admin policy
  // governs both scanners; consignment-specific cadence can split out later.
  const consignmentOperationalAlertTimer = config.leads.operationalAlertScanIntervalMinutes > 0
    ? setInterval(() => {
        void queue.enqueue(CONSIGNMENT_OPERATIONAL_ALERT_SCAN_QUEUE, {
          jobType: CONSIGNMENT_OPERATIONAL_ALERT_SCAN_QUEUE.name,
          triggeredBy: 'system',
          triggerSource: 'scheduler',
          correlationId: `consignment-operational-alert-scan-${Date.now()}`,
          metadata: {
            singletonKey: 'consignment-operational-alert-scan',
            expireInSeconds: 60 * 10,
          },
          data: {},
        }).catch((error) => {
          logger.warn('queue.enqueue_failed', {
            type: CONSIGNMENT_OPERATIONAL_ALERT_SCAN_QUEUE.name,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }, config.leads.operationalAlertScanIntervalMinutes * 60 * 1000)
    : undefined;
  consignmentOperationalAlertTimer?.unref();

  // Report schedule scanner — shares the operational-alert cadence so one ops
  // policy governs all background scans; reporting-specific cadence can split
  // out later if delivery SLAs require it.
  const reportScheduleTimer = config.leads.operationalAlertScanIntervalMinutes > 0
    ? setInterval(() => {
        void queue.enqueue(REPORT_SCHEDULE_SCAN_QUEUE, {
          jobType: REPORT_SCHEDULE_SCAN_QUEUE.name,
          triggeredBy: 'system',
          triggerSource: 'scheduler',
          correlationId: `reports-schedule-scan-${Date.now()}`,
          metadata: {
            singletonKey: 'reports-schedule-scan',
            expireInSeconds: 60 * 10,
          },
          data: {},
        }).catch((error) => {
          logger.warn('queue.enqueue_failed', {
            type: REPORT_SCHEDULE_SCAN_QUEUE.name,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }, config.leads.operationalAlertScanIntervalMinutes * 60 * 1000)
    : undefined;
  reportScheduleTimer?.unref();

  return {
    logger,
    server,
    close: async () => {
      if (closed) {
        return;
      }

      closed = true;
      if (leadOperationalAlertTimer) {
        clearInterval(leadOperationalAlertTimer);
      }
      if (consignmentOperationalAlertTimer) {
        clearInterval(consignmentOperationalAlertTimer);
      }
      await Promise.allSettled([workers.stop(), closeHttpServer(server)]);
      await prisma.$disconnect();
      logger.info('app.shutdown.complete', {});
    },
  };
}

async function routeRequest(req: IncomingMessage, res: ServerResponse, ctx: RequestContext) {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (method === 'OPTIONS' && isPublicLeadOptionsPath(url.pathname)) {
    const publicLeadOptionsHandled = await handleLeadRoutes(req, res, url, {
      config: ctx.config,
      websiteLeadCaptureLimiter: ctx.websiteLeadCaptureLimiter,
      websiteLeadCapturePreflightLimiter: ctx.websiteLeadCapturePreflightLimiter,
    });
    if (publicLeadOptionsHandled !== false) {
      return;
    }
  }

  if (applyCorsHeaders(req, res, ctx.config)) {
    return;
  }

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

  const authRouteHandled = await handleAuthRoutes(req, res, url, ctx.config);
  if (authRouteHandled !== false) {
    return;
  }

  const adminRouteHandled = await handleAdminRoutes(req, res, url, {
    config: ctx.config,
    queue: ctx.queue,
    getDatabaseHealth,
    getQueueStatus: () => ctx.queue.status(),
    getWorkersStatus: () => ctx.workers.status(),
    getAcumaticaHealth: () => getAcumaticaHealth(ctx.createAcumatica),
  });
  if (adminRouteHandled !== false) {
    return;
  }

  const accountRouteHandled = await handleAccountRoutes(req, res, url);
  if (accountRouteHandled !== false) {
    return;
  }

  const orderRouteHandled = await handleOrderRoutes(req, res, url);
  if (orderRouteHandled !== false) {
    return;
  }

  const cisRouteHandled = await handleCisRoutes(req, res, url, {
    config: ctx.config,
    queue: ctx.queue,
  });
  if (cisRouteHandled !== false) {
    return;
  }

  const consignmentRouteHandled = await handleConsignmentRoutes(req, res, url, ctx.config);
  if (consignmentRouteHandled !== false) {
    return;
  }

  const productManagementRouteHandled = await handleProductManagementRoutes(req, res, url);
  if (productManagementRouteHandled !== false) {
    return;
  }

  const digitalAssetRouteHandled = await handleDigitalAssetRoutes(req, res, url);
  if (digitalAssetRouteHandled !== false) {
    return;
  }

  const calendarRouteHandled = await handleCalendarRoutes(req, res, url, ctx.config);
  if (calendarRouteHandled !== false) {
    return;
  }

  const dealerPortalRouteHandled = await handleDealerPortalRoutes(req, res, url);
  if (dealerPortalRouteHandled !== false) {
    return;
  }

  const leadRouteHandled = await handleLeadRoutes(req, res, url, {
    config: ctx.config,
    websiteLeadCaptureLimiter: ctx.websiteLeadCaptureLimiter,
    websiteLeadCapturePreflightLimiter: ctx.websiteLeadCapturePreflightLimiter,
  });
  if (leadRouteHandled !== false) {
    return;
  }

  const referenceRouteHandled = await handleReferenceRoutes(req, res, url);
  if (referenceRouteHandled !== false) {
    return;
  }

  const migrationRouteHandled = await handleMigrationRoutes(req, res, url, ctx.config.migration.adminToken);
  if (migrationRouteHandled !== false) {
    return;
  }

  const mobileVoiceNoteRouteHandled = await handleMobileVoiceNoteRoutes(req, res, url, ctx.config);
  if (mobileVoiceNoteRouteHandled !== false) {
    return;
  }

  const reportRouteHandled = await handleReportRoutes(req, res, url);
  if (reportRouteHandled !== false) {
    return;
  }

  const territoryRouteHandled = await handleTerritoryRoutes(req, res, url);
  if (territoryRouteHandled !== false) {
    return;
  }

  const trainingRouteHandled = await handleTrainingRoutes(req, res, url, ctx.config);
  if (trainingRouteHandled !== false) {
    return;
  }

  return notFoundResponse(res, {
    path: url.pathname,
    method,
  });
}

function isPublicLeadOptionsPath(pathname: string) {
  return pathname === '/api/leads/capture'
    || pathname === '/api/v1/leads/capture'
    || pathname === '/api/v1/public/leads/capture'
    || /^\/api\/v1\/public\/website-sites\/[^/]+$/.test(pathname);
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

function applyCorsHeaders(req: IncomingMessage, res: ServerResponse, config: AppConfig) {
  const origin = req.headers.origin;
  if (!origin) {
    return false;
  }

  const allowedOrigins = getAllowedOrigins(config);
  if (allowedOrigins.has(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
    res.setHeader('access-control-allow-headers', 'authorization, content-type');
    res.setHeader('access-control-allow-methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('access-control-max-age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = allowedOrigins.has(origin) ? 204 : 403;
    res.end();
    return true;
  }

  return false;
}

function getAllowedOrigins(config: AppConfig) {
  const allowedOrigins = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3010',
    'http://127.0.0.1:3010',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
  ]);

  try {
    allowedOrigins.add(new URL(config.web.publicBaseUrl).origin);
  } catch {
    // Ignore invalid public base URL.
  }

  return allowedOrigins;
}
