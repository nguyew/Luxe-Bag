const { nodeEnv } = require('../config/env');

const notFound = (req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: statusCode >= 500 && nodeEnv === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error',
  });
};

module.exports = {
  errorHandler,
  notFound,
};
