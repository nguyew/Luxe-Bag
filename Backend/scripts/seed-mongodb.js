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
const Order = require('../src/models/Order');
const Review = require('../src/models/Review');

const reset = process.argv.includes('--reset');
const migrate = process.argv.includes('--migrate') || reset;

const ids = {
  admin: new mongoose.Types.ObjectId('670000000000000000000001'),
  customer: new mongoose.Types.ObjectId('670000000000000000000002'),
  customerLinh: new mongoose.Types.ObjectId('670000000000000000000003'),
  customerBao: new mongoose.Types.ObjectId('670000000000000000000004'),
  customerMai: new mongoose.Types.ObjectId('670000000000000000000005'),
  customerKhoa: new mongoose.Types.ObjectId('670000000000000000000006'),
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

const daysAgo = (now, days) => new Date(now - days * 24 * 60 * 60 * 1000);

function buildDemoOrders(now) {
  const address = (name, phone, line1, city = 'Ho Chi Minh City') => ({
    fullName: name,
    phone,
    line1,
    city,
  });
  const item = (product, quantity = 1, unitPrice = product.cost) => ({
    productId: product._id,
    handbagId: product._id.toString(),
    name: product.handbagName,
    brand: product.brand,
    category: product.category,
    uri: product.uri || '',
    unitPrice,
    qty: quantity,
  });
  const order = ({
    id, number, userId, status, paymentStatus, paymentMethod = 'card',
    days, items, customerAddress,
  }) => {
    const subtotal = items.reduce((sum, orderItem) => sum + orderItem.unitPrice * orderItem.qty, 0);
    const createdAt = daysAgo(now, days);
    return {
      _id: id,
      orderNumber: number,
      userId,
      status,
      items,
      subtotal,
      discount: 0,
      shipping: 0,
      total: subtotal,
      address: customerAddress,
      paymentMethod,
      paymentStatus,
      paymentProvider: paymentMethod === 'card' ? 'stripe' : 'cod',
      paymentCompletedAt: paymentStatus === 'paid' ? createdAt : null,
      history: [{ status: 'pending', at: createdAt }, ...(status !== 'pending' ? [{ status, at: createdAt }] : [])],
      createdAt,
      updatedAt: createdAt,
    };
  };

  return [
    order({
      id: new mongoose.Types.ObjectId('670000000000000000000401'),
      number: 'LB-SEED-0001',
      userId: ids.customer,
      status: 'delivered',
      paymentStatus: 'paid',
      days: 12,
      items: [item(products[0])],
      customerAddress: address('Nguyen Minh Anh', '+84900000002', '12 Nguyen Hue'),
    }),
    order({
      id: new mongoose.Types.ObjectId('670000000000000000000402'),
      number: 'LB-SEED-0002',
      userId: ids.customerLinh,
      status: 'delivered',
      paymentStatus: 'paid',
      days: 9,
      items: [item(products[1], 2)],
      customerAddress: address('Linh Nguyen', '+84900000003', '18 Le Loi'),
    }),
    order({
      id: new mongoose.Types.ObjectId('670000000000000000000403'),
      number: 'LB-SEED-0003',
      userId: ids.customerBao,
      status: 'delivered',
      paymentStatus: 'paid',
      days: 7,
      items: [item(products[0]), item(products[1])],
      customerAddress: address('Bao Dang', '+84900000004', '25 Hai Ba Trung'),
    }),
    order({
      id: new mongoose.Types.ObjectId('670000000000000000000404'),
      number: 'LB-SEED-0004',
      userId: ids.customerMai,
      status: 'delivered',
      paymentStatus: 'paid',
      days: 4,
      items: [item(products[1])],
      customerAddress: address('Mai Tran', '+84900000005', '40 Nguyen Trai'),
    }),
    order({
      id: new mongoose.Types.ObjectId('670000000000000000000405'),
      number: 'LB-SEED-0005',
      userId: ids.customerKhoa,
      status: 'delivered',
      paymentStatus: 'paid',
      days: 2,
      items: [item(products[0])],
      customerAddress: address('Khoa Le', '+84900000006', '7 Pham Ngoc Thach'),
    }),
    order({
      id: new mongoose.Types.ObjectId('670000000000000000000406'),
      number: 'LB-SEED-0006',
      userId: ids.customerLinh,
      status: 'pending',
      paymentStatus: 'unpaid',
      paymentMethod: 'cod',
      days: 1,
      items: [item(products[0])],
      customerAddress: address('Linh Nguyen', '+84900000003', '18 Le Loi'),
    }),
  ];
}

async function upsertDemoOrdersAndReviews() {
  const now = Date.now();
  const orders = buildDemoOrders(now);
  await Order.collection.bulkWrite(orders.map(({ _id, ...fields }) => ({
    updateOne: {
      filter: { _id },
      update: { $set: fields, $setOnInsert: { _id } },
      upsert: true,
    },
  })));

  const reviews = [
    {
      productId: ids.productTabby,
      userId: ids.customer,
      author: 'Nguyen Minh Anh',
      rating: 5,
      comment: 'Beautiful bag and the leather feels premium. It is perfect for daily use.',
      hidden: false,
    },
    {
      productId: ids.productTote,
      userId: ids.customerLinh,
      author: 'Linh Nguyen',
      rating: 4,
      comment: 'Roomy and stylish. The red color is exactly what I wanted.',
      hidden: false,
    },
    {
      productId: ids.productTabby,
      userId: ids.customerBao,
      author: 'Bao Dang',
      rating: 5,
      comment: 'Great quality and very well packaged.',
      hidden: false,
    },
    {
      productId: ids.productTote,
      userId: ids.customerMai,
      author: 'Mai Tran',
      rating: 3,
      comment: 'Looks good, but it is a little smaller than I expected.',
      hidden: true,
    },
    {
      productId: ids.productTabby,
      userId: ids.customerKhoa,
      author: 'Khoa Le',
      rating: 4,
      comment: 'Stylish and sturdy. Delivery was quick.',
      hidden: false,
    },
  ].map((review, index) => {
    const createdAt = daysAgo(now, 3 + index);
    return {
      _id: new mongoose.Types.ObjectId(`6700000000000000000005${String(index + 1).padStart(2, '0')}`),
      ...review,
      createdAt,
      updatedAt: createdAt,
    };
  });

  await Review.collection.bulkWrite(reviews.map(({ _id, productId, userId, ...fields }) => ({
    updateOne: {
      filter: { productId, userId },
      update: { $set: { ...fields, productId, userId }, $setOnInsert: { _id } },
      upsert: true,
    },
  })));
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
    ...[
      ['customerLinh', 'Linh Nguyen', 'customer.linh@luxebag.com', '+84900000003', '18 Le Loi'],
      ['customerBao', 'Bao Dang', 'customer.bao@luxebag.com', '+84900000004', '25 Hai Ba Trung'],
      ['customerMai', 'Mai Tran', 'customer.mai@luxebag.com', '+84900000005', '40 Nguyen Trai'],
      ['customerKhoa', 'Khoa Le', 'customer.khoa@luxebag.com', '+84900000006', '7 Pham Ngoc Thach'],
    ].map(([id, name, email, phone, line1]) => ({
      _id: ids[id],
      name,
      email,
      passwordHash: customerPasswordHash,
      role: 'customer',
      status: 'active',
      emailVerifiedAt: new Date(),
      phone,
      addresses: [{
        id: 'addr-home',
        label: 'Home',
        fullName: name,
        phone,
        line1,
        city: 'Ho Chi Minh City',
        isDefault: true,
      }],
    })),
  ]);

  await upsertCatalogTerms();
  await upsert(Product, products);
  await upsertDemoOrdersAndReviews();

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
  console.log('Additional demo customers: customer.linh@luxebag.com, customer.bao@luxebag.com, customer.mai@luxebag.com, customer.khoa@luxebag.com / Customer@123');
}

seed()
  .catch((error) => {
    console.error('MongoDB seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
