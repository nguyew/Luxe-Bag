const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: { type: String, required: true, trim: true },
  qty: { type: Number, required: true, min: 1, max: 10, validate: Number.isInteger },
}, { _id: false });

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  items: { type: [cartItemSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.models.Cart || mongoose.model('Cart', cartSchema);
