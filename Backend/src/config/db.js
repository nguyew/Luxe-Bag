const mongoose = require('mongoose');

const connectDatabase = async (mongoUri) => {
  if (!mongoUri) {
    console.warn('MONGODB_URI is not set; starting without a database connection.');
    return;
  }

  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
};

const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

module.exports = {
  connectDatabase,
  disconnectDatabase,
};
