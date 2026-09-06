require('pg');
require('pg-hstore');
const { createApp } = require('../app');

function isConnectionResetError(err) {
  if (typeof require === 'function') {
    try {
      const db = require('../config/database');
      if (db && typeof db.isConnectionResetError === 'function' && db.isConnectionResetError(err)) return true;
    } catch (_) {}
  }
  const code = err?.original?.code || err?.parent?.code || err?.code;
  const msg = String(err?.message || '');
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    err?.name === 'SequelizeConnectionError' ||
    msg.includes('was called after the connection manager was closed')
  );
}

function getLiveSequelize() {
  // Prefer the warm-start cached instance so Models stay bound to one pool.
  const db = globalThis.__sakan_sequelize;
  if (db) return db;
  return require('../config/database');
}

// Revalidate the cached connection every TTL so a warm lambda that outlived
// Neon's idle timeout (ECONNRESET on next query) re-authenticates cheaply.
const INIT_KEY = '__sakan_initPromise';
const INIT_AT_KEY = '__sakan_initAt';
const INIT_TTL_MS = 60 * 1000;

async function ensureDatabase() {
  const now = Date.now();
  const cached = globalThis[INIT_KEY];
  const cachedAt = globalThis[INIT_AT_KEY] || 0;

  if (cached && now - cachedAt < INIT_TTL_MS) {
    return cached;
  }

  // TTL expired (or never init): drop the old promise and re-authenticate.
  // A lightweight SELECT 1 forces the pool to discard dead sockets via the
  // evict/maxUses settings instead of failing the real route query.
  if (cached && now - cachedAt >= INIT_TTL_MS) {
    globalThis[INIT_KEY] = undefined;
  }

  const db = getLiveSequelize();
  const promise = (async () => {
    await db.initDatabase({ sync: false });
    // Validate a real pooled connection, not just the auth handshake.
    await db.query('SELECT 1');
    globalThis[INIT_AT_KEY] = Date.now();
    return db;
  })();

  globalThis[INIT_KEY] = promise;
  try {
    return await promise;
  } catch (err) {
    // Don't cache failures — next request retries fresh.
    if (globalThis[INIT_KEY] === promise) {
      globalThis[INIT_KEY] = undefined;
      globalThis[INIT_AT_KEY] = 0;
    }
    throw err;
  }
}

function createDatabaseBootstrapMiddleware() {
  return async (req, res, next) => {
    // Health/readiness probes must not require DB (lets Vercel + debugging
    // distinguish "server up, DB down" from "server down").
    if (req.path === '/health' || req.path === '/api/health') {
      return next();
    }

    try {
      await ensureDatabase();
      return next();
    } catch (error) {
      if (isConnectionResetError(error)) {
        try {
          // Small backoff so a suspended Neon compute has time to wake.
          await new Promise((r) => setTimeout(r, 500));
          globalThis[INIT_KEY] = undefined;
          globalThis[INIT_AT_KEY] = 0;
          await ensureDatabase();
          return next();
        } catch (retryError) {
          globalThis[INIT_KEY] = undefined;
          globalThis[INIT_AT_KEY] = 0;
          return next(retryError);
        }
      }

      globalThis[INIT_KEY] = undefined;
      globalThis[INIT_AT_KEY] = 0;
      return next(error);
    }
  };
}

const app = createApp({
  beforeRoutes: [createDatabaseBootstrapMiddleware()],
});

// Lightweight readiness probe: reports DB reachability without leaking secrets.
async function healthHandler(req, res) {
  try {
    const db = getLiveSequelize();
    await db.query('SELECT 1');
    return res.status(200).json({ status: 'ok', db: 'up' });
  } catch (err) {
    return res.status(503).json({ status: 'degraded', db: 'down', error: String(err?.message || err) });
  }
}
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

module.exports = app;
module.exports.default = app;
