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
  const sslMode = String(process.env.PGSSLMODE || process.env.DB_SSL_MODE || "").toLowerCase();
  const explicitSsl = ["require", "true", "1", "yes", "on"].includes(sslMode) || process.env.DB_SSL === "true";

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

module.exports = {
  development: {
    ...config,
    logging: false,
    define: {
      createdAt: "createdat",
      updatedAt: "updatedat"
    },
    dialect: 'postgres',
    ...(sslDialectOptions ? { dialectOptions: sslDialectOptions } : {}),
  },
  test: {
    ...config,
    logging: false,
    define: {
      createdAt: "createdat",
      updatedAt: "updatedat"
    },
    dialect: 'postgres',
    ...(sslDialectOptions ? { dialectOptions: sslDialectOptions } : {}),
  },
  production: {
    ...config,
    define: {
      createdAt: "createdat",
      updatedAt: "updatedat"
    },
    dialect: 'postgres',
    ...(sslDialectOptions ? { dialectOptions: sslDialectOptions } : {
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
    }),
  },
  aws: {
    useAWS: true,
    getConfig: initAWSDBConfig,
    logging: false,
    define: {
      createdAt: "createdat",
      updatedAt: "updatedat"
    },
    dialect: 'postgres',
    ...(sslDialectOptions ? { dialectOptions: sslDialectOptions } : {}),
  }
};
