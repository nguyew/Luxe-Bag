const http = require('http');
const app = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/db');
const { mongoUri, port } = require('./config/env');
const { startPaymentCleanup, stopPaymentCleanup } = require('./services/paymentCleanupService');

const server = http.createServer(app);

const start = async () => {
  try {
    await connectDatabase(mongoUri);
    server.listen(port, () => {
      console.log(`LuxeBag API listening on port ${port}`);
      startPaymentCleanup();
    });
  } catch (error) {
    console.error('Unable to start the server:', error);
    process.exitCode = 1;
  }
};

const shutdown = async (signal) => {
  console.log(`${signal} received; shutting down`);
  stopPaymentCleanup();
  server.close(async (error) => {
    if (error) {
      console.error('Unable to close the HTTP server:', error);
      process.exitCode = 1;
    }

    await disconnectDatabase();
  });
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

start();
