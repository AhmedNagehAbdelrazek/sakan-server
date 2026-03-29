const sequelize = require('../../config/database');

async function initTestDatabase() {
  // For integration tests we want a clean schema.
  // NOTE: This uses sync({ force: true }), which is destructive.
  await sequelize.initDatabase({
    sync: true,
    syncOptions: { force: true, alter: false },
  });

  return sequelize;
}

async function closeTestDatabase() {
  await sequelize.close();
}

module.exports = {
  initTestDatabase,
  closeTestDatabase,
};
