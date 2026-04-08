import { PgBoss, type JobWithMetadata, type Queue, type QueueOptions, type SendOptions, type WorkOptions } from 'pg-boss';
import { QUEUE_TIER_DEFAULTS } from './definitions.js';
import type { QueueDefinition, QueueHandler, QueueJob, QueueJobEnvelope, QueueManager, QueueManagerStatus, QueueReceipt, QueueTier } from './contracts.js';
import type { AppLogger } from '../utils/logger.js';

type QueueRegistration = {
  definition: QueueDefinition;
  handler: QueueHandler;
  workerId?: string | undefined;
};

type QueueState = QueueManagerStatus['state'];

type QueueRuntimeConfig = {
  app: {
    name: string;
  };
  environment: {
    name: string;
  };
  queue: {
    connectionString: string;
    schema: string;
    archiveSeconds: number;
    deleteAfterSeconds: number;
    monitorIntervalSeconds: number;
    pollingIntervalSeconds: number;
    deadLetterQueue: string;
  };
};

export function createPgBossQueueManager(
  config: QueueRuntimeConfig,
  logger: AppLogger,
): QueueManager {
  const registrations = new Map<string, QueueRegistration>();
  let boss: PgBoss | undefined;
  let state: QueueState = 'stopped';

  function register<TData, TResult>(definition: QueueDefinition, handler: QueueHandler<TData, TResult>) {
    if (registrations.has(definition.name)) {
      throw new Error(`Queue already registered: ${definition.name}`);
    }

    registrations.set(definition.name, {
      definition,
      handler: handler as QueueHandler,
    });
  }

  async function start() {
    if (state === 'starting' || state === 'running') {
      return;
    }

    state = 'starting';
    const instance = new PgBoss({
      connectionString: config.queue.connectionString,
      schema: config.queue.schema,
      application_name: `${config.app.name}-${config.environment.name}-queue`,
      monitorIntervalSeconds: config.queue.monitorIntervalSeconds,
      createSchema: true,
      migrate: true,
      supervise: true,
    });

    instance.on('error', (error) => {
      logger.error('queue.error', {
        error: error.message,
      });
    });

    instance.on('warning', (warning) => {
      logger.warn('queue.warning', asLogMeta(warning));
    });

    await instance.start();
    await ensureQueue(instance, config.queue.deadLetterQueue, {
      retryLimit: 0,
      deleteAfterSeconds: config.queue.archiveSeconds,
      retentionSeconds: config.queue.deleteAfterSeconds,
    });

    for (const registration of registrations.values()) {
      const queueOptions = resolveQueueOptions(registration.definition, config.queue.deadLetterQueue, config.queue.archiveSeconds, config.queue.deleteAfterSeconds);
      const workOptions = resolveWorkOptions(registration.definition, config.queue.pollingIntervalSeconds);

      await ensureQueue(instance, registration.definition.name, queueOptions);
      registration.workerId = await instance.work<QueueJobEnvelope<unknown>, unknown>(registration.definition.name, workOptions, async (jobs) => {
        for (const job of jobs) {
          const mapped = mapPgBossJob(registration.definition.name, job);
          try {
            await registration.handler(mapped);
            logger.info('worker.job_complete', {
              type: registration.definition.name,
              tier: registration.definition.tier,
              jobId: mapped.id,
              attempts: mapped.attempts,
            });
          } catch (error) {
            logger.error('worker.job_failed', {
              type: registration.definition.name,
              tier: registration.definition.tier,
              jobId: mapped.id,
              attempts: mapped.attempts,
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        }
      });
    }

    boss = instance;
    state = 'running';
    logger.info('queue.started', {
      runtime: 'pg-boss',
      schema: config.queue.schema,
      registeredQueues: registrations.size,
    });
  }

  async function stop() {
    if (!boss || state === 'stopped') {
      state = 'stopped';
      return;
    }

    state = 'stopping';
    const current = boss;
    boss = undefined;

    await current.stop({
      graceful: true,
      timeout: 30_000,
    });

    for (const registration of registrations.values()) {
      registration.workerId = undefined;
    }

    state = 'stopped';
    logger.info('queue.stopped', {
      runtime: 'pg-boss',
    });
  }

  async function enqueue<TData>(definitionOrName: QueueDefinition | string, payload: QueueJobEnvelope<TData>, options: SendOptions = {}) {
    if (!boss || state !== 'running') {
      throw new Error('Queue manager is not running');
    }

    const definition = resolveDefinition(definitionOrName);
    const sendOptions = resolveSendOptions(definition, payload, options, config.queue.deadLetterQueue);
    const jobId = await boss.send(definition.name, payload as object, sendOptions);
    const receipt: QueueReceipt = {
      id: jobId,
      type: definition.name,
      tier: definition.tier,
      correlationId: payload.correlationId,
      enqueuedAt: new Date().toISOString(),
    };

    logger.info('queue.enqueue', {
      type: definition.name,
      tier: definition.tier,
      jobId,
      correlationId: payload.correlationId,
    });

    return receipt;
  }

  async function status(): Promise<QueueManagerStatus> {
    const queueStats: QueueManagerStatus['queueStats'] = [];

    if (boss && state === 'running') {
      for (const registration of registrations.values()) {
        try {
          const stats = await boss.getQueueStats(registration.definition.name);
          queueStats.push({
            name: registration.definition.name,
            tier: registration.definition.tier,
            queuedCount: stats.queuedCount,
            activeCount: stats.activeCount,
            deferredCount: stats.deferredCount,
            totalCount: stats.totalCount,
            deadLetter: stats.deadLetter,
          });
        } catch (error) {
          logger.warn('queue.stats_failed', {
            type: registration.definition.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return {
      ok: state === 'running',
      state,
      runtime: 'pg-boss',
      schema: config.queue.schema,
      deadLetterQueue: config.queue.deadLetterQueue,
      registeredQueues: registrations.size,
      registeredWorkers: Array.from(registrations.values()).filter((registration) => registration.workerId).length,
      queueStats,
    };
  }

  function resolveDefinition(definitionOrName: QueueDefinition | string) {
    if (typeof definitionOrName !== 'string') {
      return definitionOrName;
    }

    const registration = registrations.get(definitionOrName);
    if (!registration) {
      throw new Error(`Queue is not registered: ${definitionOrName}`);
    }

    return registration.definition;
  }

  return {
    register,
    start,
    stop,
    enqueue,
    status,
  };
}

async function ensureQueue(boss: PgBoss, name: string, options: Partial<Omit<Queue, 'name'>>) {
  const existing = await boss.getQueue(name);
  if (existing) {
    await boss.updateQueue(name, options);
    return;
  }

  await boss.createQueue(name, options);
}

function resolveQueueOptions(
  definition: QueueDefinition,
  deadLetterQueue: string,
  archiveSeconds: number,
  deleteAfterSeconds: number,
): Partial<Omit<Queue, 'name'>> {
  const defaults = QUEUE_TIER_DEFAULTS[definition.tier].queueOptions;
  const requestedRetryLimit = definition.queueOptions?.retryLimit;
  const retryLimit =
    requestedRetryLimit === undefined
      ? defaults.retryLimit
      : Math.min(requestedRetryLimit, defaults.retryLimit ?? requestedRetryLimit);

  const resolved: Partial<Omit<Queue, 'name'>> = {
    ...defaults,
    deleteAfterSeconds: archiveSeconds,
    retentionSeconds: deleteAfterSeconds,
    deadLetter: deadLetterQueue,
    ...definition.queueOptions,
  };

  if (retryLimit !== undefined) {
    resolved.retryLimit = retryLimit;
  }

  return resolved;
}

function resolveWorkOptions(
  definition: QueueDefinition,
  pollingIntervalSeconds: number,
): WorkOptions & { includeMetadata: true } {
  return {
    ...QUEUE_TIER_DEFAULTS[definition.tier].workOptions,
    pollingIntervalSeconds,
    ...definition.workOptions,
    includeMetadata: true,
  };
}

function resolveSendOptions<TData>(
  definition: QueueDefinition,
  payload: QueueJobEnvelope<TData>,
  options: SendOptions,
  deadLetterQueue: string,
): SendOptions {
  const tierDefaults = QUEUE_TIER_DEFAULTS[definition.tier].queueOptions;
  const retryLimit =
    payload.metadata?.retryLimit === undefined
      ? options.retryLimit
      : Math.min(payload.metadata.retryLimit, tierDefaults.retryLimit ?? payload.metadata.retryLimit);

  const resolved: SendOptions = {
    ...options,
    deadLetter: options.deadLetter ?? deadLetterQueue,
  };

  const singletonKey = payload.metadata?.singletonKey ?? payload.metadata?.idempotencyKey ?? options.singletonKey;
  if (singletonKey !== undefined) {
    resolved.singletonKey = singletonKey;
  }

  const priority = payload.metadata?.priority ?? options.priority;
  if (priority !== undefined) {
    resolved.priority = priority;
  }

  const expireInSeconds = payload.metadata?.expireInSeconds ?? options.expireInSeconds;
  if (expireInSeconds !== undefined) {
    resolved.expireInSeconds = expireInSeconds;
  }

  if (retryLimit !== undefined) {
    resolved.retryLimit = retryLimit;
  }

  return resolved;
}

function mapPgBossJob<TData>(name: string, job: JobWithMetadata<QueueJobEnvelope<TData>>): QueueJob<TData> {
  return {
    id: job.id,
    type: name,
    payload: job.data,
    createdAt: job.createdOn.toISOString(),
    attempts: job.retryCount + 1,
    signal: job.signal,
  };
}

function asLogMeta(warning: { message: string; data: object }): Record<string, unknown> {
  return {
    message: warning.message,
    data: warning.data,
  };
}
