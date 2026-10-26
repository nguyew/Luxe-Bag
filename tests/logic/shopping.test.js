process.env.EXPO_PUBLIC_API_URL = 'https://fake.mockapi.io';
const assert = require('assert');

let users = []; let bags = []; let failUserPut = false;
global.fetch = async (url, opts = {}) => {
  const u = new URL(url); const method = opts.method || 'GET';
  const parts = u.pathname.split('/').filter(Boolean);
  const res = (status, body) => ({ ok: status < 400, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) });
  const table = parts[0] === 'users' ? users : parts[0] === 'handbags' ? bags : null;
  if (!table) return res(404);
  if (method === 'GET' && parts.length === 1) {
    let list = table; const email = u.searchParams.get('email');
    if (email) list = table.filter((x) => x.email.toLowerCase().includes(email.toLowerCase()));
    return list.length ? res(200, JSON.parse(JSON.stringify(list))) : res(404);
  }
  const rec = table.find((x) => x.id === parts[1]);
  if (method === 'GET') return rec ? res(200, JSON.parse(JSON.stringify(rec))) : res(404);
  if (method === 'PUT') {
    if (!rec) return res(404);
    if (parts[0] === 'users' && failUserPut) return res(500);
    Object.assign(rec, JSON.parse(opts.body)); return res(200, JSON.parse(JSON.stringify(rec)));
  }
  if (method === 'POST') { const r = { ...JSON.parse(opts.body), id: String(table.length + 1) }; table.push(r); return res(201, r); }
};

const M = require('../.out/shopping.js');
const { auth, cart } = M;

(async () => {
  // ---- tiện ích thuần
  assert.equal(M.calcShipping(100), 15); assert.equal(M.calcShipping(500), 0); assert.equal(M.calcShipping(0), 0);
  assert.deepEqual(M.calcTotals([{ unitPrice: 49.89, qty: 3 }, { unitPrice: 0.1, qty: 3 }]), { subtotal: 149.97, discount: 0, shipping: 15, total: 164.97 });
  assert.equal(M.getStock({}), null); assert.equal(M.getStock({ stock: '4' }), 4); assert.equal(M.getStock({ stock: -3 }), 0);
  assert.equal(M.isPublished({}), true); assert.equal(M.isPublished({ status: 'draft' }), false);
  assert.equal(M.maxQtyFor({ stock: 50 }), 10); assert.equal(M.maxQtyFor({ stock: 0 }), 0); assert.equal(M.maxQtyFor({}), 10);
  assert.equal(M.canCancel({ status: 'pending' }), true); assert.equal(M.canCancel({ status: 'confirmed' }), false);

  // ---- địa chỉ
  const good = { id: 'a1', label: 'Home', fullName: 'Mai', phone: '0901 234 567', line1: '12 Le Loi', city: 'HCMC' };
  const clean = M.sanitizeAddresses([good, { ...good, id: 'a2' }, { ...good, id: 'bad', phone: 'abc' }, { ...good, id: 'a3', isDefault: true }]);
  assert.equal(clean.length, 3); assert.deepEqual(clean.map((a) => a.isDefault), [false, false, true]);
  assert.equal(M.sanitizeAddresses([good])[0].isDefault, true);

  // ---- dữ liệu
  bags = [
    { id: '1', handbagName: 'Red bag', brand: 'Bvlgari', cost: 100, stock: 3, uri: 'u1' },
    { id: '2', handbagName: 'Blue bag', brand: 'Fendi', cost: 600, stock: 5, uri: 'u2' },
    { id: '3', handbagName: 'No-stock-field', brand: 'X', cost: 50, uri: 'u3' },
    { id: '4', handbagName: 'Draft', brand: 'X', cost: 10, stock: 9, status: 'draft' },
  ];
  await auth.initAuth();
  const user = await auth.register({ name: 'Mai', email: 'mai@x.co', password: 'secret1' });

  // địa chỉ qua authStore
  const withAddr = await auth.saveAddresses([good]);
  assert.equal(withAddr.addresses.length, 1); assert.equal(auth.getSnapshot().user.addresses[0].isDefault, true);
  assert.deepEqual(users[0].orders, []);   // không mất orders

  // ---- giỏ hàng theo tài khoản
  await new Promise((r) => setTimeout(r, 5));
  cart.cartAdd('1', 2, 3); cart.cartAdd('1', 5, 3); // cộng dồn nhưng bị chặn ở max
  assert.equal(cart.getSnapshot().items[0].qty, 3);
  cart.cartAdd('3', 1, 10);
  cart.cartSetQty('3', 0); assert.equal(cart.getSnapshot().items.find((i) => i.id === '3').qty, 1); // qty<1 bị bỏ qua
  await auth.logout(); assert.equal(cart.getSnapshot().items.length, 0);
  cart.cartAdd('1', 1, 3); assert.equal(cart.getSnapshot().items.length, 0);       // khách không có giỏ
  await auth.login('mai@x.co', 'secret1'); await new Promise((r) => setTimeout(r, 5));
  assert.equal(cart.getSnapshot().items.length, 2);                                // giỏ được khôi phục

  // ---- đặt hàng: kho không đủ
  await assert.rejects(M.placeOrder({ userId: user.id, lines: [{ id: '1', qty: 4 }], address: good, paymentMethod: 'cod' }),
    (e) => e.code === 'unavailable' && e.details[0].reason === 'insufficient' && e.details[0].available === 3);
  await assert.rejects(M.placeOrder({ userId: user.id, lines: [{ id: '4', qty: 1 }], address: good, paymentMethod: 'cod' }), { code: 'unavailable' });
  await assert.rejects(M.placeOrder({ userId: user.id, lines: [], address: good, paymentMethod: 'cod' }), { code: 'empty' });
  await assert.rejects(M.placeOrder({ userId: user.id, lines: [{ id: '1', qty: 1 }], address: null, paymentMethod: 'cod' }), { code: 'no_address' });
  await assert.rejects(M.placeOrder({ userId: user.id, lines: [{ id: '1', qty: 1 }], address: good, paymentMethod: 'bitcoin' }), { code: 'invalid_input' });
  assert.equal(bags[0].stock, 3);   // chưa bị trừ

  // ---- đặt hàng thành công
  const order = await M.placeOrder({ userId: user.id, lines: [{ id: '1', qty: 2 }, { id: '3', qty: 1 }], address: good, paymentMethod: 'card' });
  assert.equal(order.status, 'pending'); assert.equal(order.subtotal, 250); assert.equal(order.shipping, 15); assert.equal(order.total, 265);
  assert.equal(order.paymentStatus, 'paid'); assert.equal(order.items.length, 2); assert.equal(order.items[0].unitPrice, 100);
  assert.equal(bags[0].stock, 1);               // trừ kho
  assert.equal(bags[2].stock, undefined);       // không theo dõi kho thì không đụng
  assert.equal(users[0].orders.length, 1);
  assert.equal((await M.getMyOrders(user.id))[0].id, order.id);

  // ---- ghi đơn lỗi -> hoàn kho
  failUserPut = true;
  await assert.rejects(M.placeOrder({ userId: user.id, lines: [{ id: '2', qty: 2 }], address: good, paymentMethod: 'cod' }), { code: 'network' });
  failUserPut = false;
  assert.equal(bags[1].stock, 5); assert.equal(users[0].orders.length, 1);

  // ---- hủy đơn
  const cancelled = await M.cancelOrder(user.id, order.id);
  assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.paymentStatus, 'refunded');
  assert.equal(cancelled.history.length, 2);
  assert.equal(bags[0].stock, 3);                // hoàn kho
  await assert.rejects(M.cancelOrder(user.id, order.id), { code: 'not_cancellable' });
  await assert.rejects(M.cancelOrder(user.id, 'nope'), { code: 'not_found' });

  // admin xác nhận đơn rồi khách mới hủy -> bị từ chối (kiểm tra bản mới nhất)
  const o2 = await M.placeOrder({ userId: user.id, lines: [{ id: '2', qty: 1 }], address: good, paymentMethod: 'cod' });
  users[0].orders.find((o) => o.id === o2.id).status = 'confirmed';
  await assert.rejects(M.cancelOrder(user.id, o2.id), { code: 'not_cancellable' });
  assert.equal(bags[1].stock, 4);

  console.log('PHASE 2 TESTS PASSED');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
