// Runtime entrypoints (e.g., server.js) are responsible for loading environment variables.
// Avoid loading real `.env` during tests; Jest setup loads `.env.test` instead.
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}

function clean(value) {
  if (value === undefined || value === null) return undefined;
  return String(value).trim().replace(/^["']|["']$/g, '').trim() || undefined;
}

// Vercel + Neon typically inject a single connection string (DATABASE_URL,
// POSTGRES_URL, POSTGRES_PRISMA_URL). The old code only read split DB_* vars,
// so on Vercel `host` was undefined and pg failed with `read ECONNRESET` at
// connect time. Support both, preferring the URL when present.
function parseConnectionUrl(raw) {
  const value = clean(raw);
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) return null;
    const params = url.searchParams;
    const sslmode = clean(params.get('sslmode'));
    return {
      username: clean(decodeURIComponent(url.username)),
      password: clean(decodeURIComponent(url.password)),
      host: clean(url.hostname),
      port: url.port ? parseInt(url.port, 10) : 5432,
      database: clean(decodeURIComponent(url.pathname.replace(/^\//, ''))),
      urlSslMode: sslmode,
      source: 'url',
    };
  } catch (_) {
    return null;
  }
}

const urlConfig =
  parseConnectionUrl(process.env.DATABASE_URL) ||
  parseConnectionUrl(process.env.POSTGRES_URL) ||
  parseConnectionUrl(process.env.POSTGRES_PRISMA_URL) ||
  parseConnectionUrl(process.env.POSTGRES_URL_NON_POOLING);

const splitConfig = {
  username: clean(process.env.DB_USERNAME),
  password: clean(process.env.DB_PASSWORD),
  database: clean(process.env.DB_NAME),
  host: clean(process.env.DB_HOST),
  port: process.env.DB_PORT ? parseInt(clean(process.env.DB_PORT), 10) : 5432,
  source: 'split',
};

const picked = urlConfig || splitConfig;

const config = {
  username: picked.username,
  password: picked.password,
  database: picked.database,
  host: picked.host,
  port: Number.isNaN(picked.port) ? 5432 : picked.port,
};

const shouldUseSsl = () => {
  const raw = String(process.env.PGSSLMODE || process.env.DB_SSL_MODE || picked.urlSslMode || "").toLowerCase().replace(/['"]/g, "").trim();
  const explicitSsl = ["require", "true", "1", "yes", "on", "verify-full", "verify-ca"].includes(raw) || String(process.env.DB_SSL || "").toLowerCase().replace(/['"]/g, "").trim() === "true";

  // Managed Postgres (Neon/Supabase/RDS) + any serverless/production env => SSL on.
  const isManagedHost = /neon\.tech|supabase\.co|amazonaws\.com|render\.com|railway\.app/i.test(String(picked.host || ''));
  const isServerlessLike = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) || String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  if (!explicitSsl && !(isManagedHost || isServerlessLike)) {
    return undefined;
  }

  return {
    require: true,
    // Many managed Postgres providers terminate TLS with a certificate chain
    // that is not trusted by local Node installs. Allow opt-in verification
    // via DB_SSL_REJECT_UNAUTHORIZED=true when a trusted CA is available.
    rejectUnauthorized: clean(process.env.DB_SSL_REJECT_UNAUTHORIZED) === "true",
  };
};

const sslOptions = shouldUseSsl();
const sslDialectOptions = sslOptions
  ? {
      ssl: sslOptions,
    }
  : undefined;

// Serverless (Vercel) needs a tiny, fast-recycling pool. Neon closes idle
// connections quickly and suspends compute on scale-to-zero; holding stale
// sockets is what surfaces as `read ECONNRESET`.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const pool = isServerless
  ? { max: 1, min: 0, acquire: 15000, idle: 5000, evict: 2000, maxUses: 50 }
  : { max: 5, min: 0, acquire: 30000, idle: 10000, evict: 5000 };

// pg driver options - keepAlive prevents ECONNRESET on Vercel/Neon
//
// NOTE: Do NOT send unsupported GUC/startup parameters (e.g.
// `idle_in_transaction_session_timeout`) when using Neon's pooled
// `*-pooler` endpoint. Neon's PgBouncer only tracks
// client_encoding/datestyle/timezone/standard_conforming_strings and
// rejects (resets) the connection for any other startup parameter,
// surfacing as `read ECONNRESET` at connect time.
const baseDialectOptions = {
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  connectionTimeoutMillis: 10000,
  ...(sslDialectOptions || {}),
};

const productionDialectOptions = sslDialectOptions
  ? baseDialectOptions
  : {
      ...baseDialectOptions,
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    };

const baseSequelizeOptions = {
  pool,
  retry: {
    max: 3,
    // Retry transient network blips (Neon cold start / idle close) at query time.
    match: [
      /ECONNRESET/,
      /ETIMEDOUT/,
      /ENOTFOUND/,
      /EAI_AGAIN/,
      /Connection terminated/,
      /terminating connection/,
      /too many clients/,
    ],
  },
  dialectOptions: baseDialectOptions,
};

const productionSequelizeOptions = {
  pool,
  retry: {
    max: 3,
    match: [
      /ECONNRESET/,
      /ETIMEDOUT/,
      /ENOTFOUND/,
      /EAI_AGAIN/,
      /Connection terminated/,
      /terminating connection/,
      /too many clients/,
    ],
  },
  dialectOptions: productionDialectOptions,
};

// Log sanitized connection info (no password) so Vercel runtime logs show
// immediately whether env wiring is wrong. Runs once per cold start.
if (process.env.NODE_ENV !== 'test' && !globalThis.__sakan_dbconfig_logged) {
  globalThis.__sakan_dbconfig_logged = true;
  const missing = ['host', 'database', 'username'].filter((k) => !config[k]);
  console.log(
    `[db-config] source=${picked.source || 'unknown'} host=${config.host || '(missing)'} ` +
    `port=${config.port || '(missing)'} db=${config.database || '(missing)'} ` +
    `user=${config.username || '(missing)'} ssl=${shouldUseSsl() ? 'on' : 'off'} ` +
    `serverless=${isServerless}` +
    (missing.length ? ` MISSING=${missing.join(',')}` : '')
  );
  if (missing.length) {
    console.error(
      '[db-config] Database env is incomplete on this host. On Vercel set either ' +
      'DATABASE_URL (recommended, from Neon) or DB_HOST/DB_PORT/DB_NAME/DB_USERNAME/DB_PASSWORD.'
    );
  }
}

module.exports = {
  development: {
    ...config,
    logging: false,
    define: {
      createdAt: "createdat",
      updatedAt: "updatedat"
    },
    dialect: 'postgres',
    ...baseSequelizeOptions,
    // allow env override to take precedence but keep keepAlive defaults
    dialectOptions: { ...baseSequelizeOptions.dialectOptions, ...(sslDialectOptions || {}) },
  },
  test: {
    ...config,
    logging: false,
    define: {
      createdAt: "createdat",
      updatedAt: "updatedat"
    },
    dialect: 'postgres',
    ...baseSequelizeOptions,
    dialectOptions: { ...baseSequelizeOptions.dialectOptions, ...(sslDialectOptions || {}) },
  },
  production: {
    ...config,
    logging: false,
    define: {
      createdAt: "createdat",
      updatedAt: "updatedat"
    },
    dialect: 'postgres',
    ...productionSequelizeOptions,
  }
};
