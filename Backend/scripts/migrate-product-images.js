const crypto = require('crypto');
const mongoose = require('mongoose');
const { mongoUri } = require('../src/config/env');
const Product = require('../src/models/Product');

async function run() {
  if (!mongoUri) throw new Error('MONGODB_URI is required.');
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(mongoUri);
  const products = await Product.find({
    uri: { $type: 'string', $ne: '' },
    imageKey: { $type: 'string', $ne: '' },
  });
  let migrated = 0;
  for (const product of products) {
    if (product.images?.length) continue;
    if (dryRun) {
      migrated += 1;
      continue;
    }
    product.images = [{
      id: crypto.randomUUID(),
      url: product.uri,
      key: product.imageKey,
      alt: product.handbagName,
      sortOrder: 0,
      isPrimary: true,
    }];
    await product.save();
    migrated += 1;
  }
  console.log(`${dryRun ? 'Would migrate' : 'Migrated'} ${migrated} product image records.`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
