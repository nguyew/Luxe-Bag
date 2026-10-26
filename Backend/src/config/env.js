const dotenv = require('dotenv');

dotenv.config();

const port = Number.parseInt(process.env.PORT || '5000', 10);
const nodeEnv = process.env.NODE_ENV || 'development';

if (Number.isNaN(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port between 1 and 65535');
}

module.exports = {
  b2ApplicationKey: process.env.B2_APPLICATION_KEY || '',
  b2ApplicationKeyId: process.env.B2_APPLICATION_KEY_ID || '',
  b2BucketName: process.env.B2_BUCKET_NAME || '',
  b2Endpoint: process.env.B2_ENDPOINT || '',
  b2PublicUrl: (process.env.B2_PUBLIC_URL || '').replace(/\/+$/, ''),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtSecret: process.env.JWT_SECRET || (nodeEnv === 'production' ? '' : 'development-only-change-me'),
  mongoUri: process.env.MONGODB_URI || '',
  nodeEnv,
  port,
};
