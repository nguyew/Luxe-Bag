const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  // Keep the frontend's existing cp-* IDs so edit/delete screens remain compatible.
  _id: { type: String, required: true },
  code: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true, maxlength: 20 },
  type: { type: String, enum: ['percent', 'fixed'], required: true },
  value: { type: Number, required: true, min: 0.01 },
  minSubtotal: { type: Number, default: 0, min: 0 },
  expiresAt: { type: Date, default: null },
  active: { type: Boolean, default: true, index: true },
  usageLimit: { type: Number, default: null, min: 1 },
  usedCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true, versionKey: false });

couponSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
