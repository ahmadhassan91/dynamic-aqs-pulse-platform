import type { AppLogger } from '../utils/logger.js';
import type { QueueDefinition, QueueHandler, QueueManager } from '../queue/contracts.js';

export function createWorkerRuntime(queue: QueueManager, logger: AppLogger) {
  let running = false;
  const registrations = new Map<string, QueueDefinition>();

  function register<TPayload, TResult>(definition: QueueDefinition, handler: QueueHandler<TPayload, TResult>) {
    registrations.set(definition.name, definition);
    queue.register(definition, handler);
  }

  async function start() {
    await queue.start();
    running = true;
    logger.info('worker.started', {
      registeredWorkers: registrations.size,
    });
  }

  async function stop() {
    await queue.stop();
    running = false;
    logger.info('worker.stopped', {});
  }

  async function status() {
    return {
      running,
      registeredWorkers: registrations.size,
      queue: await queue.status(),
    };
  }

  return {
    register,
    start,
    stop,
    status,
  };
}
