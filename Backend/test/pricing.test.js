const test = require('node:test');
const assert = require('node:assert/strict');
const { calcShipping, selectPromotion } = require('../src/services/pricingService');
const { isWholeMoney, legacyPriceToVnd, roundMoney } = require('../src/utils/money');

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

test('free shipping is decided on the amount after the coupon discount (VND)', () => {
  assert.equal(calcShipping(3000000), 0);
  assert.equal(calcShipping(2999999), 30000);
  // subtotal 3,200,000 with a 10% coupon -> 2,880,000 after discount -> shipping applies
  assert.equal(calcShipping(3200000 - 320000), 30000);
  assert.equal(calcShipping(0), 0);
});

test('promotion discounts are whole dong', () => {
  const selected = selectPromotion([promotion('p', 0.15, '2026-01-01')], { cost: 1234567 });
  assert.equal(Number.isInteger(selected.discount), true);
  assert.equal(selected.discount, 185185);
});

test('money helpers keep amounts as whole dong', () => {
  assert.equal(roundMoney(1234.5), 1235);
  assert.equal(roundMoney('1000000'), 1000000);
  assert.equal(isWholeMoney(2500000), true);
  assert.equal(isWholeMoney(2.5), false);
  assert.equal(isWholeMoney(-1), false);
});

test('legacy prices are converted to VND (millions, USD, or already VND)', () => {
  assert.equal(legacyPriceToVnd(2.5), 2500000);
  assert.equal(legacyPriceToVnd(45), 1130000);
  assert.equal(legacyPriceToVnd(340), 8500000);
  assert.equal(legacyPriceToVnd(8900000), 8900000);
});
