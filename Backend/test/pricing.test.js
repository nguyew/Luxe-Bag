const test = require('node:test');
const assert = require('node:assert/strict');
const { selectPromotion } = require('../src/services/pricingService');

const promotion = (id, percentOff, createdAt, scope = 'all', targetValue = '') => ({
  _id: id,
  percentOff,
  createdAt: new Date(createdAt),
  scope,
  targetValue,
});

test('selects the largest matching promotion and breaks equal discounts by newest creation', () => {
  const product = { cost: 100, brand: 'A', category: 'bags' };
  const selected = selectPromotion([
    promotion('older', 0.2, '2026-01-01'),
    promotion('newer', 0.2, '2026-02-01'),
    promotion('larger', 0.25, '2025-01-01'),
  ], product);

  assert.equal(selected.promotion._id, 'larger');
  assert.equal(selected.discount, 25);
});

test('ignores promotions outside their target', () => {
  const selected = selectPromotion([
    promotion('brand', 0.5, '2026-01-01', 'brand', 'Other'),
    promotion('category', 0.1, '2026-01-02', 'category', 'bags'),
  ], { cost: 200, brand: 'A', category: 'bags' });

  assert.equal(selected.promotion._id, 'category');
  assert.equal(selected.discount, 20);
});

test('matches a category promotion through a catalog alias', () => {
  const selected = selectPromotion([
    { ...promotion('category', 0.5, '2026-01-01', 'category', 'Tote Bag'), targetAliases: ['category-id'] },
    { ...promotion('brand', 0.2, '2026-02-01', 'brand', 'bag1'), targetAliases: [] },
  ], { cost: 100, brand: 'bag1', category: 'category-id', });

  assert.equal(selected.promotion._id, 'category');
  assert.equal(selected.discount, 50);
});

test('category aliases remain usable when a catalog term is inactive', () => {
  const selected = selectPromotion([
    { ...promotion('category', 0.5, '2026-01-01', 'category', 'Tote Bag'), targetAliases: ['670000000000000000000202'] },
  ], { cost: 9999, brand: 'bag1', category: '670000000000000000000202' });

  assert.equal(selected.promotion._id, 'category');
});
