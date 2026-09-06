const dotenv = require("dotenv");
const http = require('http');
const socketServer = require('./socketServer');
const authenticate = require("./middlewares/socketAuthentacation");

const sequelize = require('./config/database');
const seedAdmin = require('./utils/seedAdmin');
const seedData = require('./utils/seedData');

const { createApp } = require('./app');

dotenv.config({ path: ".env" });

const app = createApp();

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = socketServer(server);
io.use(authenticate);
app.set('io', io);

async function start() {
  // Explicit DB init (no side-effects on import)
  await sequelize.initDatabase();

  await seedAdmin();

  await seedData();
  
  server.listen(PORT,'0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exitCode = 1;
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

return server;