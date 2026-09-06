// Runtime entrypoints (e.g., server.js) are responsible for loading environment variables.
// Avoid loading real `.env` during tests; Jest setup loads `.env.test` instead.
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}


const config = {
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
};

const shouldUseSsl = () => {
  const raw = String(process.env.PGSSLMODE || process.env.DB_SSL_MODE || "").toLowerCase().replace(/['"]/g, "").trim();
  const explicitSsl = ["require", "true", "1", "yes", "on"].includes(raw) || String(process.env.DB_SSL || "").toLowerCase().replace(/['"]/g, "").trim() === "true";

  if (!explicitSsl) {
    return undefined;
  }

  return {
    require: true,
    // Many managed Postgres providers terminate TLS with a certificate chain
    // that is not trusted by local Node installs. Allow opt-in verification
    // via DB_SSL_REJECT_UNAUTHORIZED=true when a trusted CA is available.
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true",
  };
};

const sslOptions = shouldUseSsl();
const sslDialectOptions = sslOptions
  ? {
      ssl: sslOptions,
    }
  : undefined;

// Serverless (Vercel) needs tiny pool and keepAlive - Neon closes idle connections fast
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const pool = isServerless
  ? { max: 1, min: 0, acquire: 30000, idle: 10000, evict: 10000 }
  : { max: 5, min: 0, acquire: 30000, idle: 10000, evict: 10000 };

// pg driver options - keepAlive prevents ECONNRESET on Vercel/Neon
const baseDialectOptions = {
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  connectionTimeoutMillis: 10000,
  idle_in_transaction_session_timeout: 10000,
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
  retry: { max: 3 },
  dialectOptions: baseDialectOptions,
};

const productionSequelizeOptions = {
  pool,
  retry: { max: 3 },
  dialectOptions: productionDialectOptions,
};

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
