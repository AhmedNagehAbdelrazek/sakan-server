const fs = require('fs');
const path = require('path');

const sequelize = require('../../config/database');
require('../../Models');

async function run() {
  try {
    await sequelize.initDatabase({
      sync: true,
      syncOptions: { force: true, alter: false },
    });

    const up = fs.readFileSync(
      path.join(__dirname, '../../database/migrations/20260401_property_state.up.sql'),
      'utf8',
    );
    const down = fs.readFileSync(
      path.join(__dirname, '../../database/migrations/20260401_property_state.down.sql'),
      'utf8',
    );

    await sequelize.query(up);

    const [nullRows] = await sequelize.query(
      'SELECT COUNT(*)::int AS count FROM properties WHERE state IS NULL;',
    );
    const [distribution] = await sequelize.query(
      'SELECT state, COUNT(*)::int AS total FROM properties GROUP BY state ORDER BY state;',
    );
    const [defaultRow] = await sequelize.query(
      "SELECT column_default FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'state';",
    );

    await sequelize.query(down);

    const [existsRow] = await sequelize.query(
      "SELECT COUNT(*)::int AS count FROM information_schema.columns WHERE table_name='properties' AND column_name='state';",
    );

    console.log(
      JSON.stringify(
        {
          upMigration: 'ok',
          verifyNullStateRows: nullRows[0]?.count ?? null,
          verifyDistribution: distribution,
          verifyDefault: defaultRow[0]?.column_default ?? null,
          downMigration: 'ok',
          stateColumnAfterDown: existsRow[0]?.count ?? null,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
