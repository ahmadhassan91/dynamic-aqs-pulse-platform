import type { AppLogger } from '../utils/logger.js';
import type { QueueJob, QueueHandler } from '../queue/queue-manager.js';

export function createWorkerRuntime(queue: {
  handlers: Map<string, QueueHandler>;
  jobs: QueueJob[];
}, logger: AppLogger) {
  let running = false;
  const workerHandlers = new Map<string, QueueHandler>();

  function register<TPayload, TResult>(type: string, handler: QueueHandler<TPayload, TResult>) {
    workerHandlers.set(type, handler as QueueHandler);
  }

  async function drainOnce() {
    const batch = queue.jobs.splice(0, queue.jobs.length);
    for (const job of batch) {
      const handler = workerHandlers.get(job.type) ?? queue.handlers.get(job.type);
      if (!handler) {
        logger.warn('worker.unhandled_job', { type: job.type, jobId: job.id });
        continue;
      }

      try {
        await handler(job);
        logger.info('worker.job_complete', { type: job.type, jobId: job.id });
      } catch (error) {
        logger.error('worker.job_failed', {
          type: job.type,
          jobId: job.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  function start() {
    running = true;
    logger.info('worker.started', {});
  }

  function stop() {
    running = false;
    logger.info('worker.stopped', {});
  }

  function status() {
    return {
      running,
      pendingJobs: queue.jobs.length,
      registeredWorkers: queue.handlers.size,
    };
  }

  return {
    register,
    start,
    stop,
    drainOnce,
    status,
  };
}
