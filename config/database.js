const { Sequelize } = require("sequelize");
const config = require("./config");

const environment = process.env.NODE_ENV || "development";
const dbConfig = config[environment];

const sequelize = new Sequelize(dbConfig);


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
async function initDatabase({ sync = true, syncOptions = { alter: true, force: false } } = {}) {
    await validateDatabase();

    if (!sync) return sequelize;

    try {
        await sequelize.sync(syncOptions);
        console.log("Database synchronized");
    } catch (err) {
        console.error("Unable to synchronize the database:", err);
        throw err;
    }

    return sequelize;
}

module.exports = sequelize;
module.exports.initDatabase = initDatabase;
