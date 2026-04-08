import type { AppLogger } from '../utils/logger.js';

export type QueueJob<TPayload = unknown> = {
  id: string;
  type: string;
  payload: TPayload;
  createdAt: string;
  correlationId: string;
  attempts: number;
};

export type QueueHandler<TPayload = unknown, TResult = unknown> = (job: QueueJob<TPayload>) => Promise<TResult>;

type QueueState = 'running' | 'stopped';

export function createInMemoryQueueManager(logger: AppLogger) {
  const handlers = new Map<string, QueueHandler>();
  const jobs: QueueJob[] = [];
  let state: QueueState = 'stopped';

  function register<TPayload, TResult>(type: string, handler: QueueHandler<TPayload, TResult>) {
    handlers.set(type, handler as QueueHandler);
  }

  async function enqueue<TPayload>(type: string, payload: TPayload) {
    const job: QueueJob<TPayload> = {
      id: crypto.randomUUID(),
      type,
      payload,
      createdAt: new Date().toISOString(),
      correlationId: crypto.randomUUID(),
      attempts: 0,
    };

    jobs.push(job);
    logger.info('queue.enqueue', { type, jobId: job.id });
    return job;
  }

  function start() {
    state = 'running';
    logger.info('queue.started', { count: handlers.size });
  }

  function stop() {
    state = 'stopped';
    logger.info('queue.stopped', {});
  }

  function status() {
    return {
      state,
      registeredHandlers: handlers.size,
      queuedJobs: jobs.length,
    };
  }

  return {
    register,
    enqueue,
    start,
    stop,
    status,
    handlers,
    jobs,
  };
}

