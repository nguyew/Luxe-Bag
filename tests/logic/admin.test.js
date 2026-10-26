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
    if (email) list = table.filter((x) => x.email.toLowerCase().includes(email.toLowerCase()));
    return list.length ? res(200, clone(list)) : res(404);
  }
  if (method === 'POST') { const r = { ...JSON.parse(opts.body), id: String(nid++) }; table.push(r); return res(201, clone(r)); }
  const i = table.findIndex((x) => x.id === parts[1]);
  if (method === 'GET') return i >= 0 ? res(200, clone(table[i])) : res(404);
  if (method === 'PUT') { if (i < 0) return res(404); Object.assign(table[i], JSON.parse(opts.body)); return res(200, clone(table[i])); }
  if (method === 'DELETE') { if (i < 0) return res(404); const [r] = table.splice(i, 1); return res(200, clone(r)); }
};
const M = require('../.out/admin.js');

(async () => {
  // ---- utils
  const mk = (id, status, total, extra = {}) => ({ id, status, total, createdAt: `2026-0${id.slice(-1)}-01T00:00:00Z`, ...extra });
  const us = [
    { id: 'u1', name: 'A', email: 'a@x', role: 'customer', orders: [mk('o1', 'pending', 100), mk('o2', 'cancelled', 999), mk('o3', 'delivered', 50.5)] },
    { id: 'u2', name: 'B', email: 'b@x', role: 'customer', orders: [mk('o4', 'shipping', 20)] },
  ];
  const flat = M.flattenOrders(us);
  assert.deepEqual(flat.map((o) => o.id), ['o4', 'o3', 'o2', 'o1']); assert.equal(flat[0].customerName, 'B');
  assert.deepEqual(M.orderCountsByStatus(flat), { all: 4, shipping: 1, delivered: 1, cancelled: 1, pending: 1 });
  assert.deepEqual(M.customerStats(us[0]), { orderCount: 3, totalSpent: 150.5 });
  assert.deepEqual(M.salesSummary(flat), { orderCount: 4, pending: 1, returns: 0, revenue: 170.5 });
  const inv = M.inventoryStats([{ status: 'draft', stock: 0 }, { stock: 0 }, { stock: 2 }, { stock: 9 }, { status: 'archived', stock: 1 }, {}]);
  assert.deepEqual(inv, { total: 6, published: 4, draft: 1, archived: 1, lowStock: 1, outOfStock: 1 });
  assert.deepEqual(M.nextStatuses('pending'), ['confirmed', 'cancelled']); assert.deepEqual(M.nextStatuses('delivered'), []);

  // ---- sản phẩm
  bags = [{ id: '1', handbagName: 'Old', brand: 'Fendi', cost: 100, percentOff: 0.1, stock: 5, feedbacks: [{ rating: 5 }] }];
  const created = await M.createHandbag({ handbagName: 'New bag', brand: 'Bvlgari', cost: 300, stock: 4, status: 'draft', evil: 'x', id: 'hack' });
  assert.equal(created.status, 'draft'); assert.deepEqual(created.feedbacks, []); assert.equal(created.evil, undefined); assert.notEqual(created.id, 'hack');
  assert.ok(M.store.getSnapshot().items.some((i) => i.id === created.id));          // cache cục bộ có ngay

  bags[0].stock = 2; // khách vừa mua -> admin không gửi stock thì không bị ghi đè
  const upd = await M.updateHandbag('1', { handbagName: 'Renamed', cost: 120 });
  assert.equal(upd.handbagName, 'Renamed'); assert.equal(upd.stock, 2); assert.equal(upd.feedbacks.length, 1);
  assert.equal(M.store.getSnapshot().items.find((i) => i.id === '1').handbagName, 'Renamed');

  const bulk = await M.applyBulkDiscount(['1', created.id, 'missing'], 0.25);
  assert.equal(bulk.updated, 2); assert.deepEqual(bulk.failed, ['missing']);
  assert.equal(bags.find((b) => b.id === '1').percentOff, 0.25);

  await M.deleteHandbag(created.id);
  assert.ok(!bags.some((b) => b.id === created.id)); assert.ok(!M.store.getSnapshot().items.some((i) => i.id === created.id));

  // ---- khách hàng + đơn
  const cust = await M.registerUser({ name: 'Mai', email: 'mai@x.co', password: 'secret1' });
  const addr = { id: 'a', label: 'Home', fullName: 'Mai', phone: '0901234567', line1: '1 St', city: 'HCMC', isDefault: true };
  const order = await M.placeOrder({ userId: cust.id, lines: [{ id: '1', qty: 2 }], address: addr, paymentMethod: 'cod' });
  assert.equal(bags[0].stock, 0);

  M.invalidateAdminCache();
  const list = await M.fetchAdminUsers();
  const found = list.find((x) => x.id === cust.id);
  assert.equal(found.orders.length, 1); assert.ok(!('passwordHash' in found) && !('salt' in found));
  assert.strictEqual(await M.fetchAdminUsers(), list);                       // dùng cache
  assert.strictEqual(M.peekAdminUsers(), list);

  // chuyển trạng thái
  await assert.rejects(M.updateOrderStatus(cust.id, order.id, 'delivered'), { code: 'invalid_transition' });
  await assert.rejects(M.updateOrderStatus(cust.id, 'nope', 'confirmed'), { code: 'not_found' });
  let o = await M.updateOrderStatus(cust.id, order.id, 'confirmed');
  assert.equal(o.status, 'confirmed'); assert.equal(M.peekAdminUsers(), null);  // cache bị xóa
  await assert.rejects(M.cancelOrder(cust.id, order.id), { code: 'not_cancellable' }); // khách hết quyền hủy
  o = await M.updateOrderStatus(cust.id, order.id, 'shipping');
  o = await M.updateOrderStatus(cust.id, order.id, 'delivered');
  assert.equal(o.paymentStatus, 'paid'); assert.equal(o.history.length, 4);
  await assert.rejects(M.updateOrderStatus(cust.id, order.id, 'cancelled'), { code: 'invalid_transition' });

  // admin hủy đơn -> hoàn kho
  bags[0].stock = 5;
  const o2 = await M.placeOrder({ userId: cust.id, lines: [{ id: '1', qty: 3 }], address: addr, paymentMethod: 'card' });
  assert.equal(bags[0].stock, 2);
  const c2 = await M.updateOrderStatus(cust.id, o2.id, 'cancelled');
  assert.equal(c2.status, 'cancelled'); assert.equal(c2.paymentStatus, 'refunded'); assert.ok(c2.cancelledAt);
  assert.equal(bags[0].stock, 5);

  // khóa / mở tài khoản
  const dis = await M.setCustomerStatus(cust.id, 'disabled');
  assert.equal(dis.status, 'disabled');
  await assert.rejects(M.loginUser('mai@x.co', 'secret1'), { code: 'disabled' });
  assert.equal((await M.setCustomerStatus(cust.id, 'active')).status, 'active');
  assert.equal((await M.loginUser('mai@x.co', 'secret1')).id, cust.id);
  users.push({ id: 'adm', name: 'Adm', email: 'adm@x', role: 'admin', status: 'active' });
  await assert.rejects(M.setCustomerStatus('adm', 'disabled'), /Admin accounts/);
  await assert.rejects(M.setCustomerStatus(cust.id, 'banned'), /Invalid status/);

  console.log('PHASE 3 TESTS PASSED');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
