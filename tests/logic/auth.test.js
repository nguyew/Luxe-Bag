process.env.EXPO_PUBLIC_API_URL = 'https://fake.mockapi.io';
const assert = require('assert');
const crypto = require('crypto');

// ---- MockAPI giả: lọc kiểu "chứa chuỗi", 404 khi không có kết quả
let users = []; let nextId = 1;
global.fetch = async (url, opts = {}) => {
  const u = new URL(url); const method = opts.method || 'GET';
  const parts = u.pathname.split('/').filter(Boolean);
  const res = (status, body) => ({ ok: status < 400, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) });
  if (parts[0] !== 'users') return res(404, 'Not found');
  if (method === 'GET' && parts.length === 1) {
    let list = users;
    const email = u.searchParams.get('email');
    if (email) list = users.filter((x) => x.email.toLowerCase().includes(email.toLowerCase()));
    return list.length ? res(200, list) : res(404, 'Not found');
  }
  const rec = users.find((x) => x.id === parts[1]);
  if (method === 'GET') return rec ? res(200, rec) : res(404, 'Not found');
  if (method === 'POST') { const r = { ...JSON.parse(opts.body), id: String(nextId++) }; users.push(r); return res(201, r); }
  if (method === 'PUT') { if (!rec) return res(404, 'Not found'); Object.assign(rec, JSON.parse(opts.body)); return res(200, rec); }
};

const { registerUser, loginUser, updateUser, listUsers, auth, fav, AsyncStorage } = require('../.out/auth.js');


(async () => {
  // đăng ký
  const u = await registerUser({ name: 'Mai', email: 'Mai@Test.com ', password: 'secret1' });
  assert.equal(u.email, 'mai@test.com'); assert.equal(u.role, 'customer');
  assert.ok(!('passwordHash' in u) && !('salt' in u));
  assert.ok(users[0].passwordHash.length === 64 && users[0].passwordHash !== 'secret1');
  await assert.rejects(registerUser({ name: 'X', email: 'mai@test.com', password: 'secret1' }), { code: 'email_taken' });
  // email chứa trong email khác không bị coi là trùng
  const u2 = await registerUser({ name: 'Ai', email: 'ai@test.com', password: 'secret1' });
  assert.ok(u2.id);
  await assert.rejects(registerUser({ name: '', email: 'a@b.co', password: 'secret1' }), { code: 'invalid_input' });
  await assert.rejects(registerUser({ name: 'A', email: 'bad', password: 'secret1' }), { code: 'invalid_input' });
  await assert.rejects(registerUser({ name: 'A', email: 'a@b.co', password: '123' }), { code: 'invalid_input' });

  // đăng nhập
  assert.equal((await loginUser('MAI@test.com', 'secret1')).id, u.id);
  await assert.rejects(loginUser('mai@test.com', 'wrong'), { code: 'invalid_credentials' });
  await assert.rejects(loginUser('nobody@test.com', 'secret1'), { code: 'invalid_credentials' }); // 404 -> không lộ
  users[0].status = 'disabled';
  await assert.rejects(loginUser('mai@test.com', 'secret1'), { code: 'disabled' });
  users[0].status = 'active';

  // admin tạo bằng script dùng cùng công thức băm
  const salt = 's1'; users.push({ id: String(nextId++), name: 'Adm', email: 'adm@x.co', role: 'admin', status: 'active', salt,
    passwordHash: crypto.createHash('sha256').update(`${salt}:Admin@123`).digest('hex') });
  assert.equal((await loginUser('adm@x.co', 'Admin@123')).role, 'admin');

  // mất mạng -> network
  const realFetch = global.fetch; global.fetch = async () => { throw new TypeError('Network request failed'); };
  await assert.rejects(loginUser('mai@test.com', 'secret1'), { code: 'network' });
  global.fetch = realFetch;

  // cập nhật hồ sơ không làm mất orders
  users[0].orders = [{ id: 'o1' }];
  const up = await updateUser(u.id, { name: ' Mai Phuong ', passwordHash: 'hack', role: 'admin' });
  assert.equal(up.name, 'Mai Phuong'); assert.equal(up.role, 'customer');
  assert.equal(users[0].orders.length, 1); assert.notEqual(users[0].passwordHash, 'hack');

  // admin xem danh sách
  assert.equal(users.length, 3);

  // ---- authStore: phiên + yêu thích theo tài khoản
  assert.equal(auth.getSnapshot().status, 'loading');
  await auth.initAuth();
  assert.equal(auth.getSnapshot().user, null);
  await fav.addFavorite({ id: 'g1', handbagName: 'guest bag' });          // yêu thích khi là khách
  await auth.login('mai@test.com', 'secret1');
  assert.equal(auth.getSnapshot().user.email, 'mai@test.com');
  assert.deepEqual(await fav.getFavorites(), []);                         // tài khoản có danh sách riêng
  await fav.addFavorite({ id: 'u1', handbagName: 'mai bag' });
  assert.ok(await AsyncStorage.getItem('@luxebag/favorites:' + u.id));
  await auth.updateAccount({ name: 'Mai P' });
  assert.equal(auth.getSnapshot().user.name, 'Mai P');
  await auth.logout();
  assert.equal(auth.getSnapshot().user, null);
  assert.equal((await fav.getFavorites())[0].id, 'g1');                   // quay lại danh sách của khách
  assert.equal(await AsyncStorage.getItem('@luxebag/session'), null);
  await auth.register({ name: 'New', email: 'new@x.co', password: 'abcdef' });
  assert.equal(auth.getSnapshot().user.name, 'New');
  console.log('ALL TESTS PASSED');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
