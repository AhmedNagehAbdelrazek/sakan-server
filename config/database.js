require("pg");
require("pg-hstore");
const { Sequelize } = require("sequelize");
const config = require("./config");

const rawEnv = String(process.env.NODE_ENV || "development").trim().replace(/^["']|["']$/g, "").toLowerCase();
const environment = ["development", "test", "production"].includes(rawEnv) ? rawEnv : "development";
const dbConfig = config[environment];

function isServerlessEnv() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

// Cache Sequelize on globalThis for Vercel serverless warm starts.
// Without this, each invocation can leak connections and ECONNRESET happens
// when Neon closes idle pooled connections.
function getSequelize() {
  const globalKey = "__sakan_sequelize";
  if (globalThis[globalKey]) {
    return globalThis[globalKey];
  }
  const instance = new Sequelize(dbConfig);
  globalThis[globalKey] = instance;
  return instance;
}

let sequelize = getSequelize();
module.exports.getSequelize = getSequelize;

function isConnectionManagerClosed(inst) {
  try {
    return inst.connectionManager.getConnection.toString().includes('was called after the connection manager was closed')
      || !inst.connectionManager.pool;
  } catch (_) {
    return false;
  }
}

function recreateSequelize() {
  // Prefer in-place pool restore to keep Models bound to same sequelize instance.
  // Creating a new Sequelize would orphan already-imported Models.
  if (isConnectionManagerClosed(sequelize)) {
    try {
      console.warn('Attempting in-place ConnectionManager pool restore');
      // close() overwrote getConnection as instance property - delete to restore prototype method
      if (sequelize.connectionManager.hasOwnProperty('getConnection')) {
        delete sequelize.connectionManager.getConnection;
      }
      // Re-init pools on same instance (keeps models intact)
      if (typeof sequelize.connectionManager.initPools === 'function') {
        sequelize.connectionManager.initPools();
      }
      // Verify restore succeeded
      if (!isConnectionManagerClosed(sequelize)) {
        console.warn('In-place pool restore succeeded');
        return sequelize;
      }
    } catch (e) {
      console.error('In-place pool restore failed, falling back to new instance:', e.message);
    }
  }

  // Fallback: create fresh instance (models will need re-init, but better than hard crash)
  const globalKey = "__sakan_sequelize";
  try { delete globalThis[globalKey]; } catch (_) {}
  const fresh = new Sequelize(dbConfig);
  globalThis[globalKey] = fresh;
  sequelize = fresh;
  module.exports = sequelize;
  module.exports.initDatabase = initDatabase;
  module.exports.getSequelize = getSequelize;
  module.exports.recreateSequelize = recreateSequelize;
  module.exports.restoreSequelizePool = recreateSequelize;
  module.exports.isConnectionManagerClosed = isConnectionManagerClosed;
  return fresh;
}


async function validateDatabase() {
    // Connect a separate connection to the default database
    const tempSequelize = new Sequelize({
        dialect: "postgres",
        dialectOptions: {
        },
        ...dbConfig,
        database: "postgres" 
    });

    try {
        // Authenticate the temporary connection
        await tempSequelize.authenticate();

        // Check if the database exists
        const [results] = await tempSequelize.query(
            `SELECT 1 FROM pg_database WHERE datname = '${dbConfig.database}'`
        );

        if (results.length === 0) {
            // Create the database if it doesn't exist
            await tempSequelize.query(
                `CREATE DATABASE ${dbConfig.database}`
            );
            console.log(`Database ${dbConfig.database} created.`);
        }
    } catch (error) {
        console.error("Unable to connect to the database:", error);
    } finally {
        // Close the temporary connection
        await tempSequelize.close();
    }

    // Authenticate the main connection
    try {
        await sequelize.authenticate();
        console.log("Connection has been established successfully.");
    } catch (error) {
        console.error("Unable to connect to the database:", error);
    }
}

/**
 * Initializes the database connection and (optionally) runs Sequelize sync.
 *
 * IMPORTANT:
 * - This function must be called by the runtime entrypoint (server) explicitly.
 * - Tests can import models without triggering DB connections as a side-effect.
 */
function isConnectionResetError(err) {
  const code = err?.original?.code || err?.parent?.code || err?.code;
  const msg = String(err?.message || err?.original?.message || '');
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ECONNREFUSED' ||
    err?.name === 'SequelizeConnectionError' ||
    err?.name === 'SequelizeConnectionTimedOutError' ||
    err?.name === 'SequelizeConnectionRefusedError' ||
    /ECONNRESET|ETIMEDOUT|Connection terminated|terminating connection|too many clients|was called after the connection manager was closed/i.test(msg)
  );
}

// Drop dead sockets without permanently closing the manager.
// NOTE: never call connectionManager.close() here — it permanently replaces
// getConnection with a throwing stub and forces an instance recreate.
async function purgeDeadPoolConnections(inst) {
  try {
    const pool = inst?.connectionManager?.pool;
    if (pool && typeof pool.destroyAllNow === 'function') {
      await pool.destroyAllNow();
    }
  } catch (_) {
    // best-effort only; retry below will get a fresh socket
  }
}

function missingConnectionEnv() {
  return ['host', 'database', 'username'].filter((k) => !dbConfig[k]);
}

async function initDatabase({ sync = true, syncOptions = { alter: true, force: false } } = {}) {
    // await validateDatabase();

    const missing = missingConnectionEnv();
    if (missing.length) {
      const err = new Error(
        `Database configuration incomplete (missing: ${missing.join(', ')}). ` +
        'On Vercel set DATABASE_URL (recommended, from Neon) or ' +
        'DB_HOST/DB_PORT/DB_NAME/DB_USERNAME/DB_PASSWORD. ' +
        `Current host=${dbConfig.host || '(missing)'} db=${dbConfig.database || '(missing)'}.`
      );
      err.name = 'SequelizeConnectionError';
      err.code = 'ENOTFOUND';
      throw err;
    }

    // On Vercel, even sync:false needs to ensure connection is alive.
    // Neon closes idle connections => ECONNRESET on next query if we skip authenticate.
    // Also: Neon's compute may be suspended (scale-to-zero); waking it can add 1-2s,
    // so use exponential backoff rather than a fixed tiny delay.
    const maxRetries = isServerlessEnv() ? 5 : 1;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // If previous code (pre-fix) called connectionManager.close(), the manager is permanently closed.
      // Detect and recreate fresh instance before trying.
      if (isConnectionManagerClosed(sequelize)) {
        console.warn('ConnectionManager was closed, recreating Sequelize instance');
        recreateSequelize();
      }

      try {
        if (!sync) {
          await sequelize.authenticate();
          return sequelize;
        }

        await sequelize.sync(syncOptions);
        console.log("Database synchronized");
        return sequelize;
      } catch (err) {
        const isClosedError = String(err?.message || '').includes('was called after the connection manager was closed');
        if (isClosedError) {
          console.warn('Detected closed ConnectionManager, recreating...');
          recreateSequelize();
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 200 * attempt));
            continue;
          }
        }

        const isLastAttempt = attempt === maxRetries;
        const shouldRetry = isConnectionResetError(err) && !isLastAttempt;

        console.error(`Database init attempt ${attempt}/${maxRetries} failed:`, err.message);

        if (shouldRetry) {
          // Purge dead sockets (safe) so the retry acquires a fresh connection.
          // Do NOT call connectionManager.close() - it permanently closes the manager
          // and causes "getConnection was called after the connection manager was closed".
          // Exponential backoff (300ms, 600ms, 1200ms...) leaves room for Neon cold starts.
          await purgeDeadPoolConnections(sequelize);
          const backoff = 300 * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        console.error("Unable to synchronize the database:", err);
        throw err;
      }
    }

    return sequelize;
}

module.exports = sequelize;
module.exports.initDatabase = initDatabase;
module.exports.getSequelize = getSequelize;
module.exports.recreateSequelize = recreateSequelize;
module.exports.restoreSequelizePool = recreateSequelize;
module.exports.isConnectionManagerClosed = isConnectionManagerClosed;
module.exports.isConnectionResetError = isConnectionResetError;
module.exports.purgeDeadPoolConnections = purgeDeadPoolConnections;
