import { createPulseServer } from './server.js';
import { loadAppConfig } from './config.js';

async function main() {
  const config = loadAppConfig();
  const server = createPulseServer(config);

  server.listen(config.server.port, () => {
    console.log(`[pulse-api] listening on ${config.server.port}`);
  });
}

main().catch((error) => {
  console.error('[pulse-api] startup failed', error);
  process.exitCode = 1;
});

