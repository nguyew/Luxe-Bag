const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify } = require('../src/controllers/catalogController');
const { parsePeriod } = require('../src/controllers/reportController');
const { toMinorUnits } = require('../src/services/stripeService');
const { buildProductFilter, escapeRegex, productSort } = require('../src/utils/productQuery');
const { refundOrderPayment } = require('../src/services/orderPaymentService');
const { syncLegacyPrimary } = require('../src/utils/productImages');

test('toMinorUnits converts decimal and zero-decimal currencies', () => {
  assert.equal(toMinorUnits(10.25, 'usd'), 1025);
  assert.equal(toMinorUnits(1000, 'vnd'), 1000);
  assert.throws(() => toMinorUnits(0, 'usd'), /Invalid payment amount/);
});

test('slugify normalizes catalog names', () => {
  assert.equal(slugify('  Túi Đeo Chéo  '), 'tui-deo-cheo');
  assert.equal(slugify('Louis Vuitton'), 'louis-vuitton');
});

test('report period is bounded', () => {
  assert.equal(parsePeriod('all'), null);
  assert.equal(parsePeriod('0'), 1);
  assert.equal(parsePeriod('999'), 366);
  assert.equal(parsePeriod(undefined), 30);
});

test('product query escapes regex and builds public filters', () => {
  assert.equal(escapeRegex('a.b'), 'a\\.b');
  const { filter } = buildProductFilter({
    brand: 'Gucci',
    gender: 'women',
    minPrice: '10',
    maxPrice: '20',
    inStock: 'true',
  });
  assert.equal(filter.status, 'published');
  assert.equal(filter.brand, 'Gucci');
  assert.equal(filter.gender, true);
  assert.deepEqual(filter.cost, { $gte: 10, $lte: 20 });
  assert.deepEqual(filter.stock, { $gt: 0 });
  assert.deepEqual(productSort('price_desc'), { cost: -1, createdAt: -1, _id: -1 });
});

test('manual and legacy payments can be refunded without calling Stripe', async () => {
  const codOrder = { paymentMethod: 'cod', paymentStatus: 'paid' };
  const codRefund = await refundOrderPayment(codOrder);
  assert.equal(codRefund.manual, true);
  assert.equal(codOrder.paymentStatus, 'refunded');

  const legacyCardOrder = { paymentMethod: 'card', paymentStatus: 'paid', paymentIntentId: null };
  const legacyRefund = await refundOrderPayment(legacyCardOrder);
  assert.equal(legacyRefund.legacy, true);
  assert.equal(legacyCardOrder.refundStatus, 'succeeded');
});

test('syncLegacyPrimary selects one primary image and mirrors legacy fields', () => {
  const product = {
    images: [
      { id: 'second', url: 'https://example.com/2.jpg', key: 'products/2.jpg', sortOrder: 2, isPrimary: false },
      { id: 'first', url: 'https://example.com/1.jpg', key: 'products/1.jpg', sortOrder: 1, isPrimary: false },
    ],
  };
  syncLegacyPrimary(product);
  assert.equal(product.uri, 'https://example.com/1.jpg');
  assert.equal(product.imageKey, 'products/1.jpg');
  assert.equal(product.images.filter((image) => image.isPrimary).length, 1);
});

test('every product sort ends with _id so pagination is stable', () => {
  for (const key of ['newest', 'price_asc', 'price_desc', 'name_asc', 'unknown']) {
    const keys = Object.keys(productSort(key));
    assert.equal(keys[keys.length - 1], '_id', `${key} must end with _id`);
  }
});
