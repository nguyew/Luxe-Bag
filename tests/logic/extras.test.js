process.env.EXPO_PUBLIC_API_URL = 'https://fake.mockapi.io';
const assert = require('assert');
let users = []; let bags = []; let nid = 100;
global.fetch = async (url, opts = {}) => {
  const u = new URL(url); const method = opts.method || 'GET';
  const parts = u.pathname.split('/').filter(Boolean);
  const res = (status, body) => ({ ok: status < 400, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) });
  const table = parts[0] === 'users' ? users : parts[0] === 'handbags' ? bags : null;
  if (!table) return res(404);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  if (method === 'GET' && parts.length === 1) {
    let list = table; const email = u.searchParams.get('email');
    if (email) list = table.filter((x) => (x.email || '').toLowerCase().includes(email.toLowerCase()));
    return list.length ? res(200, clone(list)) : res(404);
  }
  if (method === 'POST') { const r = { ...JSON.parse(opts.body), id: String(nid++) }; table.push(r); return res(201, clone(r)); }
  const i = table.findIndex((x) => x.id === parts[1]);
  if (method === 'GET') return i >= 0 ? res(200, clone(table[i])) : res(404);
  if (method === 'PUT') { if (i < 0) return res(404); Object.assign(table[i], JSON.parse(opts.body)); return res(200, clone(table[i])); }
  if (method === 'DELETE') { if (i < 0) return res(404); const [r] = table.splice(i, 1); return res(200, clone(r)); }
};
const M = require('../.out/extras.js');
const DAY = 86400000;

(async () => {
  // ---------- feedback ----------
  const raw = [
    { id: 'a', rating: 5, author: 'X', date: '2026-01-01T00:00:00Z' },
    { rating: 4, author: 'Y', hidden: true, userId: 7 },
    { id: 'c', rating: 9 },
  ];
  assert.deepEqual(M.normalizeFeedbacks(raw).map((f) => f.id), ['a']);
  const all = M.normalizeFeedbacks(raw, { includeHidden: true });
  assert.deepEqual(all.map((f) => f.id).sort(), ['a', 'feedback-1']);
  assert.equal(all.find((f) => f.id === 'feedback-1').userId, '7'); assert.equal(M.feedbackId(raw[1], 1), 'feedback-1');

  // ---------- orders utils ----------
  assert.deepEqual(M.calcTotals([{ unitPrice: 300, qty: 1 }], 100), { subtotal: 300, discount: 100, shipping: 15, total: 215 });
  assert.deepEqual(M.calcTotals([{ unitPrice: 600, qty: 1 }], 50), { subtotal: 600, discount: 50, shipping: 0, total: 550 });
  assert.equal(M.calcTotals([{ unitPrice: 600, qty: 1 }], 99999).discount, 600);   // không giảm quá tiền hàng
  const delivered = (ago) => ({ status: 'delivered', createdAt: new Date(Date.now() - 30 * DAY).toISOString(), history: [{ status: 'delivered', at: new Date(Date.now() - ago * DAY).toISOString() }] });
  assert.equal(M.canRequestReturn(delivered(2)), true); assert.equal(M.canRequestReturn(delivered(8)), false);
  assert.equal(M.canRequestReturn({ ...delivered(1), returnRequest: { status: 'requested' } }), false);
  assert.equal(M.canRequestReturn({ status: 'shipping' }), false);

  // ---------- coupons ----------
  const cps = M.sanitizeCoupons([
    { id: 'c1', code: ' save 10 ', type: 'percent', value: 10, minSubtotal: 100, active: true },
    { id: 'c2', code: 'FLAT20', type: 'fixed', value: 20 },
    { id: 'c3', code: 'OLD', type: 'percent', value: 50, expiresAt: '2020-01-01T00:00:00Z' },
    { id: 'c4', code: 'OFF', type: 'percent', value: 5, active: false },
    { id: 'c5', code: 'ONCE', type: 'fixed', value: 5, usageLimit: 1, usedCount: 1 },
    { code: 'save10', type: 'percent', value: 99 }, { code: 'BAD', type: 'percent', value: 150 }, { code: 'ZERO', value: 0 }, null,
  ]);
  assert.deepEqual(cps.map((c) => c.code), ['SAVE10', 'FLAT20', 'OLD', 'OFF', 'ONCE']);
  assert.equal(M.validateCoupon(cps, 'save10', 200).discount, 20);
  assert.equal(M.validateCoupon(cps, 'save10', 50).reason, 'min_subtotal');
  assert.equal(M.validateCoupon(cps, 'flat20', 15).discount, 15);       // cố định không vượt tiền hàng
  assert.equal(M.validateCoupon(cps, 'OLD', 500).reason, 'expired');
  assert.equal(M.validateCoupon(cps, 'OFF', 500).reason, 'inactive');
  assert.equal(M.validateCoupon(cps, 'ONCE', 500).reason, 'used_up');
  assert.equal(M.validateCoupon(cps, 'nope', 500).reason, 'not_found');
  assert.equal(M.validateCoupon(cps, '  ', 500).reason, 'empty');
  assert.equal(M.describeCoupon(cps[0]), '10% off over $100');

  // ---------- filters ----------
  const items = [
    { id: '1', handbagName: 'Zed', brand: 'A', category: 'Tote', cost: 100, gender: true, percentOff: 0.1, stock: 5 },
    { id: '2', handbagName: 'Amy', brand: 'B', category: 'Tote', cost: 300, gender: false, percentOff: 0.5, stock: 0 },
    { id: '3', handbagName: 'Bob', brand: 'A', category: 'Wallet', cost: 50, percentOff: 0.3 },
  ];
  const ids = (list) => list.map((i) => i.id).join('');
  assert.equal(ids(M.applyFilters(items)), '213');                                    // mặc định: giá giảm dần
  assert.equal(ids(M.applyFilters(items, { sort: 'price_asc' })), '312');
  assert.equal(ids(M.applyFilters(items, { sort: 'discount' })), '231');
  assert.equal(ids(M.applyFilters(items, { sort: 'name' })), '231');
  assert.equal(ids(M.applyFilters(items, { sort: 'newest' })), '321');
  assert.equal(ids(M.applyFilters(items, { categories: ['Tote'] })), '21');
  assert.equal(ids(M.applyFilters(items, { brands: ['A'], categories: ['Tote', 'Wallet'] })), '13');
  assert.equal(ids(M.applyFilters(items, { gender: 'women' })), '1'); assert.equal(ids(M.applyFilters(items, { gender: 'men' })), '2');
  assert.equal(ids(M.applyFilters(items, { minPrice: '60', maxPrice: '200' })), '1');
  assert.equal(ids(M.applyFilters(items, { minPrice: 'abc' })), '213');
  assert.equal(ids(M.applyFilters(items, { inStockOnly: true })), '13');
  assert.equal(M.countActiveFilters({ categories: ['x'], gender: 'men', minPrice: '1', maxPrice: '9', sort: 'name' }), 3);
  assert.deepEqual(M.facetOptions(items, 'brand'), [{ value: 'A', count: 2 }, { value: 'B', count: 1 }]);

  // ---------- báo cáo ----------
  const now = new Date(2026, 9, 24, 12).getTime();           // 24/10/2026
  const at = (d) => new Date(now - d * DAY).toISOString();
  const it = (id, brand, price, qty) => ({ handbagId: id, name: 'P' + id, brand, unitPrice: price, qty });
  const ords = [
    { id: '1', status: 'delivered', total: 100, createdAt: at(0), items: [it('1', 'A', 100, 1)] },
    { id: '2', status: 'pending', total: 200, createdAt: at(2), items: [it('2', 'B', 100, 2)] },
    { id: '3', status: 'cancelled', total: 999, createdAt: at(1), items: [it('1', 'A', 999, 1)] },
    { id: '4', status: 'returned', total: 50, createdAt: at(3), items: [it('3', 'A', 50, 1)] },
    { id: '5', status: 'delivered', total: 300, createdAt: at(20), items: [it('1', 'A', 100, 3)] },
    { id: '6', status: 'delivered', total: 70, createdAt: at(200), items: [it('4', 'C', 70, 1)] },
  ];
  const r7 = M.buildReport(ords, { days: 7, now });
  assert.equal(r7.revenue, 300); assert.equal(r7.orderCount, 2); assert.equal(r7.avgOrder, 150);
  assert.equal(r7.refunded, 50); assert.equal(r7.cancelled, 1); assert.equal(r7.returned, 1);
  assert.equal(r7.series.length, 7); assert.equal(r7.series[6].value, 100); assert.equal(r7.series[4].value, 200);
  assert.equal(r7.series.reduce((s, x) => s + x.value, 0), 300);
  assert.equal(r7.topProducts[0].handbagId, '2'); assert.equal(r7.byBrand[0].brand, 'B');
  const r30 = M.buildReport(ords, { days: 30, now });
  assert.equal(r30.revenue, 600); assert.equal(r30.series.length, 10); assert.equal(r30.series.reduce((s, x) => s + x.value, 0), 600);
  assert.equal(r30.topProducts.find((p) => p.handbagId === '1').qty, 4);
  const r90 = M.buildReport(ords, { days: 90, now }); assert.equal(r90.series.length, 9); assert.equal(r90.revenue, 600);
  const rAll = M.buildReport(ords, { days: null, now });
  assert.equal(rAll.revenue, 670); assert.ok(rAll.series.length >= 2 && rAll.series.length <= 12);
  assert.equal(rAll.series.reduce((s, x) => s + x.value, 0), 670);
  assert.equal(M.buildReport([], { days: 7, now }).avgOrder, 0);
  assert.deepEqual(M.salesSummary(ords).returns, 0);
  assert.equal(M.returnRequestCount([{ returnRequest: { status: 'requested' } }, { returnRequest: { status: 'approved' } }, {}]), 1);

  // ---------- dữ liệu + dịch vụ ----------
  bags = [
    { id: '1', handbagName: 'Red bag', brand: 'Bvlgari', category: 'Tote', cost: 400, stock: 10, feedbacks: [
      { id: '1-1', author: 'Seed', rating: 5, comment: 'ok', date: '2026-01-01T00:00:00Z' }, { author: 'NoId', rating: 3, comment: 'meh' } ] },
    { id: '2', handbagName: 'Blue bag', brand: 'Bvlgari', category: 'Wallet', cost: 80, stock: 3 },
  ];
  const cust = await M.registerUser({ name: 'Mai', email: 'mai@x.co', password: 'secret1' });
  const other = await M.registerUser({ name: 'Bao', email: 'bao@x.co', password: 'secret1' });
  const addr = { id: 'a', fullName: 'Mai', phone: '0901234567', line1: '1 St', city: 'HCMC' };

  // mã giảm giá: tạo -> dùng
  assert.deepEqual(await M.fetchPromotions(), []);
  await M.updateCoupons(() => [{ id: 'c1', code: 'SAVE10', type: 'percent', value: 10, minSubtotal: 100 },
    { id: 'c2', code: 'ONCE', type: 'fixed', value: 5, usageLimit: 1 }]);
  const sys = users.find((u) => u.email === M.SYSTEM_EMAIL);
  assert.equal(sys.role, 'system'); assert.equal(M.toPublicUser(sys).role, 'system');
  await assert.rejects(M.loginUser(M.SYSTEM_EMAIL, 'x'), { code: 'invalid_credentials' });
  assert.equal(users.filter((u) => u.email === M.SYSTEM_EMAIL).length, 1);       // lần 2 không tạo bản ghi mới
  await M.updateCoupons((l) => l);
  assert.equal(users.filter((u) => u.email === M.SYSTEM_EMAIL).length, 1);

  const o1 = await M.placeOrder({ userId: cust.id, lines: [{ id: '1', qty: 1 }], address: addr, paymentMethod: 'cod', couponCode: 'save10' });
  assert.equal(o1.discount, 40); assert.equal(o1.total, 375); assert.equal(o1.couponCode, 'SAVE10'); assert.equal(o1.shipping, 15);
  assert.equal((await M.fetchPromotions()).find((c) => c.code === 'SAVE10').usedCount, 1);
  await assert.rejects(M.placeOrder({ userId: cust.id, lines: [{ id: '2', qty: 1 }], address: addr, paymentMethod: 'cod', couponCode: 'SAVE10' }),
    (e) => e.code === 'invalid_coupon' && /at least \$100/.test(e.message));
  assert.equal(bags[1].stock, 3);                                                    // lỗi mã -> chưa trừ kho
  await assert.rejects(M.placeOrder({ userId: cust.id, lines: [{ id: '2', qty: 1 }], address: addr, paymentMethod: 'cod', couponCode: 'zzz' }), { code: 'invalid_coupon' });
  const o2 = await M.placeOrder({ userId: cust.id, lines: [{ id: '2', qty: 1 }], address: addr, paymentMethod: 'cod', couponCode: 'once' });
  assert.equal(o2.discount, 5);
  await assert.rejects(M.placeOrder({ userId: other.id, lines: [{ id: '2', qty: 1 }], address: addr, paymentMethod: 'cod', couponCode: 'once' }),
    (e) => e.code === 'invalid_coupon' && /redeemed/.test(e.message));

  // đánh giá: chưa nhận hàng thì không được
  await assert.rejects(M.submitReview({ user: cust, handbagId: '1', rating: 5, comment: 'x' }), { code: 'not_purchased' });
  await assert.rejects(M.submitReview({ user: cust, handbagId: '1', rating: 0, comment: '' }), { code: 'invalid_input' });
  await assert.rejects(M.submitReview({ user: cust, handbagId: '1', rating: 5, comment: 'x'.repeat(501) }), { code: 'invalid_input' });
  assert.equal(await M.hasDeliveredPurchase(cust.id, '1'), false);
  for (const s of ['confirmed', 'shipping', 'delivered']) await M.updateOrderStatus(cust.id, o1.id, s);
  assert.equal(await M.hasDeliveredPurchase(cust.id, '1'), true); assert.equal(await M.hasDeliveredPurchase(cust.id, '2'), false);
  const rv = await M.submitReview({ user: cust, handbagId: '1', rating: 4, comment: '  Nice  ' });
  assert.equal(rv.comment, 'Nice'); assert.equal(rv.userId, cust.id); assert.equal(bags[0].feedbacks.length, 3);
  assert.ok(M.store.getSnapshot().items.find((i) => i.id === '1').feedbacks.some((f) => f.id === rv.id));
  const rv2 = await M.submitReview({ user: cust, handbagId: '1', rating: 2, comment: 'Changed' });
  assert.equal(rv2.id, rv.id); assert.equal(bags[0].feedbacks.length, 3); assert.equal(bags[0].feedbacks[2].rating, 2);
  await assert.rejects(M.submitReview({ user: other, handbagId: '1', rating: 5, comment: '' }), { code: 'not_purchased' });

  // kiểm duyệt (kể cả đánh giá không có id)
  await M.setReviewHidden('1', rv.id, true);
  assert.equal(M.normalizeFeedbacks(bags[0].feedbacks).length, 2);                    // khách không thấy
  assert.equal(M.normalizeFeedbacks(bags[0].feedbacks, { includeHidden: true }).length, 3);
  const rv3 = await M.submitReview({ user: cust, handbagId: '1', rating: 5, comment: 'Edit while hidden' });
  assert.equal(bags[0].feedbacks[2].hidden, true);                                    // sửa xong vẫn bị ẩn
  await M.setReviewHidden('1', 'feedback-1', true);
  assert.equal(bags[0].feedbacks[1].hidden, true);
  await M.setReviewHidden('1', rv.id, false);
  await M.deleteReview('1', 'feedback-1'); assert.equal(bags[0].feedbacks.length, 2);
  await M.deleteOwnReview({ userId: cust.id, handbagId: '1' });
  assert.equal(bags[0].feedbacks.length, 1); assert.equal(bags[0].feedbacks[0].id, '1-1');

  // trả hàng
  await assert.rejects(M.requestReturn(cust.id, o2.id, { reason: 'Damaged or defective' }), { code: 'return_not_allowed' });   // chưa giao
  await assert.rejects(M.requestReturn(cust.id, o1.id, { reason: 'because' }), { code: 'invalid_input' });
  const stockBefore = bags[0].stock;
  const rr = await M.requestReturn(cust.id, o1.id, { reason: 'Damaged or defective', note: ' broken strap ' });
  assert.equal(rr.returnRequest.status, 'requested'); assert.equal(rr.returnRequest.note, 'broken strap');
  await assert.rejects(M.requestReturn(cust.id, o1.id, { reason: 'Other' }), { code: 'return_not_allowed' });   // chỉ một lần
  await assert.rejects(M.updateOrderStatus(cust.id, o1.id, 'cancelled'), { code: 'invalid_transition' });
  const approved = await M.resolveReturn(cust.id, o1.id, 'approve', { restock: true });
  assert.equal(approved.status, 'returned'); assert.equal(approved.returnRequest.status, 'approved'); assert.equal(approved.returnRequest.restocked, true);
  assert.equal(approved.paymentStatus, 'refunded'); assert.equal(approved.history.at(-1).status, 'returned');
  assert.equal(bags[0].stock, stockBefore + 1);
  await assert.rejects(M.resolveReturn(cust.id, o1.id, 'approve'), { code: 'invalid_return' });                 // xử lý rồi
  assert.equal(M.statusMeta('returned').label, 'Returned');

  // trả hàng: từ chối + không nhập lại kho
  for (const s of ['confirmed', 'shipping', 'delivered']) await M.updateOrderStatus(cust.id, o2.id, s);
  await M.requestReturn(cust.id, o2.id, { reason: 'Changed my mind' });
  const rej = await M.resolveReturn(cust.id, o2.id, 'reject', { note: ' Used item ' });
  assert.equal(rej.status, 'delivered'); assert.equal(rej.returnRequest.status, 'rejected'); assert.equal(rej.returnRequest.adminNote, 'Used item');
  const stock2 = bags[1].stock;
  // duyệt không nhập kho
  const o3 = await M.placeOrder({ userId: other.id, lines: [{ id: '2', qty: 1 }], address: addr, paymentMethod: 'card' });
  for (const s of ['confirmed', 'shipping', 'delivered']) await M.updateOrderStatus(other.id, o3.id, s);
  await M.requestReturn(other.id, o3.id, { reason: 'Wrong item received' });
  const ap2 = await M.resolveReturn(other.id, o3.id, 'approve', { restock: false });
  assert.equal(ap2.paymentStatus, 'refunded'); assert.equal(ap2.returnRequest.restocked, false);
  assert.equal(bags[1].stock, stock2 - 1);

  // đổi tên brand hàng loạt
  const res = await M.bulkUpdateHandbags(['1', '2', 'zzz'], { brand: 'Bulgari' });
  assert.equal(res.updated, 2); assert.deepEqual(res.failed, ['zzz']); assert.ok(bags.every((b) => b.brand === 'Bulgari'));
  assert.equal(bags[0].feedbacks.length, 1);

  console.log('PHASE 4 TESTS PASSED');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
