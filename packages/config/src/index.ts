/**
 * Shared configuration for ResQ Live
 * Uses Zod for validation and type-safe environment variables
 */

import { z } from 'zod';

// ============================================
// Environment Variable Schema
// ============================================

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('/api/v1'),
  API_VERSION: z.string().default('1.0.0'),

  // Database (PostgreSQL + PostGIS)
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_NAME: z.string().default('resq_live'),
  DATABASE_USER: z.string().default('postgres'),
  DATABASE_PASSWORD: z.string().default('postgres'),
  DATABASE_SSL: z.coerce.boolean().default(false),
  DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_MIGRATIONS_TABLE: z.string().default('knex_migrations'),
  DATABASE_MIGRATIONS_LOCK_TABLE: z.string().default('knex_migrations_lock'),

  // Redis (BullMQ, caching, sessions)
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().nonnegative().default(0),
  REDIS_TLS: z.coerce.boolean().default(false),

  // JWT Authentication
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  JWT_ISSUER: z.string().default('resq-live'),
  JWT_AUDIENCE: z.string().default('resq-live-clients'),

  // Object Storage (S3-compatible: MinIO, AWS S3, GCS)
  S3_ENDPOINT: z.string().url().optional(), // Required for MinIO/local
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('resq-live-evidence'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  S3_PRESIGNED_URL_EXPIRY: z.coerce.number().int().positive().default(3600), // 1 hour
  S3_PUBLIC_URL: z.string().url().optional(), // For public derivatives

  // Evidence Processing
  EVIDENCE_MAX_SIZE_BYTES: z.coerce.number().int().positive().default(100 * 1024 * 1024), // 100MB
  EVIDENCE_ALLOWED_MIME_TYPES: z.string().default('image/jpeg,image/png,image/heic,video/mp4,video/webm,audio/mpeg,audio/wav,application/pdf'),
  EVIDENCE_UPLOAD_CHUNK_SIZE: z.coerce.number().int().positive().default(5 * 1024 * 1024), // 5MB

  // Sync Configuration
  SYNC_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  SYNC_CURSOR_EXPIRY_DAYS: z.coerce.number().int().positive().default(30),
  SYNC_MAX_RETRIES: z.coerce.number().int().nonnegative().default(5),
  SYNC_BASE_RETRY_DELAY_MS: z.coerce.number().int().positive().default(1000),
  SYNC_MAX_RETRY_DELAY_MS: z.coerce.number().int().positive().default(60000),

  // Notification Providers
  FCM_SERVER_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().default('ResQ Live'),

  // Rate Limiting
  THROTTLE_TTL: z.coerce.number().int().positive().default(60), // seconds
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100), // requests per TTL

  // Health Checks
  HEALTH_MEMORY_HEAP_LIMIT_MB: z.coerce.number().int().positive().default(150),
  HEALTH_MEMORY_HEAP_READY_LIMIT_MB: z.coerce.number().int().positive().default(300),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // Feature Flags
  FEATURE_EOC_NODE: z.coerce.boolean().default(false),
  FEATURE_SMS_FALLBACK: z.coerce.boolean().default(false),
  FEATURE_PUBLIC_DERIVATIVES: z.coerce.boolean().default(false),

  // Encryption (for desktop/local DB)
  LOCAL_DB_ENCRYPTION_KEY: z.string().min(32).optional(),

  // Audit Export
  AUDIT_EXPORT_MAX_ROWS: z.coerce.number().int().positive().default(10000),
  AUDIT_EXPORT_TTL_HOURS: z.coerce.number().int().positive().default(24),
});

// ============================================
// Parsed Configuration
// ============================================

let parsedConfig: z.infer<typeof envSchema> | null = null;

/**
 * Get validated configuration
 * Throws on first call if validation fails
 */
export function getConfig(): z.infer<typeof envSchema> {
  if (!parsedConfig) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      const errorMessages = Object.entries(errors)
        .flatMap(([field, messages]) => messages.map((msg) => `${field}: ${msg}`))
        .join('\n');
      throw new Error(`Configuration validation failed:\n${errorMessages}`);
    }
    parsedConfig = result.data;
  }
  return parsedConfig;
}

/**
 * Reset configuration (for testing)
 */
export function resetConfig(): void {
  parsedConfig = null;
}

// ============================================
// Typed Configuration Accessors
// ============================================

export const config = {
  get app() {
    const c = getConfig();
    return {
      env: c.NODE_ENV,
      port: c.PORT,
      apiPrefix: c.API_PREFIX,
      apiVersion: c.API_VERSION,
    };
  },

  get database() {
    const c = getConfig();
    return {
      host: c.DATABASE_HOST,
      port: c.DATABASE_PORT,
      name: c.DATABASE_NAME,
      user: c.DATABASE_USER,
      password: c.DATABASE_PASSWORD,
      ssl: c.DATABASE_SSL,
      pool: {
        min: c.DATABASE_POOL_MIN,
        max: c.DATABASE_POOL_MAX,
      },
      migrations: {
        tableName: c.DATABASE_MIGRATIONS_TABLE,
        lockTableName: c.DATABASE_MIGRATIONS_LOCK_TABLE,
      },
      // Knex connection config
      toKnexConfig() {
        return {
          client: 'pg',
          connection: {
            host: c.DATABASE_HOST,
            port: c.DATABASE_PORT,
            database: c.DATABASE_NAME,
            user: c.DATABASE_USER,
            password: c.DATABASE_PASSWORD,
            ssl: c.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
          },
          pool: {
            min: c.DATABASE_POOL_MIN,
            max: c.DATABASE_POOL_MAX,
          },
          migrations: {
            tableName: c.DATABASE_MIGRATIONS_TABLE,
            directory: './src/database/migrations',
          },
        };
      },
    };
  },

  get redis() {
    const c = getConfig();
    return {
      host: c.REDIS_HOST,
      port: c.REDIS_PORT,
      password: c.REDIS_PASSWORD,
      db: c.REDIS_DB,
      tls: c.REDIS_TLS,
      // ioredis connection string
      toConnectionString() {
        const auth = c.REDIS_PASSWORD ? `:${c.REDIS_PASSWORD}@` : '';
        const protocol = c.REDIS_TLS ? 'rediss' : 'redis';
        return `${protocol}://${auth}${c.REDIS_HOST}:${c.REDIS_PORT}/${c.REDIS_DB}`;
      },
    };
  },

  get jwt() {
    const c = getConfig();
    return {
      accessSecret: c.JWT_ACCESS_SECRET,
      accessExpiresIn: c.JWT_ACCESS_EXPIRES_IN,
      refreshSecret: c.JWT_REFRESH_SECRET,
      refreshExpiresIn: c.JWT_REFRESH_EXPIRES_IN,
      issuer: c.JWT_ISSUER,
      audience: c.JWT_AUDIENCE,
    };
  },

  get storage() {
    const c = getConfig();
    return {
      endpoint: c.S3_ENDPOINT,
      region: c.S3_REGION,
      bucket: c.S3_BUCKET,
      accessKey: c.S3_ACCESS_KEY,
      secretKey: c.S3_SECRET_KEY,
      forcePathStyle: c.S3_FORCE_PATH_STYLE,
      presignedUrlExpiry: c.S3_PRESIGNED_URL_EXPIRY,
      publicUrl: c.S3_PUBLIC_URL,
      // AWS SDK v3 config
      toS3ClientConfig() {
        return {
          region: c.S3_REGION,
          endpoint: c.S3_ENDPOINT,
          credentials: {
            accessKeyId: c.S3_ACCESS_KEY,
            secretAccessKey: c.S3_SECRET_KEY,
          },
          forcePathStyle: c.S3_FORCE_PATH_STYLE,
        };
      },
    };
  },

  get evidence() {
    const c = getConfig();
    return {
      maxSizeBytes: c.EVIDENCE_MAX_SIZE_BYTES,
      allowedMimeTypes: c.EVIDENCE_ALLOWED_MIME_TYPES.split(',').map((t) => t.trim()),
      uploadChunkSize: c.EVIDENCE_UPLOAD_CHUNK_SIZE,
    };
  },

  get sync() {
    const c = getConfig();
    return {
      batchSize: c.SYNC_BATCH_SIZE,
      cursorExpiryDays: c.SYNC_CURSOR_EXPIRY_DAYS,
      maxRetries: c.SYNC_MAX_RETRIES,
      baseRetryDelayMs: c.SYNC_BASE_RETRY_DELAY_MS,
      maxRetryDelayMs: c.SYNC_MAX_RETRY_DELAY_MS,
    };
  },

  get notifications() {
    const c = getConfig();
    return {
      fcm: c.FCM_SERVER_KEY ? { serverKey: c.FCM_SERVER_KEY } : null,
      twilio: c.TWILIO_ACCOUNT_SID && c.TWILIO_AUTH_TOKEN
        ? {
            accountSid: c.TWILIO_ACCOUNT_SID,
            authToken: c.TWILIO_AUTH_TOKEN,
            fromNumber: c.TWILIO_FROM_NUMBER,
          }
        : null,
      smtp: c.SMTP_HOST && c.SMTP_USER && c.SMTP_PASSWORD
        ? {
            host: c.SMTP_HOST,
            port: c.SMTP_PORT,
            secure: c.SMTP_PORT === 465,
            auth: {
              user: c.SMTP_USER,
              pass: c.SMTP_PASSWORD,
            },
            from: {
              email: c.SMTP_FROM_EMAIL || c.SMTP_USER,
              name: c.SMTP_FROM_NAME,
            },
          }
        : null,
    };
  },

  get rateLimit() {
    const c = getConfig();
    return {
      ttl: c.THROTTLE_TTL,
      limit: c.THROTTLE_LIMIT,
    };
  },

  get health() {
    const c = getConfig();
    return {
      memoryHeapLimitMb: c.HEALTH_MEMORY_HEAP_LIMIT_MB,
      memoryHeapReadyLimitMb: c.HEALTH_MEMORY_HEAP_READY_LIMIT_MB,
    };
  },

  get logging() {
    const c = getConfig();
    return {
      level: c.LOG_LEVEL,
      format: c.LOG_FORMAT,
    };
  },

  get cors() {
    const c = getConfig();
    return {
      origin: c.CORS_ORIGIN,
    };
  },

  get features() {
    const c = getConfig();
    return {
      eocNode: c.FEATURE_EOC_NODE,
      smsFallback: c.FEATURE_SMS_FALLBACK,
      publicDerivatives: c.FEATURE_PUBLIC_DERIVATIVES,
    };
  },

  get encryption() {
    const c = getConfig();
    return {
      localDbKey: c.LOCAL_DB_ENCRYPTION_KEY,
    };
  },

  get audit() {
    const c = getConfig();
    return {
      exportMaxRows: c.AUDIT_EXPORT_MAX_ROWS,
      exportTtlHours: c.AUDIT_EXPORT_TTL_HOURS,
    };
  },
};

// ============================================
// Type Exports
// ============================================

export type AppConfig = ReturnType<typeof config.app>;
export type DatabaseConfig = ReturnType<typeof config.database>;
export type RedisConfig = ReturnType<typeof config.redis>;
export type JwtConfig = ReturnType<typeof config.jwt>;
export type StorageConfig = ReturnType<typeof config.storage>;
export type EvidenceConfig = ReturnType<typeof config.evidence>;
export type SyncConfig = ReturnType<typeof config.sync>;
export type NotificationsConfig = ReturnType<typeof config.notifications>;
export type RateLimitConfig = ReturnType<typeof config.rateLimit>;
export type HealthConfig = ReturnType<typeof config.health>;
export type LoggingConfig = ReturnType<typeof config.logging>;
export type CorsConfig = ReturnType<typeof config.cors>;
export type FeaturesConfig = ReturnType<typeof config.features>;
export type EncryptionConfig = ReturnType<typeof config.encryption>;
export type AuditConfig = ReturnType<typeof config.audit>;