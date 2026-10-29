const Promotion = require('../models/Promotion');
const { serializePromotion, validatePromotionBody } = require('./promotionHelpers');

const listPromotions = async (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const now = new Date();
  const filter = _req.user?.role === 'admin'
    ? {}
    : {
      active: true,
      createdAt: { $lte: now },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    };
  const promotions = await Promotion.find(filter).sort({ createdAt: -1 });
  return res.json({ promotions: promotions.map(serializePromotion) });
};

const createPromotion = async (req, res) => {
  const { errors, data } = validatePromotionBody(req.body);
  if (errors.length) return res.status(400).json({ error: 'Invalid promotion.', details: errors });
  const id = String(req.body?.id || '').trim();
  if (!/^pr-[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(id)) return res.status(400).json({ error: 'A valid promotion id is required.' });
  try {
    const promotion = await Promotion.findOneAndUpdate(
      { _id: id },
      { $setOnInsert: { _id: id, ...data } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.status(201).json({ promotion: serializePromotion(promotion) });
  } catch (error) {
    if (error?.code === 11000) {
      const key = Object.keys(error.keyPattern || error.keyValue || {})[0] || 'unknown';
      return res.status(409).json({
        error: key === '_id' ? 'A promotion with this id already exists.' : 'A promotion conflicts with an existing unique value.',
        code: 'duplicate_promotion',
        details: { field: key },
      });
    }
    throw error;
  }
};

const updatePromotion = async (req, res) => {
  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) return res.status(404).json({ error: 'Promotion not found.', code: 'not_found' });
  const { errors, data } = validatePromotionBody({ ...serializePromotion(promotion), ...(req.body || {}) });
  if (errors.length) return res.status(400).json({ error: 'Invalid promotion.', details: errors });
  Object.assign(promotion, data);
  await promotion.save();
  return res.json({ promotion: serializePromotion(promotion) });
};

const deletePromotion = async (req, res) => {
  const deleted = await Promotion.findOneAndDelete({ _id: decodeURIComponent(req.params.id) });
  if (!deleted) return res.status(404).json({ error: 'Promotion not found.', code: 'not_found' });
  return res.json({ success: true, id: String(deleted._id) });
};

module.exports = { createPromotion, deletePromotion, listPromotions, updatePromotion };
