const mongoose = require('mongoose');

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
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
  history: [{ status: { type: String, required: true }, at: { type: Date, default: Date.now } }],
  cancelledAt: { type: Date, default: null },
  returnRequest: {
    status: { type: String, enum: ['requested', 'approved', 'rejected'] },
    reason: String,
    note: { type: String, maxlength: 300 },
    requestedAt: Date,
  },
}, { timestamps: true });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
