/**
 * Shared test app factory — creates an Express app with all routes
 * without starting the server or the recovery interval.
 */
const express = require('express');
const cors = require('cors');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/providers', require('../../src/routes/providers'));
  app.use('/api/renters',   require('../../src/routes/renters'));
  app.use('/api/benchmark', require('../../src/routes/benchmark'));
  app.use('/api/jobs',      require('../../src/routes/jobs'));
  app.use('/api/recovery',  require('../../src/routes/recovery'));

  return app;
}

module.exports = { createApp };
