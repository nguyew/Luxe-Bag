const Favorite = require('../models/Favorite');

const MAX_FAVORITES = 500;

function sanitizeFavorites(raw) {
  if (!Array.isArray(raw)) return { error: 'Favorites must be an array.' };
  if (raw.length > MAX_FAVORITES) {
    return { error: `You can save up to ${MAX_FAVORITES} favorite products.` };
  }

  const seen = new Set();
  const items = [];
  for (const item of raw) {
    const rawId = item?.id ?? item?._id ?? item?.productId;
    const productId = rawId === undefined || rawId === null ? '' : String(rawId).trim();
    if (!productId || productId.length > 100) {
      return { error: 'Each favorite must have a valid product id.' };
    }
    if (seen.has(productId)) continue;
    seen.add(productId);
    // Keep a display snapshot so Favorites can render without an extra lookup.
    // Product id is stored separately and cannot be overridden by snapshot data.
    const productSnapshot = item && typeof item === 'object' && !Array.isArray(item)
      ? { ...item, id: productId }
      : { id: productId };
    items.push({ productId, productSnapshot });
  }
  return { items };
}

function toClientFavorites(items = []) {
  return items.map((item) => ({
    ...(item.productSnapshot && typeof item.productSnapshot === 'object' ? item.productSnapshot : {}),
    id: String(item.productId),
  }));
}

const getFavorites = async (req, res) => {
  const doc = await Favorite.findOne({ userId: req.user._id }).lean();
  return res.json({ favorites: toClientFavorites(doc?.items || []), hasRecord: Boolean(doc) });
};

const replaceFavorites = async (req, res) => {
  const parsed = sanitizeFavorites(req.body?.favorites);
  if (parsed.error) return res.status(400).json({ error: parsed.error, code: 'invalid_favorites' });

  const doc = await Favorite.findOneAndUpdate(
    { userId: req.user._id },
    { $set: { items: parsed.items } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return res.json({ favorites: toClientFavorites(doc.items), updatedAt: doc.updatedAt });
};

module.exports = { getFavorites, replaceFavorites };
