const Promotion = require('../models/Promotion');
const CatalogTerm = require('../models/CatalogTerm');

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const matchesTarget = (offer, product) =>
  offer.scope === 'all'
  || (offer.scope === 'category' && matchesValue(offer, product.category))
  || (offer.scope === 'brand' && matchesValue(offer, product.brand));

const normalizeValue = (value) => String(value || '').trim().toLowerCase();
const matchesValue = (offer, value) => {
  const target = normalizeValue(offer.targetValue);
  return target && [offer.targetValue, ...(offer.targetAliases || [])]
    .some((candidate) => normalizeValue(candidate) === normalizeValue(value));
};

async function getActivePromotions() {
  const now = new Date();
  const [promotions, terms] = await Promise.all([
    Promotion.find({
    active: true,
    percentOff: { $gt: 0, $lte: 0.9 },
    createdAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).sort({ createdAt: -1 }).lean(),
    CatalogTerm.find({}).select('_id type name slug').lean(),
  ]);
  const aliasesByType = new Map(['category', 'brand'].map((type) => [
    type,
    terms.filter((term) => term.type === type).flatMap((term) => [
      { key: normalizeValue(term._id), value: term.name },
      { key: normalizeValue(term.name), value: String(term._id) },
      { key: normalizeValue(term.slug), value: String(term._id) },
    ]),
  ]));
  return promotions.map((promotion) => ({
    ...promotion,
    targetAliases: (aliasesByType.get(promotion.scope) || [])
      .filter((entry) => entry.key === normalizeValue(promotion.targetValue))
      .map((entry) => entry.value),
  }));
}

function selectPromotion(promotions, product) {
  return promotions
    .filter((promotion) => Number.isFinite(Number(promotion.percentOff)) && matchesTarget(promotion, product))
    .map((promotion) => ({
      promotion,
      discount: round2(Number(product.cost) * Number(promotion.percentOff)),
    }))
    .sort((a, b) => b.discount - a.discount || b.promotion.createdAt - a.promotion.createdAt)[0] || null;
}

function discountedProduct(product, selection) {
  const raw = product.toObject ? product.toObject() : { ...product };
  if (!selection) {
    delete raw.originalCost;
    raw.percentOff = 0;
    raw.discountMode = 'real';
    delete raw.promotion;
    return raw;
  }
  const discount = selection.discount;
  return {
    ...raw,
    originalCost: round2(Number(product.cost)),
    cost: round2(Math.max(0, Number(product.cost) - discount)),
    percentOff: Number(selection.promotion.percentOff),
    discountMode: 'real',
    promotion: {
      id: String(selection.promotion._id),
      name: selection.promotion.name,
      percentOff: Number(selection.promotion.percentOff),
      discount,
    },
  };
}

module.exports = {
  discountedProduct,
  getActivePromotions,
  round2,
  selectPromotion,
};
