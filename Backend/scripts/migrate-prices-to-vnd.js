// Converts legacy mixed-scale prices to whole VND (see legacyPriceToVnd in src/utils/money.js).
//
//   node scripts/migrate-prices-to-vnd.js            # dry run: prints what would change
//   node scripts/migrate-prices-to-vnd.js --apply    # writes the changes
//
// Touches Product.cost / originalCost and Coupon.minSubtotal / maxDiscount only.
// Existing Orders are NOT rewritten: they are historical snapshots. Reports mix old
// and new orders, so clear development orders if you want clean numbers.
const mongoose = require('mongoose');
const { mongoUri } = require('../src/config/env');
const Product = require('../src/models/Product');
const Coupon = require('../src/models/Coupon');
const { legacyPriceToVnd } = require('../src/utils/money');

// Anything positive but below 10,000 is a legacy value (millions or USD), not whole dong.
const needsMigration = (value) => value != null && Number(value) > 0 && Number(value) < 10000;

async function migrate(Model, fields, label, apply) {
  const docs = await Model.collection.find({}).toArray();
  let changed = 0;
  for (const doc of docs) {
    const set = {};
    for (const field of fields) {
      if (needsMigration(doc[field])) set[field] = legacyPriceToVnd(doc[field]);
    }
    if (!Object.keys(set).length) continue;
    changed += 1;
    const name = doc.handbagName || doc.code || doc._id;
    console.log(`${label} ${name}: ${fields.filter((f) => set[f] !== undefined).map((f) => `${f} ${doc[f]} -> ${set[f]}`).join(', ')}`);
    // Raw collection write: bypasses model validators, which now require integers.
    if (apply) await Model.collection.updateOne({ _id: doc._id }, { $set: set });
  }
  return changed;
}

async function run() {
  if (!mongoUri) throw new Error('MONGODB_URI is required.');
  const apply = process.argv.includes('--apply');
  await mongoose.connect(mongoUri);
  const products = await migrate(Product, ['cost', 'originalCost'], 'product', apply);
  const coupons = await migrate(Coupon, ['minSubtotal', 'maxDiscount'], 'coupon', apply);
  console.log(`${apply ? 'Updated' : 'Would update'} ${products} products and ${coupons} coupons.${apply ? '' : ' Re-run with --apply to write.'}`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
