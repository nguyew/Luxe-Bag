const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Schema } = mongoose;
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error('MONGODB_URI is required to seed MongoDB.');
}

const addressSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, required: true, trim: true },
    recipientName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: '' },
    ward: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    postalCode: { type: String, trim: true, default: '' },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const imageSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, default: 0 },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, trim: true, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const schemas = {
  User: new Schema(
    {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, unique: true, lowercase: true, trim: true },
      passwordHash: { type: String, required: true, select: false },
      role: { type: String, enum: ['customer', 'admin'], default: 'customer', index: true },
      status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
      phone: { type: String, trim: true, default: '' },
      avatarUrl: { type: String, trim: true, default: '' },
    },
    { timestamps: true }
  ),
  Brand: new Schema(
    {
      name: { type: String, required: true, unique: true, trim: true },
      slug: { type: String, required: true, unique: true, trim: true },
      description: { type: String, trim: true, default: '' },
      logoUrl: { type: String, trim: true, default: '' },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
  ),
  Category: new Schema(
    {
      name: { type: String, required: true, unique: true, trim: true },
      slug: { type: String, required: true, unique: true, trim: true },
      description: { type: String, trim: true, default: '' },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
  ),
  Product: new Schema(
    {
      name: { type: String, required: true, trim: true },
      slug: { type: String, required: true, unique: true, trim: true },
      brand: { type: Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
      category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
      description: { type: String, trim: true, default: '' },
      gender: { type: String, enum: ['women', 'men', 'unisex'], default: 'unisex' },
      images: { type: [imageSchema], default: [] },
      price: { type: Number, required: true, min: 0 },
      compareAtPrice: { type: Number, min: 0, default: null },
      discountPercent: { type: Number, min: 0, max: 100, default: 0 },
      currency: { type: String, default: 'VND', uppercase: true },
      inventoryQuantity: { type: Number, min: 0, default: 0 },
      reservedQuantity: { type: Number, min: 0, default: 0 },
      status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
      colors: { type: [String], default: [] },
      tags: { type: [String], default: [] },
      publishedAt: { type: Date, default: null },
    },
    { timestamps: true }
  ),
  Address: addressSchema,
  Favorite: new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    },
    { timestamps: true }
  ),
  Cart: new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
      items: [
        {
          product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
          quantity: { type: Number, required: true, min: 1 },
          unitPrice: { type: Number, required: true, min: 0 },
        },
      ],
    },
    { timestamps: true }
  ),
  Order: new Schema(
    {
      orderNumber: { type: String, required: true, unique: true },
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      items: { type: [orderItemSchema], required: true },
      subtotal: { type: Number, required: true, min: 0 },
      discountTotal: { type: Number, min: 0, default: 0 },
      shippingFee: { type: Number, min: 0, default: 0 },
      total: { type: Number, required: true, min: 0 },
      shippingAddress: { type: Schema.Types.Mixed, required: true },
      status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipping', 'delivered', 'cancelled', 'returned'],
        default: 'pending',
        index: true,
      },
      paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded', 'failed'], default: 'unpaid' },
      paymentMethod: { type: String, enum: ['cod', 'card', 'bank_transfer'], default: 'cod' },
      cancelledAt: { type: Date, default: null },
      deliveredAt: { type: Date, default: null },
    },
    { timestamps: true }
  ),
  Payment: new Schema(
    {
      order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
      amount: { type: Number, required: true, min: 0 },
      method: { type: String, enum: ['cod', 'card', 'bank_transfer'], required: true },
      status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
      transactionId: { type: String, trim: true, default: '' },
      paidAt: { type: Date, default: null },
    },
    { timestamps: true }
  ),
  Review: new Schema(
    {
      product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
      rating: { type: Number, required: true, min: 1, max: 5 },
      title: { type: String, trim: true, default: '' },
      content: { type: String, trim: true, default: '' },
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
      moderatedAt: { type: Date, default: null },
    },
    { timestamps: true }
  ),
  Promotion: new Schema(
    {
      code: { type: String, required: true, unique: true, uppercase: true, trim: true },
      name: { type: String, required: true, trim: true },
      type: { type: String, enum: ['percentage', 'fixed'], required: true },
      value: { type: Number, required: true, min: 0 },
      minOrderValue: { type: Number, min: 0, default: 0 },
      startsAt: { type: Date, required: true },
      endsAt: { type: Date, required: true },
      usageLimit: { type: Number, min: 0, default: null },
      usedCount: { type: Number, min: 0, default: 0 },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
  ),
  ReturnRequest: new Schema(
    {
      order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      reason: { type: String, required: true, trim: true },
      status: { type: String, enum: ['requested', 'approved', 'rejected', 'refunded'], default: 'requested', index: true },
      refundAmount: { type: Number, min: 0, default: 0 },
      processedAt: { type: Date, default: null },
    },
    { timestamps: true }
  ),
};

schemas.Favorite.index({ user: 1, product: 1 }, { unique: true });
schemas.Review.index({ user: 1, product: 1, order: 1 }, { unique: true });
schemas.Product.index({ name: 'text', description: 'text', tags: 'text' });
schemas.Order.index({ user: 1, createdAt: -1 });

const models = Object.fromEntries(
  Object.entries(schemas).map(([name, schema]) => [name, mongoose.model(name, schema)])
);

const ids = {
  admin: new mongoose.Types.ObjectId('670000000000000000000001'),
  customer: new mongoose.Types.ObjectId('670000000000000000000002'),
  brandCoach: new mongoose.Types.ObjectId('670000000000000000000101'),
  brandFurla: new mongoose.Types.ObjectId('670000000000000000000102'),
  categoryShoulder: new mongoose.Types.ObjectId('670000000000000000000201'),
  categoryTote: new mongoose.Types.ObjectId('670000000000000000000202'),
  productTabby: new mongoose.Types.ObjectId('670000000000000000000301'),
  productFurla: new mongoose.Types.ObjectId('670000000000000000000302'),
  address: new mongoose.Types.ObjectId('670000000000000000000401'),
  order: new mongoose.Types.ObjectId('670000000000000000000501'),
  review: new mongoose.Types.ObjectId('670000000000000000000601'),
  promotion: new mongoose.Types.ObjectId('670000000000000000000701'),
};

async function upsert(model, documents) {
  await model.bulkWrite(
    documents.map((document) => {
      const { _id, ...fields } = document;
      return {
        updateOne: {
          filter: { _id },
          update: { $set: fields, $setOnInsert: { _id } },
          upsert: true,
        },
      };
    })
  );
}

async function seed() {
  await mongoose.connect(mongoUri);
  const passwordHash = await bcrypt.hash('Admin@123', 12);
  const customerPasswordHash = await bcrypt.hash('Customer@123', 12);
  const now = new Date();

  await upsert(models.User, [
    {
      _id: ids.admin,
      name: 'LuxeBag Admin',
      email: 'admin@luxebag.com',
      passwordHash,
      role: 'admin',
      status: 'active',
      phone: '+84900000001',
    },
    {
      _id: ids.customer,
      name: 'Nguyen Minh Anh',
      email: 'customer@luxebag.com',
      passwordHash: customerPasswordHash,
      role: 'customer',
      status: 'active',
      phone: '+84900000002',
    },
  ]);

  await upsert(models.Brand, [
    { _id: ids.brandCoach, name: 'Coach', slug: 'coach', description: 'Modern American leather goods.' },
    { _id: ids.brandFurla, name: 'Furla', slug: 'furla', description: 'Italian bags with refined everyday design.' },
  ]);
  await upsert(models.Category, [
    { _id: ids.categoryShoulder, name: 'Shoulder Bags', slug: 'shoulder-bags' },
    { _id: ids.categoryTote, name: 'Tote Bags', slug: 'tote-bags' },
  ]);
  await upsert(models.Product, [
    {
      _id: ids.productTabby,
      name: 'Tabby Shoulder Bag 26',
      slug: 'coach-tabby-shoulder-bag-26',
      brand: ids.brandCoach,
      category: ids.categoryShoulder,
      description: 'A polished shoulder bag with a signature sculpted clasp.',
      gender: 'women',
      images: [{ url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3', alt: 'Coach Tabby bag', isPrimary: true }],
      price: 8900000,
      compareAtPrice: 10500000,
      discountPercent: 15,
      inventoryQuantity: 18,
      status: 'published',
      colors: ['Black', 'Ivory'],
      tags: ['signature', 'leather', 'shoulder'],
      publishedAt: now,
    },
    {
      _id: ids.productFurla,
      name: 'Furla 1927 Tote',
      slug: 'furla-1927-tote',
      brand: ids.brandFurla,
      category: ids.categoryTote,
      description: 'Structured tote for workdays and weekends.',
      gender: 'women',
      images: [{ url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62', alt: 'Furla tote bag', isPrimary: true }],
      price: 7200000,
      inventoryQuantity: 11,
      status: 'published',
      colors: ['Tan'],
      tags: ['tote', 'work', 'leather'],
      publishedAt: now,
    },
  ]);
  await upsert(models.Address, [
    {
      _id: ids.address,
      user: ids.customer,
      label: 'Nhà riêng',
      recipientName: 'Nguyen Minh Anh',
      phone: '+84900000002',
      line1: '12 Nguyen Hue',
      ward: 'Ben Nghe',
      district: 'District 1',
      city: 'Ho Chi Minh City',
      isDefault: true,
    },
  ]);
  await upsert(models.Favorite, [{ _id: new mongoose.Types.ObjectId('670000000000000000000801'), user: ids.customer, product: ids.productTabby }]);
  await upsert(models.Cart, [{ _id: new mongoose.Types.ObjectId('670000000000000000000802'), user: ids.customer, items: [{ product: ids.productFurla, quantity: 1, unitPrice: 7200000 }] }]);
  await upsert(models.Order, [
    {
      _id: ids.order,
      orderNumber: 'LB-20261024-0001',
      user: ids.customer,
      items: [{ product: ids.productTabby, name: 'Tabby Shoulder Bag 26', quantity: 1, unitPrice: 8900000, discountPercent: 15, lineTotal: 8900000 }],
      subtotal: 8900000,
      shippingFee: 0,
      total: 8900000,
      shippingAddress: { recipientName: 'Nguyen Minh Anh', phone: '+84900000002', line1: '12 Nguyen Hue', ward: 'Ben Nghe', district: 'District 1', city: 'Ho Chi Minh City' },
      status: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'card',
      deliveredAt: now,
    },
  ]);
  await upsert(models.Payment, [{ _id: new mongoose.Types.ObjectId('670000000000000000000901'), order: ids.order, amount: 8900000, method: 'card', status: 'paid', transactionId: 'SEED-TXN-0001', paidAt: now }]);
  await upsert(models.Review, [{ _id: ids.review, product: ids.productTabby, user: ids.customer, order: ids.order, rating: 5, title: 'Đẹp và chắc chắn', content: 'Sản phẩm đúng mô tả, đóng gói cẩn thận.', status: 'approved', moderatedAt: now }]);
  await upsert(models.Promotion, [{ _id: ids.promotion, code: 'WELCOME10', name: 'Welcome discount', type: 'percentage', value: 10, minOrderValue: 1000000, startsAt: now, endsAt: new Date('2027-12-31T23:59:59.000Z'), usageLimit: 1000, isActive: true }]);
  await upsert(models.ReturnRequest, [{ _id: new mongoose.Types.ObjectId('670000000000000000001001'), order: ids.order, user: ids.customer, reason: 'Đổi sang màu khác', status: 'requested', refundAmount: 8900000 }]);

  console.log('MongoDB seed completed.');
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
