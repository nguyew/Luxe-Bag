const mongoose = require('mongoose');
const { mongoUri } = require('../src/config/env');
const CatalogTerm = require('../src/models/CatalogTerm');
const Product = require('../src/models/Product');
const { slugify } = require('../src/controllers/catalogController');

async function migrateType(type, dryRun) {
  const values = await Product.distinct(type, { [type]: { $type: 'string', $ne: '' } });
  let migrated = 0;
  for (const rawName of values) {
    const name = String(rawName).trim();
    const slug = slugify(name);
    if (name.length < 2 || !slug) continue;
    if (dryRun) {
      const exists = await CatalogTerm.exists({ type, slug });
      if (!exists) migrated += 1;
      continue;
    }
    const result = await CatalogTerm.updateOne(
      { type, slug },
      { $setOnInsert: { type, slug, name, active: true, sortOrder: 0 } },
      { upsert: true }
    );
    if (result.upsertedCount) migrated += 1;
  }
  return migrated;
}

async function run() {
  if (!mongoUri) throw new Error('MONGODB_URI is required.');
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(mongoUri);
  const brands = await migrateType('brand', dryRun);
  const categories = await migrateType('category', dryRun);
  console.log(`${dryRun ? 'Would create' : 'Created'} ${brands} brands and ${categories} categories.`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
