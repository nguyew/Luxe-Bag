const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error('MONGODB_URI is required to seed MongoDB.');

const User = require('../src/models/User');
const Product = require('../src/models/Product');
const CatalogTerm = require('../src/models/CatalogTerm');
const Promotion = require('../src/models/Promotion');
const Coupon = require('../src/models/Coupon');

const reset = process.argv.includes('--reset');
const migrate = process.argv.includes('--migrate') || reset;

const ids = {
  admin: new mongoose.Types.ObjectId('670000000000000000000001'),
  customer: new mongoose.Types.ObjectId('670000000000000000000002'),
  productTabby: new mongoose.Types.ObjectId('670000000000000000000301'),
  productTote: new mongoose.Types.ObjectId('670000000000000000000302'),
};

const terms = [
  { type: 'brand', name: 'bag1', slug: 'bag1', active: true, sortOrder: 1 },
  { type: 'brand', name: 'Coach', slug: 'coach', active: true, sortOrder: 2 },
  { type: 'brand', name: 'Furla', slug: 'furla', active: true, sortOrder: 3 },
  { type: 'category', name: 'Shoulder Bag', slug: 'shoulder-bag', active: true, sortOrder: 1 },
  { type: 'category', name: 'Tote Bag', slug: 'tote-bag', active: true, sortOrder: 2 },
];

const products = [
  {
    _id: ids.productTabby,
    handbagName: 'Tabby Shoulder Bag 26',
    slug: 'coach-tabby-shoulder-bag-26',
    brand: 'Coach',
    category: 'Shoulder Bag',
    cost: 8900000,
    color: ['Black', 'Ivory'],
    gender: true,
    stock: 18,
    status: 'published',
  },
  {
    _id: ids.productTote,
    handbagName: 'Bag1 Tote Classic',
    slug: 'bag1-tote-classic',
    brand: 'bag1',
    category: 'Tote Bag',
    cost: 9999,
    color: ['Red'],
    gender: false,
    stock: 80,
    status: 'published',
  },
];

async function upsert(model, documents) {
  if (!documents.length) return;
  const isProductModel = model.modelName === 'Product';
  await model.bulkWrite(documents.map((document) => {
    const { _id, ...fields } = document;
    return {
      updateOne: {
        filter: { _id },
        update: {
          $set: fields,
          ...(isProductModel ? { $unset: { originalCost: 1, percentOff: 1, discountMode: 1 } } : {}),
          $setOnInsert: { _id },
        },
        upsert: true,
      },
    };
  }));
}

async function upsertCatalogTerms() {
  await Promise.all(terms.map((term) => CatalogTerm.updateOne(
    { type: term.type, slug: term.slug },
    { $set: term, $setOnInsert: { _id: new mongoose.Types.ObjectId() } },
    { upsert: true }
  )));
}

async function dropLegacyIndexes() {
  for (const collectionName of ['promotions', 'products']) {
    const collections = await mongoose.connection.db
      .listCollections({ name: collectionName })
      .toArray();
    if (!collections.length) continue;

    const collection = mongoose.connection.collection(collectionName);
    const indexes = await collection.listIndexes().toArray();
    for (const index of indexes) {
      const keys = Object.keys(index.key || {});
      if (index.name === '_id_' || !keys.includes('code')) continue;
      await collection.dropIndex(index.name);
      console.log(`Removed legacy ${collectionName} index ${index.name}`);
    }

    const legacyDiscountedProducts = await Product.find({
      $or: [
        { percentOff: { $gt: 0 } },
        { originalCost: { $exists: true, $ne: null } },
      ],
    }).select('_id cost originalCost');
    for (const product of legacyDiscountedProducts) {
      const restoredCost = Number(product.originalCost);
      await Product.updateOne(
        { _id: product._id },
        {
          $set: Number.isFinite(restoredCost) && restoredCost > Number(product.cost)
            ? { cost: restoredCost, percentOff: 0, discountMode: 'real' }
            : { percentOff: 0, discountMode: 'real' },
          $unset: { originalCost: 1 },
        }
      );
    }
  }
}

async function migrateCatalogValues() {
  const catalogTerms = await CatalogTerm.find({}).select('_id type name slug').lean();
  for (const term of catalogTerms) {
    const values = [String(term._id), term.slug].filter(Boolean);
    if (!values.length) continue;
    await Product.updateMany(
      { [term.type]: { $in: values } },
      { $set: { [term.type]: term.name } }
    );
  }
}

async function resetDatabase() {
  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const collection of collections) {
    if (!collection.name.startsWith('system.')) {
      await mongoose.connection.collection(collection.name).drop();
    }
  }
  console.log('MongoDB database reset completed.');
}

async function seed() {
  await mongoose.connect(mongoUri);
  if (reset) await resetDatabase();

  if (migrate) {
    await dropLegacyIndexes();
    await migrateCatalogValues();
    if (!reset && process.argv.includes('--migrate')) {
      console.log('MongoDB migration completed without reseeding data.');
      return;
    }
  }

  const [adminPasswordHash, customerPasswordHash] = await Promise.all([
    bcrypt.hash('Admin@123', 12),
    bcrypt.hash('Customer@123', 12),
  ]);

  await upsert(User, [
    {
      _id: ids.admin,
      name: 'LuxeBag Admin',
      email: 'admin@luxebag.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
      status: 'active',
      emailVerifiedAt: new Date(),
      phone: '+84900000001',
    },
    {
      _id: ids.customer,
      name: 'Nguyen Minh Anh',
      email: 'customer@luxebag.com',
      passwordHash: customerPasswordHash,
      role: 'customer',
      status: 'active',
      emailVerifiedAt: new Date(),
      phone: '+84900000002',
      addresses: [{
        id: 'addr-home',
        label: 'Home',
        fullName: 'Nguyen Minh Anh',
        phone: '+84900000002',
        line1: '12 Nguyen Hue',
        city: 'Ho Chi Minh City',
        isDefault: true,
      }],
    },
  ]);

  await upsertCatalogTerms();
  await upsert(Product, products);

  await upsert(Promotion, [
    {
      _id: 'pr-bag1-20',
      name: 'Bag1 20% Promotion',
      percentOff: 0.2,
      scope: 'brand',
      targetValue: 'bag1',
      active: true,
      expiresAt: null,
    },
    {
      _id: 'pr-tote-50',
      name: 'Tote Bag 50% Promotion',
      percentOff: 0.5,
      scope: 'category',
      targetValue: 'Tote Bag',
      active: true,
      expiresAt: null,
    },
  ]);

  await upsert(Coupon, [
    {
      _id: 'cp-bag1-50',
      code: 'BAG1OFF50',
      type: 'percent',
      value: 50,
      minSubtotal: 0,
      maxDiscount: null,
      scope: 'brand',
      targetValue: 'bag1',
      active: true,
      usageLimit: null,
      usedCount: 0,
    },
  ]);

  console.log(`MongoDB seed completed (${reset ? 'reset + seed' : migrate ? 'migration + seed' : 'upsert seed'}).`);
  console.log('Admin: admin@luxebag.com / Admin@123');
  console.log('Customer: customer@luxebag.com / Customer@123');
}

seed()
  .catch((error) => {
    console.error('MongoDB seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
