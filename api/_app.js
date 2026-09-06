require('pg');
require('pg-hstore');
const { createApp } = require('../app');

function isConnectionResetError(err) {
  const code = err?.original?.code || err?.parent?.code || err?.code;
  const msg = String(err?.message || '');
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || err?.name === 'SequelizeConnectionError'
    || msg.includes('was called after the connection manager was closed');
}

function getLiveSequelize() {
  // Always fetch fresh from global / require to handle recreation after close()
  let db = globalThis.__sakan_sequelize;
  if (db) return db;
  // Clear cache to get updated module.exports if it was recreated
  try { delete require.cache[require.resolve('../config/database')]; } catch (_) {}
  return require('../config/database');
}

function createDatabaseBootstrapMiddleware() {
  // Use global cache so warm Vercel lambdas don't create multiple pools
  const GLOBAL_KEY = '__sakan_initPromise';

  return async (req, res, next) => {
    const getInitPromise = () => {
      if (!globalThis[GLOBAL_KEY]) {
        const db = getLiveSequelize();
        // If manager was closed by previous buggy code, recreate before init
        if (db.isConnectionManagerClosed && db.isConnectionManagerClosed(db) && db.recreateSequelize) {
          db.recreateSequelize();
          const fresh = getLiveSequelize();
          globalThis[GLOBAL_KEY] = fresh.initDatabase({ sync: false });
        } else {
          globalThis[GLOBAL_KEY] = db.initDatabase({ sync: false });
        }
      }
      return globalThis[GLOBAL_KEY];
    };

    try {
      await getInitPromise();
      return next();
    } catch (error) {
      // If it's a connection reset or closed manager, retry once without ever calling close()
      if (isConnectionResetError(error)) {
        globalThis[GLOBAL_KEY] = undefined;
        // If closed, ensure fresh instance
        const msg = String(error?.message || '');
        if (msg.includes('was called after the connection manager was closed')) {
          try {
            const db = getLiveSequelize();
            if (db.recreateSequelize) db.recreateSequelize();
          } catch (_) {}
        }
        try {
          const db = getLiveSequelize();
          globalThis[GLOBAL_KEY] = db.initDatabase({ sync: false });
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