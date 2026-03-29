// Jest global setup (runs before test files are evaluated)
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Allow using a separate .env.test without affecting dev/prod.
// We intentionally require dotenv here (already a dependency) to avoid relying on CLI preload.
try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: '.env.test' });
} catch (e) {
  // no-op
}

// Provide safe defaults for tests if not set by .env.test
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'test-secret';
process.env.SUPPORT_CONTACT = process.env.SUPPORT_CONTACT || 'Contact Sakan Support';

process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
// Jest runs test files in parallel worker processes by default. Integration tests
// do destructive DB resets (`sync({ force: true })`), so we isolate DB per worker
// to avoid cross-worker race conditions (e.g., enum type creation collisions).
const workerId = process.env.JEST_WORKER_ID;
const baseDbName = process.env.DB_NAME || 'sakan_test';
process.env.DB_NAME = workerId && !baseDbName.endsWith(`_${workerId}`)
  ? `${baseDbName}_${workerId}`
  : baseDbName;
process.env.DB_USERNAME = process.env.DB_USERNAME || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
