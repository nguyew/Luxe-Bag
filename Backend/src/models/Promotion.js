const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  percentOff: { type: Number, required: true, min: 0.01, max: 0.9 },
  scope: { type: String, enum: ['all', 'category', 'brand'], required: true },
  targetValue: { type: String, trim: true, default: '' },
  expiresAt: { type: Date, default: null },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true, versionKey: false });

promotionSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.models.Promotion || mongoose.model('Promotion', promotionSchema);
