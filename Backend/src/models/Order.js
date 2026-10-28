const mongoose = require('mongoose');
const { randomBytes } = require('crypto');

const createOrderNumber = () =>
  `LB-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  handbagId: { type: String, required: true },
  name: { type: String, required: true },
  brand: { type: String, default: '' },
  uri: { type: String, default: '' },
  unitPrice: { type: Number, required: true, min: 0 },
  qty: { type: Number, required: true, min: 1, max: 10 },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, default: createOrderNumber },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled', 'returned'], default: 'pending', index: true },
  items: { type: [orderItemSchema], required: true },
  subtotal: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  shipping: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  address: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    city: { type: String, required: true },
  },
  couponCode: { type: String, default: null },
  paymentMethod: { type: String, enum: ['cod', 'card'], required: true },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'requires_payment', 'processing', 'paid', 'failed', 'refunded'],
    default: 'unpaid',
    index: true,
  },
  paymentProvider: { type: String, enum: ['cod', 'stripe'], default: 'cod' },
  paymentIntentId: { type: String, default: null, index: true },
  paymentExpiresAt: { type: Date, default: null, index: true },
  paymentCompletedAt: { type: Date, default: null },
  paymentFailureMessage: { type: String, default: '', maxlength: 300 },
  refundId: { type: String, default: null, index: true },
  refundStatus: {
    type: String,
    enum: ['none', 'pending', 'succeeded', 'failed', 'canceled'],
    default: 'none',
  },
  refundedAt: { type: Date, default: null },
  inventoryReleased: { type: Boolean, default: false },
  history: [{ status: { type: String, required: true }, at: { type: Date, default: Date.now } }],
  cancelledAt: { type: Date, default: null },
  returnRequest: {
    status: { type: String, enum: ['requested', 'approved', 'rejected'] },
    reason: String,
    note: { type: String, maxlength: 300 },
    requestedAt: Date,
    resolvedAt: Date,
    adminNote: { type: String, maxlength: 300, default: '' },
    restocked: { type: Boolean, default: false },
  },
}, { timestamps: true });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
