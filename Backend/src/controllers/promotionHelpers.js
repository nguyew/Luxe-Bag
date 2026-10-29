const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const serializePromotion = (promotion) => {
  const raw = promotion.toObject ? promotion.toObject() : promotion;
  return {
    id: String(raw._id || raw.id),
    name: raw.name,
    percentOff: Number(raw.percentOff),
    scope: raw.scope,
    targetValue: raw.targetValue || '',
    expiresAt: raw.expiresAt ? new Date(raw.expiresAt).toISOString() : null,
    active: raw.active !== false,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

const validatePromotionBody = (body = {}) => {
  const errors = [];
  const name = String(body.name || '').trim();
  const percentOff = Number(body.percentOff);
  const scope = body.scope || 'all';
  const targetValue = String(body.targetValue || '').trim();
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (name.length < 2 || name.length > 120) errors.push('name must contain 2-120 characters.');
  if (!Number.isFinite(percentOff) || percentOff <= 0 || percentOff > 0.9) errors.push('percentOff must be greater than 0 and at most 0.9.');
  if (!['all', 'category', 'brand'].includes(scope)) errors.push('scope must be all, category, or brand.');
  if (scope !== 'all' && !targetValue) errors.push('targetValue is required for category and brand promotions.');
  if (expiresAt && Number.isNaN(expiresAt.getTime())) errors.push('expiresAt must be a valid date or null.');
  if (body.active !== undefined && typeof body.active !== 'boolean') errors.push('active must be a boolean.');
  return {
    errors,
    data: {
      name, percentOff: round2(percentOff), scope, targetValue, expiresAt,
      active: body.active !== false,
    },
  };
};

module.exports = { serializePromotion, validatePromotionBody };
