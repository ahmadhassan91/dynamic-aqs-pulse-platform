import type { QueueOptions, WorkOptions } from 'pg-boss';
import type { QueueDefinition, QueueTier } from './contracts.js';

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const THIRTY_MINUTES_IN_SECONDS = 60 * 30;
const TWO_HOURS_IN_SECONDS = 60 * 60 * 2;

export const QUEUE_TIER_DEFAULTS: Record<
  QueueTier,
  {
    queueOptions: QueueOptions;
    workOptions: WorkOptions;
  }
> = {
  CRITICAL: {
    queueOptions: {
      expireInSeconds: 60 * 5,
      retryLimit: 10,
      retryDelay: 30,
      retryBackoff: true,
      retryDelayMax: TWO_HOURS_IN_SECONDS,
    },
    workOptions: {
      pollingIntervalSeconds: 1,
      includeMetadata: true,
      batchSize: 1,
      localConcurrency: 1,
    },
  },
  HIGH: {
    queueOptions: {
      expireInSeconds: 60 * 15,
      retryLimit: 5,
      retryDelay: 30,
      retryBackoff: true,
      retryDelayMax: TWO_HOURS_IN_SECONDS,
    },
    workOptions: {
      pollingIntervalSeconds: 2,
      includeMetadata: true,
      batchSize: 1,
      localConcurrency: 1,
    },
  },
  STANDARD: {
    queueOptions: {
      expireInSeconds: ONE_DAY_IN_SECONDS,
      retryLimit: 3,
      retryDelay: 30,
      retryBackoff: true,
      retryDelayMax: THIRTY_MINUTES_IN_SECONDS,
    },
    workOptions: {
      pollingIntervalSeconds: 2,
      includeMetadata: true,
      batchSize: 1,
      localConcurrency: 1,
    },
  },
  BATCH: {
    queueOptions: {
      expireInSeconds: ONE_DAY_IN_SECONDS,
      retryLimit: 1,
      retryDelay: 0,
      retryBackoff: false,
    },
    workOptions: {
      pollingIntervalSeconds: 5,
      includeMetadata: true,
      batchSize: 1,
      localConcurrency: 1,
    },
  },
};

export const SYSTEM_HEALTH_CHECK_QUEUE: QueueDefinition = {
  name: 'system.health-check',
  tier: 'STANDARD',
  description: 'Low-risk worker pipeline verification job',
  queueOptions: {
    expireInSeconds: 60,
    retryLimit: 1,
  },
};
