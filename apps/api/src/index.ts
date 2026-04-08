import { createPulseServer } from './server.js';
import { loadAppConfig } from './config.js';

async function main() {
  const config = loadAppConfig();
  const runtime = await createPulseServer(config);
  const shutdown = createShutdownHandler(runtime);

  runtime.server.listen(config.server.port, () => {
    console.log(`[pulse-api] listening on ${config.server.port}`);
  });

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[pulse-api] startup failed', error);
  process.exitCode = 1;
});

function createShutdownHandler(runtime: Awaited<ReturnType<typeof createPulseServer>>) {
  let shuttingDown = false;

  return async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    runtime.logger.info('app.shutdown.signal', {
      signal,
    });

    try {
      await runtime.close();
      process.exitCode = 0;
    } catch (error) {
      runtime.logger.error('app.shutdown.failed', {
        signal,
        error: error instanceof Error ? error.message : String(error),
      });
      process.exitCode = 1;
    }
  };
}
