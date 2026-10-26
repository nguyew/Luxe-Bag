const c = require('crypto');
module.exports = {
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_a, s) => c.createHash('sha256').update(s).digest('hex'),
  randomUUID: () => c.randomUUID(),
};
