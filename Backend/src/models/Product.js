const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    handbagName: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
    slug: { type: String, required: true, unique: true, trim: true },
    brand: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, trim: true, maxlength: 100, default: '' },
    // Whole VND (no decimals).
    cost: { type: Number, required: true, min: 0, validate: Number.isInteger },
    originalCost: { type: Number, min: 0, validate: Number.isInteger },
    percentOff: { type: Number, min: 0, max: 0.9, default: 0 },
    discountMode: { type: String, enum: ['real', 'fake'], default: 'real' },
    color: { type: [String], default: [] },
    gender: { type: Boolean, default: true },
    stock: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    images: {
      type: [{
        id: { type: String, required: true },
        url: { type: String, required: true, trim: true },
        key: { type: String, required: true, trim: true },
        alt: { type: String, trim: true, maxlength: 160, default: '' },
        sortOrder: { type: Number, min: 0, default: 0 },
        isPrimary: { type: Boolean, default: false },
      }],
      default: [],
    },
    uri: { type: String, trim: true, default: '' },
    imageKey: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
