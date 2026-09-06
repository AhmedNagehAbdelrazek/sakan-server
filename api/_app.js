require('pg');
require('pg-hstore');
const { createApp } = require('../app');
const sequelize = require('../config/database');

function isConnectionResetError(err) {
  const code = err?.original?.code || err?.parent?.code || err?.code;
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || err?.name === 'SequelizeConnectionError';
}

function createDatabaseBootstrapMiddleware() {
  // Use global cache so warm Vercel lambdas don't create multiple pools
  const GLOBAL_KEY = '__sakan_initPromise';

  return async (req, res, next) => {
    const getInitPromise = () => {
      if (!globalThis[GLOBAL_KEY]) {
        globalThis[GLOBAL_KEY] = sequelize.initDatabase({ sync: false });
      }
      return globalThis[GLOBAL_KEY];
    };

    try {
      await getInitPromise();
      return next();
    } catch (error) {
      // If it's a connection reset, Neon closed idle connection - retry once
      if (isConnectionResetError(error)) {
        globalThis[GLOBAL_KEY] = undefined;
        try {
          await sequelize.connectionManager.close().catch(() => {});
        } catch (_) {}
        try {
          globalThis[GLOBAL_KEY] = sequelize.initDatabase({ sync: false });
          await globalThis[GLOBAL_KEY];
          return next();
        } catch (retryError) {
          globalThis[GLOBAL_KEY] = undefined;
          return next(retryError);
        }
      }

      globalThis[GLOBAL_KEY] = undefined;
      return next(error);
    }
  };
}

const app = createApp({
  beforeRoutes: [createDatabaseBootstrapMiddleware()],
});

module.exports = app;