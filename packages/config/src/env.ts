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
  acumatica: AppAcumaticaConfig;
  queue: {
    connectionString: string;
  };
};

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const environment = parseEnvironmentName(env.NODE_ENV);
  const appName = env.APP_NAME?.trim() || 'pulse-api';
  const appVersion = env.APP_VERSION?.trim() || '0.1.0';

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
    acumatica: {
      baseUrl: requireString(env.ACUMATICA_BASE_URL, 'ACUMATICA_BASE_URL'),
      apiVersion: env.ACUMATICA_API_VERSION?.trim() || '24.100.001',
      company: env.ACUMATICA_COMPANY?.trim() || 'Dynamic AQS',
      username: optionalString(env.ACUMATICA_USERNAME),
      password: optionalString(env.ACUMATICA_PASSWORD),
      accessToken: optionalString(env.ACUMATICA_ACCESS_TOKEN),
    },
    queue: {
      connectionString: requireString(env.DATABASE_URL ?? env.PG_BOSS_CONNECTION_STRING, 'DATABASE_URL or PG_BOSS_CONNECTION_STRING'),
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
