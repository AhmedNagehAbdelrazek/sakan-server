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

const sequelize = getSequelize();


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
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || err?.name === 'SequelizeConnectionError';
}

async function initDatabase({ sync = true, syncOptions = { alter: true, force: false } } = {}) {
    // await validateDatabase();

    // On Vercel, even sync:false needs to ensure connection is alive.
    // Neon closes idle connections => ECONNRESET on next query if we skip authenticate.
    const maxRetries = isServerlessEnv() ? 3 : 1;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!sync) {
          await sequelize.authenticate();
          return sequelize;
        }

        await sequelize.sync(syncOptions);
        console.log("Database synchronized");
        return sequelize;
      } catch (err) {
        const isLastAttempt = attempt === maxRetries;
        const shouldRetry = isConnectionResetError(err) && !isLastAttempt;

        console.error(`Database init attempt ${attempt}/${maxRetries} failed:`, err.message);

        if (shouldRetry) {
          // Force pool to drop dead connections before retry
          try {
            await sequelize.connectionManager.close();
          } catch (_) {}
          // small backoff
          await new Promise((r) => setTimeout(r, 200 * attempt));
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
