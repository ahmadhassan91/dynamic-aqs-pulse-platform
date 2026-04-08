import {
  DataRecordEntityType,
  DataSourceSystem,
  MigrationRunMode,
  MigrationWave,
} from '@pulse/db';

export type CreateMigrationRunRequest = {
  sourceSystem: `${DataSourceSystem}`;
  wave?: `${MigrationWave}` | undefined;
  mode: `${MigrationRunMode}`;
  notes?: string | undefined;
  entityScope?: Record<string, unknown> | undefined;
};

export type SourceSnapshotInput = {
  sourceSystem?: `${DataSourceSystem}` | undefined;
  entityType: `${DataRecordEntityType}`;
  externalId: string;
  targetEntityType?: `${DataRecordEntityType}` | undefined;
  targetEntityId?: string | undefined;
  sourceModifiedAt?: string | undefined;
  payloadChecksum?: string | undefined;
  rawPayload: unknown;
  metadata?: unknown;
};

export type CaptureSourceSnapshotsRequest = {
  snapshots: SourceSnapshotInput[];
};

export type StageMigrationRecordsRequest = {
  entityTypes?: `${DataRecordEntityType}`[] | undefined;
  limit?: number | undefined;
};

export type NormalizeMigrationSnapshotsRequest = {
  entityTypes?: `${DataRecordEntityType}`[] | undefined;
  limit?: number | undefined;
  reprocessNormalized?: boolean | undefined;
};
