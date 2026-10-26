const Coupon = require('../models/Coupon');

const normalizeCode = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '');
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const serializeCoupon = (coupon) => {
  const raw = coupon.toObject ? coupon.toObject() : coupon;
  return {
    id: String(raw._id || raw.id),
    code: raw.code,
    type: raw.type,
    value: Number(raw.value),
    minSubtotal: Number(raw.minSubtotal || 0),
    expiresAt: raw.expiresAt ? new Date(raw.expiresAt).toISOString() : null,
    active: raw.active !== false,
    usageLimit: raw.usageLimit == null ? null : Number(raw.usageLimit),
    usedCount: Number(raw.usedCount || 0),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

const validateCouponBody = (body = {}) => {
  const errors = [];
  const code = normalizeCode(body.code);
  const type = body.type;
  const value = Number(body.value);
  const minSubtotal = Number(body.minSubtotal ?? 0);
  const usageLimit = body.usageLimit == null || body.usageLimit === '' ? null : Number(body.usageLimit);
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) errors.push('code must contain 3-20 letters, numbers, underscores, or hyphens.');
  if (!['percent', 'fixed'].includes(type)) errors.push('type must be percent or fixed.');
  if (!Number.isFinite(value) || value <= 0 || (type === 'percent' && value > 100)) errors.push('value is invalid.');
  if (!Number.isFinite(minSubtotal) || minSubtotal < 0) errors.push('minSubtotal must be zero or greater.');
  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) errors.push('usageLimit must be a positive integer or null.');
  if (expiresAt && Number.isNaN(expiresAt.getTime())) errors.push('expiresAt must be a valid date or null.');
  if (body.active !== undefined && typeof body.active !== 'boolean') errors.push('active must be a boolean.');

  return {
    errors,
    data: {
      code, type, value: round2(value), minSubtotal: round2(minSubtotal),
      usageLimit, expiresAt, active: body.active !== false,
    },
  };
};

const listPublicCoupons = async (_req, res) => {
  const now = new Date();
  const coupons = await Coupon.find({
    active: true,
    $and: [
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
    ],
  }).sort({ createdAt: -1 });
  return res.json({ coupons: coupons.map(serializeCoupon) });
};

const listAdminCoupons = async (_req, res) => {
  const coupons = await Coupon.find({}).sort({ createdAt: -1 });
  return res.json({ coupons: coupons.map(serializeCoupon) });
};

const createCoupon = async (req, res) => {
  const { errors, data } = validateCouponBody(req.body);
  if (errors.length) return res.status(400).json({ error: 'Invalid coupon.', details: errors });
  const id = String(req.body?.id || '').trim();
  if (!/^cp-[a-z0-9]+$/i.test(id)) return res.status(400).json({ error: 'A valid coupon id is required.' });
  try {
    const coupon = await Coupon.create({ _id: id, ...data, usedCount: 0 });
    return res.status(201).json({ coupon: serializeCoupon(coupon) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'A coupon with this code or id already exists.', code: 'duplicate_coupon' });
    throw error;
  }
};

const updateCoupon = async (req, res) => {
  const existing = await Coupon.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Coupon not found.', code: 'not_found' });
  const merged = { ...serializeCoupon(existing), ...(req.body || {}) };
  const { errors, data } = validateCouponBody(merged);
  if (errors.length) return res.status(400).json({ error: 'Invalid coupon.', details: errors });
  try {
    existing.code = data.code;
    existing.type = data.type;
    existing.value = data.value;
    existing.minSubtotal = data.minSubtotal;
    existing.usageLimit = data.usageLimit;
    existing.expiresAt = data.expiresAt;
    existing.active = data.active;
    // Do not allow clients to overwrite usedCount; it is maintained by order creation.
    await existing.save();
    return res.json({ coupon: serializeCoupon(existing) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'A coupon with this code already exists.', code: 'duplicate_coupon' });
    throw error;
  }
};

const deleteCoupon = async (req, res) => {
  const deleted = await Coupon.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Coupon not found.', code: 'not_found' });
  return res.json({ success: true, id: String(deleted._id) });
};

module.exports = {
  createCoupon,
  deleteCoupon,
  listAdminCoupons,
  listPublicCoupons,
  updateCoupon,
  normalizeCode,
  round2,
  serializeCoupon,
};
