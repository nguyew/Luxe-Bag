const Cart = require('../models/Cart');

const MAX_PER_LINE = 10;

function sanitizeItems(raw) {
  if (!Array.isArray(raw)) return { error: 'Items must be an array.' };
  const quantities = new Map();

  for (const entry of raw) {
    const productId = entry?.productId ?? entry?.id;
    const id = productId === undefined || productId === null ? '' : String(productId).trim();
    const qty = Number(entry?.qty);
    if (!id || id.length > 100) return { error: 'Each item must have a valid productId.' };
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_PER_LINE) {
      return { error: `Each item quantity must be an integer between 1 and ${MAX_PER_LINE}.` };
    }
    if (quantities.has(id)) {
      const combined = quantities.get(id) + qty;
      if (combined > MAX_PER_LINE) return { error: `The quantity for product ${id} cannot exceed ${MAX_PER_LINE}.` };
      quantities.set(id, combined);
    } else {
      quantities.set(id, qty);
    }
  }

  return { items: [...quantities.entries()].map(([productId, qty]) => ({ productId, qty })) };
}

const toClientItems = (items = []) => items.map((item) => ({
  id: String(item.productId),
  qty: Number(item.qty),
}));

const getCart = async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user._id }).lean();
  return res.json({ items: toClientItems(cart?.items || []) });
};

const replaceCart = async (req, res) => {
  const parsed = sanitizeItems(req.body?.items);
  if (parsed.error) return res.status(400).json({ error: parsed.error, code: 'invalid_cart' });

  const cart = await Cart.findOneAndUpdate(
    { userId: req.user._id },
    { $set: { items: parsed.items } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

  return res.json({ items: toClientItems(cart.items), updatedAt: cart.updatedAt });
};

module.exports = { getCart, replaceCart };
