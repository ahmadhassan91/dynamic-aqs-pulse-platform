#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Local migration repair: DATABASE_URL is required.');
  process.exit(1);
}

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function queryOutput(sql) {
  return execFileSync(
    'psql',
    ['--dbname', DATABASE_URL, '--no-psqlrc', '-Atqc', sql],
    {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  ).trim();
}

function queryBoolean(sql) {
  return queryOutput(sql) === 't';
}

function tableExists(tableName) {
  return queryBoolean(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${quoteLiteral(tableName)}
    );
  `);
}

function columnExists(tableName, columnName) {
  return queryBoolean(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${quoteLiteral(tableName)}
        AND column_name = ${quoteLiteral(columnName)}
    );
  `);
}

function indexExists(indexName) {
  return queryBoolean(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ${quoteLiteral(indexName)}
    );
  `);
}

function constraintExists(tableName, constraintName) {
  return queryBoolean(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint c
      INNER JOIN pg_class t ON t.oid = c.conrelid
      INNER JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = ${quoteLiteral(tableName)}
        AND c.conname = ${quoteLiteral(constraintName)}
    );
  `);
}

const MIGRATION_REPAIR_CHECKS = [
  {
    name: '20260417094500_cis_ocr_and_account_vault_foundation',
    isPresent() {
      return (
        tableExists('AccountPaymentVaultReference')
      ) && (
        indexExists('AccountPaymentVaultReference_accountId_createdAt_idx')
      ) && (
        constraintExists('AccountPaymentVaultReference', 'AccountPaymentVaultReference_accountId_fkey')
      );
    },
  },
  {
    name: '20260417112000_moneris_cis_capture_attempts',
    isPresent() {
      return (
        tableExists('CisPaymentCaptureAttempt')
      ) && (
        indexExists('CisPaymentCaptureAttempt_cisPackageId_createdAt_idx')
      ) && (
        constraintExists('CisPaymentCaptureAttempt', 'CisPaymentCaptureAttempt_cisPackageId_fkey')
      );
    },
  },
  {
    name: '20260417124500_moneris_cis_vault_finalize',
    isPresent() {
      return (
        columnExists('CisPaymentVaultReference', 'sourceCaptureAttemptId')
      ) && (
        indexExists('CisPaymentVaultReference_sourceCaptureAttemptId_idx')
      ) && (
        constraintExists('CisPaymentVaultReference', 'CisPaymentVaultReference_sourceCaptureAttemptId_fkey')
      );
    },
  },
  {
    name: '20260418103000_account_group_classification_kernel',
    isPresent() {
      return (
        tableExists('AffinityGroupRef')
      ) && (
        tableExists('OwnershipGroupRef')
      ) && (
        columnExists('Lead', 'affinityGroupId')
      ) && (
        columnExists('Account', 'groupClassification')
      );
    },
  },
  {
    name: '20260418143000_group_roster_import_reconciliation',
    isPresent() {
      return (
        tableExists('GroupRosterImportRun')
      ) && (
        tableExists('GroupRosterImportRunRow')
      ) && (
        indexExists('GroupRosterImportRunRow_runId_rowNumber_key')
      );
    },
  },
  {
    name: '20260418161500_lead_operational_alerts_and_potential_value',
    isPresent() {
      return (
        tableExists('LeadOperationalAlert')
      ) && (
        tableExists('LeadOperationalAlertRecipient')
      ) && (
        columnExists('Lead', 'potentialValueCents')
      ) && (
        indexExists('LeadOperationalAlert_dedupeKey_key')
      );
    },
  },
  {
    name: '20260418174000_lead_operational_alert_delivery_foundation',
    isPresent() {
      return (
        tableExists('LeadOperationalAlertDeliveryAttempt')
      ) && (
        columnExists('LeadOperationalAlert', 'deliveryStatus')
      ) && (
        indexExists('LeadOperationalAlertDeliveryAttempt_alertId_attemptNumber_key')
      );
    },
  },
  {
    name: '20260418190000_training_proof_reporting_depth',
    isPresent() {
      return (
        tableExists('TrainingProofDocument')
      ) && (
        columnExists('TrainingProofDocument', 'storageKey')
      ) && (
        constraintExists('TrainingProofDocument', 'TrainingProofDocument_sessionId_fkey')
      );
    },
  },
];

function resolveMigrationAsApplied(migrationName) {
  execFileSync(
    'pnpm',
    [
      '--filter',
      '@pulse/db',
      'exec',
      'prisma',
      'migrate',
      'resolve',
      '--schema',
      'prisma/schema.prisma',
      '--applied',
      migrationName,
    ],
    {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    },
  );
}

function appliedMigrationNames() {
  const output = queryOutput(`
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL
      AND rolled_back_at IS NULL
    ORDER BY migration_name;
  `);

  if (!output) {
    return [];
  }

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function main() {
  const applied = new Set(appliedMigrationNames());
  const resolved = [];

  for (const migration of MIGRATION_REPAIR_CHECKS) {
    if (applied.has(migration.name)) {
      continue;
    }

    if (migration.isPresent()) {
      console.log(`Local migration repair: marking ${migration.name} as applied because its schema artifacts already exist.`);
      resolveMigrationAsApplied(migration.name);
      resolved.push(migration.name);
    }
  }

  if (resolved.length === 0) {
    console.log('Local migration repair: no drifted migrations needed resolution.');
  }
}

main();
