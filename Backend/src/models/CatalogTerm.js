const mongoose = require('mongoose');

const catalogTermSchema = new mongoose.Schema({
  type: { type: String, enum: ['brand', 'category'], required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  slug: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

catalogTermSchema.index({ type: 1, slug: 1 }, { unique: true });

module.exports = mongoose.models.CatalogTerm
  || mongoose.model('CatalogTerm', catalogTermSchema);
