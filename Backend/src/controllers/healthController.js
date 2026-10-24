const mongoose = require('mongoose');

const getHealth = (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(200).json({
    status: 'ok',
    database: databaseConnected ? 'connected' : 'not connected',
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  getHealth,
};
