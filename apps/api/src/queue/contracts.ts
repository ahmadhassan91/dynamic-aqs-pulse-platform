import type { Queue, QueueOptions, SendOptions, WorkOptions } from 'pg-boss';

export const QUEUE_TIERS = ['CRITICAL', 'HIGH', 'STANDARD', 'BATCH'] as const;

export type QueueTier = (typeof QUEUE_TIERS)[number];

export type JobTriggerSource = 'api' | 'scheduler' | 'system' | 'worker' | 'webhook';

export type QueueJobMetadata = {
  priority?: number | undefined;
  retryLimit?: number | undefined;
  expireInSeconds?: number | undefined;
  singletonKey?: string | undefined;
  idempotencyKey?: string | undefined;
};

export type QueueJobEnvelope<TData = unknown> = {
  jobType: string;
  triggeredBy: string;
  triggerSource: JobTriggerSource;
  correlationId: string;
  data: TData;
  metadata?: QueueJobMetadata | undefined;
};

export type QueueJob<TData = unknown> = {
  id: string;
  type: string;
  payload: QueueJobEnvelope<TData>;
  createdAt: string;
  attempts: number;
  signal: AbortSignal;
};

export type QueueHandler<TData = unknown, TResult = unknown> = (job: QueueJob<TData>) => Promise<TResult>;

export type QueueDefinition = {
  name: string;
  tier: QueueTier;
  description: string;
  queueOptions?: Partial<Omit<Queue, 'name'>> | undefined;
  workOptions?: Partial<WorkOptions> | undefined;
};

export type QueueReceipt = {
  id: string | null;
  type: string;
  tier: QueueTier;
  correlationId: string;
  enqueuedAt: string;
};

export type QueueSnapshot = {
  name: string;
  tier: QueueTier;
  queuedCount: number;
  activeCount: number;
  deferredCount: number;
  totalCount: number;
  deadLetter?: string | undefined;
};

export type QueueManagerStatus = {
  ok: boolean;
  state: 'starting' | 'running' | 'stopping' | 'stopped';
  runtime: 'pg-boss';
  schema: string;
  deadLetterQueue: string;
  registeredQueues: number;
  registeredWorkers: number;
  queueStats: QueueSnapshot[];
};

export type QueueManager = {
  register: <TData, TResult>(definition: QueueDefinition, handler: QueueHandler<TData, TResult>) => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  enqueue: <TData>(definition: QueueDefinition | string, payload: QueueJobEnvelope<TData>, options?: SendOptions) => Promise<QueueReceipt>;
  status: () => Promise<QueueManagerStatus>;
};
