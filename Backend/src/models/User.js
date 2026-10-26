const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer', index: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
    phone: { type: String, trim: true, default: '' },
    avatarUrl: { type: String, trim: true, default: '' },
    avatarKey: { type: String, trim: true, default: '' },
    addresses: {
      type: [{
        id: { type: String, required: true },
        label: { type: String, trim: true, default: 'Home' },
        fullName: { type: String, trim: true, required: true },
        phone: { type: String, trim: true, required: true },
        line1: { type: String, trim: true, required: true },
        city: { type: String, trim: true, required: true },
        isDefault: { type: Boolean, default: false },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
