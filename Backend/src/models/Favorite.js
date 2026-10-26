const mongoose = require('mongoose');

const favoriteItemSchema = new mongoose.Schema({
  productId: { type: String, required: true, trim: true },
  productSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const favoriteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  items: { type: [favoriteItemSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.models.Favorite || mongoose.model('Favorite', favoriteSchema);
