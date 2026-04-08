import {
  DataRecordEntityType,
  DataSourceSystem,
  MigrationRecordStatus,
  MigrationRunMode,
  MigrationRunStatus,
  MigrationWave,
  SnapshotStatus,
  Prisma,
  prisma,
} from '@pulse/db';
import type {
  CaptureSourceSnapshotsRequest,
  CreateMigrationRunRequest,
  SourceSnapshotInput,
  StageMigrationRecordsRequest,
} from './types.js';

export async function createMigrationRun(input: CreateMigrationRunRequest) {
  const sourceSystem = parseEnumValue(DataSourceSystem, input.sourceSystem, 'sourceSystem');
  const mode = parseEnumValue(MigrationRunMode, input.mode, 'mode');
  const wave = input.wave ? parseEnumValue(MigrationWave, input.wave, 'wave') : undefined;
  const notes = optionalTrimmed(input.notes);

  const data: Prisma.MigrationRunUncheckedCreateInput = {
    sourceSystem,
    mode,
  };

  if (wave) {
    data.wave = wave;
  }
  if (notes) {
    data.notes = notes;
  }
  if (input.entityScope) {
    data.entityScope = toJsonValue(input.entityScope, 'entityScope');
  }

  return prisma.migrationRun.create({
    data,
  });
}

export async function captureSourceSnapshots(runId: string, input: CaptureSourceSnapshotsRequest) {
  const run = await requireMigrationRun(runId);
  if (!Array.isArray(input.snapshots)) {
    throw new Error('snapshots must be an array');
  }
  if (input.snapshots.length === 0) {
    throw new Error('At least one snapshot is required');
  }

  const results = await prisma.$transaction(
    input.snapshots.map((snapshot) =>
      upsertSourceSnapshot(run.id, run.sourceSystem, snapshot),
    ),
  );

  await markRunActiveIfNeeded(run.id);

  return {
    migrationRunId: run.id,
    captured: results.length,
    snapshots: results.map((snapshot) => ({
      id: snapshot.id,
      externalId: snapshot.externalId,
      entityType: snapshot.entityType,
      status: snapshot.status,
    })),
  };
}

export async function stageMigrationRecords(runId: string, input: StageMigrationRecordsRequest = {}) {
  await requireMigrationRun(runId);
  if (input.entityTypes !== undefined && !Array.isArray(input.entityTypes)) {
    throw new Error('entityTypes must be an array');
  }
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit <= 0)) {
    throw new Error('limit must be a positive integer');
  }

  const entityTypes = input.entityTypes?.map((value) =>
    parseEnumValue(DataRecordEntityType, value, 'entityTypes'),
  );

  const findManyArgs: Prisma.SourceRecordSnapshotFindManyArgs = {
    where: {
      migrationRunId: runId,
      ...(entityTypes && entityTypes.length > 0 ? { entityType: { in: entityTypes } } : {}),
    },
    orderBy: [
      { capturedAt: 'asc' },
      { createdAt: 'asc' },
    ],
  };

  if (input.limit !== undefined) {
    findManyArgs.take = input.limit;
  }

  const snapshots = await prisma.sourceRecordSnapshot.findMany(findManyArgs);

  if (snapshots.length === 0) {
    return {
      migrationRunId: runId,
      staged: 0,
      existing: 0,
    };
  }

  const existingRecords = await prisma.migrationRunRecord.findMany({
    where: {
      migrationRunId: runId,
      snapshotId: {
        in: snapshots.map((snapshot) => snapshot.id),
      },
    },
    select: {
      snapshotId: true,
    },
  });

  const existingSnapshotIds = new Set(
    existingRecords.flatMap((record) => (record.snapshotId ? [record.snapshotId] : [])),
  );

  const snapshotsToStage = snapshots.filter((snapshot) => !existingSnapshotIds.has(snapshot.id));
  let stagedCount = 0;

  if (snapshotsToStage.length > 0) {
    const [createResult] = await prisma.$transaction([
      prisma.migrationRunRecord.createMany({
        data: snapshotsToStage.map((snapshot) => ({
          migrationRunId: runId,
          snapshotId: snapshot.id,
          sourceSystem: snapshot.sourceSystem,
          entityType: snapshot.entityType,
          externalId: snapshot.externalId,
          targetEntityType: snapshot.targetEntityType,
          targetEntityId: snapshot.targetEntityId,
          status: MigrationRecordStatus.STAGED,
        })),
        skipDuplicates: true,
      }),
      prisma.sourceRecordSnapshot.updateMany({
        where: {
          id: {
            in: snapshotsToStage.map((snapshot) => snapshot.id),
          },
        },
        data: {
          status: SnapshotStatus.STAGED,
        },
      }),
    ]);

    stagedCount = createResult.count;
  }

  await markRunActiveIfNeeded(runId);

  return {
    migrationRunId: runId,
    staged: stagedCount,
    existing: existingSnapshotIds.size + (snapshotsToStage.length - stagedCount),
  };
}

export async function getMigrationRunSummary(runId: string) {
  const run = await prisma.migrationRun.findUnique({
    where: { id: runId },
  });

  if (!run) {
    return null;
  }

  const [snapshotCounts, recordCounts] = await Promise.all([
    prisma.sourceRecordSnapshot.groupBy({
      by: ['status'],
      where: {
        migrationRunId: runId,
      },
      _count: {
        status: true,
      },
    }),
    prisma.migrationRunRecord.groupBy({
      by: ['status'],
      where: {
        migrationRunId: runId,
      },
      _count: {
        status: true,
      },
    }),
  ]);

  return {
    run,
    snapshots: summarizeCounts(snapshotCounts),
    records: summarizeCounts(recordCounts),
  };
}

async function requireMigrationRun(runId: string) {
  const run = await prisma.migrationRun.findUnique({
    where: { id: runId },
  });

  if (!run) {
    throw new Error(`Migration run not found: ${runId}`);
  }

  return run;
}

function upsertSourceSnapshot(runId: string, defaultSourceSystem: DataSourceSystem, snapshot: SourceSnapshotInput) {
  const sourceSystem = snapshot.sourceSystem
    ? parseEnumValue(DataSourceSystem, snapshot.sourceSystem, 'snapshots[].sourceSystem')
    : defaultSourceSystem;
  const entityType = parseEnumValue(DataRecordEntityType, snapshot.entityType, 'snapshots[].entityType');
  const targetEntityType = snapshot.targetEntityType
    ? parseEnumValue(DataRecordEntityType, snapshot.targetEntityType, 'snapshots[].targetEntityType')
    : undefined;
  const normalizedPayload = snapshot.normalizedPayload === undefined
    ? undefined
    : toJsonValue(snapshot.normalizedPayload, 'snapshots[].normalizedPayload');
  const sourceModifiedAt = parseDate(snapshot.sourceModifiedAt, 'snapshots[].sourceModifiedAt');
  const targetEntityId = optionalTrimmed(snapshot.targetEntityId);
  const payloadChecksum = optionalTrimmed(snapshot.payloadChecksum);
  const metadata = snapshot.metadata === undefined
    ? undefined
    : toJsonValue(snapshot.metadata, 'snapshots[].metadata');

  const updateData: Prisma.SourceRecordSnapshotUncheckedUpdateInput = {
    migrationRunId: runId,
    rawPayload: toJsonValue(snapshot.rawPayload, 'snapshots[].rawPayload'),
    updatedAt: new Date(),
  };

  if (targetEntityType !== undefined) {
    updateData.targetEntityType = targetEntityType;
  }
  if (targetEntityId !== undefined) {
    updateData.targetEntityId = targetEntityId;
  }
  if (sourceModifiedAt !== undefined) {
    updateData.sourceModifiedAt = sourceModifiedAt;
  }
  if (payloadChecksum !== undefined) {
    updateData.payloadChecksum = payloadChecksum;
  }
  if (normalizedPayload !== undefined) {
    updateData.normalizedPayload = normalizedPayload;
    updateData.normalizedAt = new Date();
    updateData.status = SnapshotStatus.NORMALIZED;
  }
  if (metadata !== undefined) {
    updateData.metadata = metadata;
  }

  const createData: Prisma.SourceRecordSnapshotUncheckedCreateInput = {
    migrationRunId: runId,
    sourceSystem,
    entityType,
    externalId: snapshot.externalId,
    rawPayload: toJsonValue(snapshot.rawPayload, 'snapshots[].rawPayload'),
    status: normalizedPayload === undefined ? SnapshotStatus.CAPTURED : SnapshotStatus.NORMALIZED,
  };

  if (targetEntityType !== undefined) {
    createData.targetEntityType = targetEntityType;
  }
  if (targetEntityId !== undefined) {
    createData.targetEntityId = targetEntityId;
  }
  if (sourceModifiedAt !== undefined) {
    createData.sourceModifiedAt = sourceModifiedAt;
  }
  if (payloadChecksum !== undefined) {
    createData.payloadChecksum = payloadChecksum;
  }
  if (normalizedPayload !== undefined) {
    createData.normalizedPayload = normalizedPayload;
    createData.normalizedAt = new Date();
  }
  if (metadata !== undefined) {
    createData.metadata = metadata;
  }

  return prisma.sourceRecordSnapshot.upsert({
    where: {
      migrationRunId_sourceSystem_entityType_externalId: {
        migrationRunId: runId,
        sourceSystem,
        entityType,
        externalId: snapshot.externalId,
      },
    },
    update: updateData,
    create: createData,
  });
}

async function markRunActiveIfNeeded(runId: string) {
  const run = await prisma.migrationRun.findUnique({
    where: { id: runId },
    select: {
      status: true,
      startedAt: true,
    },
  });

  if (!run) {
    return;
  }

  const data: Prisma.MigrationRunUpdateInput = {};
  if (run.status === MigrationRunStatus.PENDING) {
    data.status = MigrationRunStatus.RUNNING;
  }
  if (!run.startedAt) {
    data.startedAt = new Date();
  }

  if (Object.keys(data).length > 0) {
    await prisma.migrationRun.update({
      where: { id: runId },
      data,
    });
  }
}

function summarizeCounts(
  rows: Array<{
    status: string;
    _count: { status: number };
  }>,
) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count.status;
    return acc;
  }, {});
}

function parseEnumValue<TEnum extends Record<string, string>>(enumMap: TEnum, value: string, field: string): TEnum[keyof TEnum] {
  const match = Object.values(enumMap).find((candidate) => candidate === value);
  if (!match) {
    throw new Error(`Invalid ${field}: ${value}`);
  }

  return match as TEnum[keyof TEnum];
}

function parseDate(value: string | undefined, field: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${field}: ${value}`);
  }

  return date;
}

function optionalTrimmed(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toJsonValue(value: unknown, field: string): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Invalid ${field}: ${error.message}`
        : `Invalid ${field}`,
    );
  }
}
