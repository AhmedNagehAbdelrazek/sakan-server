const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require("morgan");

const mainRoute = require('./Routes/index');
const globalErrorHandler = require('./middlewares/globalErrorHandler');

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cors());
  app.use(helmet());

  // Keep noisy logging out of tests by default.
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // main system route
  app.use('/api', mainRoute);

  app.use(globalErrorHandler);

  return app;
}

module.exports = {
  createApp,
};
