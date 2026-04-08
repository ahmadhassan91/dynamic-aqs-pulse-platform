export type AppEnvironmentName = 'development' | 'test' | 'staging' | 'production';

export type AppServerConfig = {
  port: number;
};

export type AppLoggingConfig = {
  level: 'debug' | 'info' | 'warn' | 'error';
};

export type AppAcumaticaConfig = {
  baseUrl: string;
  apiVersion: string;
  company: string;
  username?: string | undefined;
  password?: string | undefined;
  accessToken?: string | undefined;
};

export type AppDatabaseConfig = {
  url: string;
};

export type AppQueueConfig = {
  connectionString: string;
  schema: string;
  archiveSeconds: number;
  deleteAfterSeconds: number;
  monitorIntervalSeconds: number;
  pollingIntervalSeconds: number;
  deadLetterQueue: string;
};

export type AppMigrationConfig = {
  adminToken?: string | undefined;
};

export type AppAuthBootstrapConfig = {
  email?: string | undefined;
  password?: string | undefined;
  displayName: string;
  role: string;
};

export type AppAuthConfig = {
  issuer: string;
  accessTokenTtlMinutes: number;
  refreshTokenTtlDays: number;
  bootstrapAdmin: AppAuthBootstrapConfig;
};

export type AppConfig = {
  app: {
    name: string;
    version: string;
  };
  environment: {
    name: AppEnvironmentName;
  };
  server: AppServerConfig;
  logging: AppLoggingConfig;
  database: AppDatabaseConfig;
  acumatica: AppAcumaticaConfig;
  queue: AppQueueConfig;
  migration: AppMigrationConfig;
  auth: AppAuthConfig;
};

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const environment = parseEnvironmentName(env.NODE_ENV);
  const appName = env.APP_NAME?.trim() || 'pulse-api';
  const appVersion = env.APP_VERSION?.trim() || '0.1.0';
  const databaseUrl = requireString(env.DATABASE_URL, 'DATABASE_URL');

  return {
    app: {
      name: appName,
      version: appVersion,
    },
    environment: {
      name: environment,
    },
    server: {
      port: parseNumber(env.PORT, 4000),
    },
    logging: {
      level: parseLogLevel(env.LOG_LEVEL),
    },
    database: {
      url: databaseUrl,
    },
    acumatica: {
      baseUrl: requireString(env.ACUMATICA_BASE_URL, 'ACUMATICA_BASE_URL'),
      apiVersion: env.ACUMATICA_API_VERSION?.trim() || '24.100.001',
      company: env.ACUMATICA_COMPANY?.trim() || 'Dynamic AQS',
      username: optionalString(env.ACUMATICA_USERNAME),
      password: optionalString(env.ACUMATICA_PASSWORD),
      accessToken: optionalString(env.ACUMATICA_ACCESS_TOKEN),
    },
    queue: {
      connectionString: optionalString(env.PG_BOSS_CONNECTION_STRING) ?? databaseUrl,
      schema: env.PGBOSS_SCHEMA?.trim() || 'pgboss',
      archiveSeconds: parseNumber(env.PGBOSS_ARCHIVE_SECONDS, 60 * 60 * 24 * 7),
      deleteAfterSeconds: parseNumber(env.PGBOSS_DELETE_AFTER_SECONDS, 60 * 60 * 24 * 30),
      monitorIntervalSeconds: parseNumber(env.PGBOSS_MONITOR_INTERVAL_SECONDS, 5),
      pollingIntervalSeconds: parseNumber(env.PGBOSS_POLLING_INTERVAL_SECONDS, 2),
      deadLetterQueue: env.PGBOSS_DEAD_LETTER_QUEUE?.trim() || 'pulse.dead-letter',
    },
    migration: {
      adminToken: optionalString(env.MIGRATION_ADMIN_TOKEN),
    },
    auth: {
      issuer: env.AUTH_ISSUER?.trim() || 'pulse.local',
      accessTokenTtlMinutes: parseNumber(env.AUTH_ACCESS_TOKEN_TTL_MINUTES, 15),
      refreshTokenTtlDays: parseNumber(env.AUTH_REFRESH_TOKEN_TTL_DAYS, 14),
      bootstrapAdmin: {
        email: optionalString(env.AUTH_BOOTSTRAP_ADMIN_EMAIL),
        password: optionalString(env.AUTH_BOOTSTRAP_ADMIN_PASSWORD),
        displayName: env.AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME?.trim() || 'Pulse Bootstrap Admin',
        role: env.AUTH_BOOTSTRAP_ADMIN_ROLE?.trim() || 'SUPER_ADMIN',
      },
    },
  };
}

function parseEnvironmentName(value: string | undefined): AppEnvironmentName {
  if (value === 'test' || value === 'staging' || value === 'production') return value;
  return 'development';
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseLogLevel(value: string | undefined): AppLoggingConfig['level'] {
  if (value === 'debug' || value === 'warn' || value === 'error') return value;
  return 'info';
}

function requireString(value: string | undefined, key: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return trimmed;
}

function optionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
