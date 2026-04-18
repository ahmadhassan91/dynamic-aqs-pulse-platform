export type AppEnvironmentName = 'development' | 'test' | 'staging' | 'production';

export type AppServerConfig = {
  port: number;
};

export type AppLoggingConfig = {
  level: 'debug' | 'info' | 'warn' | 'error';
};

export type AppWebConfig = {
  publicBaseUrl: string;
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

export type AppLeadOperationsConfig = {
  operationalAlertScanIntervalMinutes: number;
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

export type AppEntraAuthConfig = {
  enabled: boolean;
  tenantId?: string | undefined;
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  redirectUri?: string | undefined;
  scopes: string[];
  authBaseUrl: string;
  graphBaseUrl: string;
  groupRoleMap: Record<string, string>;
};

export type AppAuthConfig = {
  issuer: string;
  accessTokenTtlMinutes: number;
  refreshTokenTtlDays: number;
  passwordRecovery: {
    tokenTtlMinutes: number;
    previewEnabled: boolean;
  };
  bootstrapAdmin: AppAuthBootstrapConfig;
  entra: AppEntraAuthConfig;
};

export type AppOutlookCalendarConfig = {
  enabled: boolean;
  tenantId?: string | undefined;
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  redirectUri?: string | undefined;
  scopes: string[];
  authBaseUrl: string;
  graphBaseUrl: string;
  encryptionKey?: string | undefined;
};

export type AppMonerisHostedTokenizationConfig = {
  enabled: boolean;
  profileId?: string | undefined;
  iframeUrl: string;
  iframeOrigin: string;
  callbackSecret?: string | undefined;
  encryptionKey?: string | undefined;
  tokenTtlMinutes: number;
  cleanupIntervalMinutes: number;
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
  web: AppWebConfig;
  database: AppDatabaseConfig;
  acumatica: AppAcumaticaConfig;
  queue: AppQueueConfig;
  leads: AppLeadOperationsConfig;
  migration: AppMigrationConfig;
  auth: AppAuthConfig;
  outlookCalendar: AppOutlookCalendarConfig;
  monerisHostedTokenization: AppMonerisHostedTokenizationConfig;
};

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const environment = parseEnvironmentName(env.NODE_ENV);
  const appName = env.APP_NAME?.trim() || 'pulse-api';
  const appVersion = env.APP_VERSION?.trim() || '0.1.0';
  const databaseUrl = requireString(env.DATABASE_URL, 'DATABASE_URL');
  const outlookTenantId = optionalString(env.MICROSOFT_ENTRA_TENANT_ID);
  const outlookClientId = optionalString(env.MICROSOFT_ENTRA_CLIENT_ID);
  const outlookClientSecret = optionalString(env.MICROSOFT_ENTRA_CLIENT_SECRET);
  const outlookRedirectUri = optionalString(env.MICROSOFT_GRAPH_REDIRECT_URI);
  const outlookEncryptionKey = optionalString(env.APP_ENCRYPTION_KEY);
  const outlookScopes = parseScopes(env.MICROSOFT_GRAPH_SCOPES);
  const monerisProfileId = optionalString(env.MONERIS_HOSTED_TOKENIZATION_PROFILE_ID);
  const monerisIframeUrl = optionalString(env.MONERIS_HOSTED_TOKENIZATION_IFRAME_URL)
    ?? (environment === 'production' || environment === 'staging'
      ? 'https://mpg1.moneris.io/HPPtoken/index.php'
      : 'https://mpg1t.moneris.io/HPPtoken/index.php');
  const monerisIframeOrigin = optionalString(env.MONERIS_HOSTED_TOKENIZATION_IFRAME_ORIGIN)
    ?? safeUrlOrigin(monerisIframeUrl);
  const monerisCallbackSecret = optionalString(env.MONERIS_HOSTED_TOKENIZATION_CALLBACK_SECRET);
  const entraLoginRedirectUri = optionalString(env.MICROSOFT_ENTRA_LOGIN_REDIRECT_URI);
  const entraLoginScopes = parseScopes(env.MICROSOFT_ENTRA_LOGIN_SCOPES, [
    'openid',
    'profile',
    'email',
    'offline_access',
    'User.Read',
  ]);
  const entraGroupRoleMap = parseKeyValueMap(env.MICROSOFT_ENTRA_GROUP_ROLE_MAP);
  const passwordRecoveryPreviewEnabled = parseBoolean(
    env.AUTH_PASSWORD_RECOVERY_PREVIEW_ENABLED,
    environment !== 'production',
  );

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
    web: {
      publicBaseUrl: env.APP_WEB_BASE_URL?.trim() || 'http://localhost:3000',
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
    leads: {
      operationalAlertScanIntervalMinutes: parseNumber(env.LEAD_OPERATIONAL_ALERT_SCAN_INTERVAL_MINUTES, 15),
    },
    migration: {
      adminToken: optionalString(env.MIGRATION_ADMIN_TOKEN),
    },
    auth: {
      issuer: env.AUTH_ISSUER?.trim() || 'pulse.local',
      accessTokenTtlMinutes: parseNumber(env.AUTH_ACCESS_TOKEN_TTL_MINUTES, 15),
      refreshTokenTtlDays: parseNumber(env.AUTH_REFRESH_TOKEN_TTL_DAYS, 14),
      passwordRecovery: {
        tokenTtlMinutes: parseNumber(env.AUTH_PASSWORD_RECOVERY_TOKEN_TTL_MINUTES, 60),
        previewEnabled: passwordRecoveryPreviewEnabled,
      },
      bootstrapAdmin: {
        email: optionalString(env.AUTH_BOOTSTRAP_ADMIN_EMAIL),
        password: optionalString(env.AUTH_BOOTSTRAP_ADMIN_PASSWORD),
        displayName: env.AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME?.trim() || 'Pulse Bootstrap Admin',
        role: env.AUTH_BOOTSTRAP_ADMIN_ROLE?.trim() || 'SUPER_ADMIN',
      },
      entra: {
        enabled: Boolean(
          outlookTenantId
            && outlookClientId
            && outlookClientSecret
            && entraLoginRedirectUri,
        ),
        tenantId: outlookTenantId,
        clientId: outlookClientId,
        clientSecret: outlookClientSecret,
        redirectUri: entraLoginRedirectUri,
        scopes: entraLoginScopes,
        authBaseUrl: env.MICROSOFT_ENTRA_AUTH_BASE_URL?.trim() || 'https://login.microsoftonline.com',
        graphBaseUrl: env.MICROSOFT_GRAPH_API_BASE_URL?.trim() || 'https://graph.microsoft.com/v1.0',
        groupRoleMap: entraGroupRoleMap,
      },
    },
    outlookCalendar: {
      enabled: Boolean(
        outlookTenantId
          && outlookClientId
          && outlookClientSecret
          && outlookRedirectUri
          && outlookEncryptionKey,
      ),
      tenantId: outlookTenantId,
      clientId: outlookClientId,
      clientSecret: outlookClientSecret,
      redirectUri: outlookRedirectUri,
      scopes: outlookScopes,
      authBaseUrl: env.MICROSOFT_ENTRA_AUTH_BASE_URL?.trim() || 'https://login.microsoftonline.com',
      graphBaseUrl: env.MICROSOFT_GRAPH_API_BASE_URL?.trim() || 'https://graph.microsoft.com/v1.0',
      encryptionKey: outlookEncryptionKey,
    },
    monerisHostedTokenization: {
      enabled: Boolean(monerisProfileId && outlookEncryptionKey),
      profileId: monerisProfileId,
      iframeUrl: monerisIframeUrl,
      iframeOrigin: monerisIframeOrigin,
      callbackSecret: monerisCallbackSecret,
      encryptionKey: outlookEncryptionKey,
      tokenTtlMinutes: parseNumber(env.MONERIS_HOSTED_TOKENIZATION_TOKEN_TTL_MINUTES, 30),
      cleanupIntervalMinutes: parseNumber(env.MONERIS_HOSTED_TOKENIZATION_CLEANUP_INTERVAL_MINUTES, 15),
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

function parseBoolean(value: string | undefined, fallback: boolean) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function requireString(value: string | undefined, key: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return trimmed;
}

function safeUrlOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function optionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseScopes(value: string | undefined, fallback: string[] = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'Calendars.ReadWrite',
]) {
  const raw = value?.trim();
  if (!raw) {
    return fallback;
  }

  return raw
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseKeyValueMap(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) {
    return {};
  }

  return raw
    .split(/[,\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, entry) => {
      const [key, mappedValue] = entry.split(/[=:]/, 2).map((part) => part?.trim());
      if (key && mappedValue) {
        accumulator[key] = mappedValue;
      }

      return accumulator;
    }, {});
}
