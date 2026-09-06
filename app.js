const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require("morgan");

const mainRoute = require('./Routes/index');
const globalErrorHandler = require('./middlewares/globalErrorHandler');

function createApp({ beforeRoutes = [] } = {}) {
  const app = express();

  app.use(express.json());
  app.use(cors());
  app.use(helmet());

  // app.use(createAuditMiddleware(audit, {
  //   skip: (req) => req.path === '/health'
  // }));

  beforeRoutes.forEach((middleware) => {
    app.use(middleware);
  });

  // Keep noisy logging out of tests by default.
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // main system route
  app.use('/api', mainRoute);
  app.get('/', (req, res) => {
    res.send('Hello to Sakan Server');
  });

  app.use(globalErrorHandler);

  return app;
}

module.exports = {
  createApp,
};
