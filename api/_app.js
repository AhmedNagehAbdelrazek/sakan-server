const { createApp } = require('../app');
const sequelize = require('../config/database');

function createDatabaseBootstrapMiddleware() {
  let initPromise;

  return async (req, res, next) => {
    try {
      if (!initPromise) {
        initPromise = sequelize.initDatabase({ sync: false });
      }

      await initPromise;
      next();
    } catch (error) {
      initPromise = undefined;
      next(error);
    }
  };
}

const app = createApp({
  beforeRoutes: [createDatabaseBootstrapMiddleware()],
});

module.exports = app;