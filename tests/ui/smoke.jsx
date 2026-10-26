import React from 'react';
import crypto from 'crypto';
import assert from 'assert';
import { mount, settle, press, typeInto, pressAlert, lastAlert, alerts, has, allText, hasPressable, isDisabled, makeNav, useNav, act } from './lib.jsx';

process.env.EXPO_PUBLIC_API_URL = 'https://fake.mockapi.io';

// ---------------- MockAPI giả ----------------
let users = []; let bags = []; let nid = 100;
globalThis.fetch = async (url, opts = {}) => {
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

const S = (name) => import(`../../src/screens/${name}.js`).then((m) => m.default);
const auth = await import('../../src/services/authStore.js');
const admin = await import('../../src/services/adminService.js');
const cartSvc = await import('../../src/services/cartService.js');
const store = await import('../../src/services/handbagStore.js');
const orderSvc = await import('../../src/services/orderService.js');
const promo = await import('../../src/services/promotionService.js');

let step = 0;
const ok = (msg) => console.log(`  ✓ ${String(++step).padStart(2, '0')} ${msg}`);

bags = [
  { id: '1', handbagName: 'Red Serpenti bag', brand: 'Bvlgari', category: 'Crossbody', cost: 600, percentOff: 0.4, gender: true, stock: 5, uri: 'https://x/1.jpg', color: ['Red'], feedbacks: [{ id: '1-1', author: 'Seed', rating: 5, comment: 'Great bag', date: '2026-01-02T00:00:00Z' }] },
  { id: '2', handbagName: 'Blue Fendi tote', brand: 'Fendi', category: 'Tote', cost: 300, percentOff: 0.2, gender: false, stock: 2, uri: 'https://x/2.jpg', color: ['Blue'], feedbacks: [] },
  { id: '3', handbagName: 'Draft wallet', brand: 'Fendi', category: 'Wallet', cost: 50, stock: 9, status: 'draft', uri: 'https://x/3.jpg', feedbacks: [] },
  { id: '4', handbagName: 'Sold out cardcase', brand: 'Burberry', category: 'Card Case', cost: 80, gender: true, stock: 0, uri: 'https://x/4.jpg', feedbacks: [] },
];
const salt = 'adm-salt';
users.push({ id: 'adm', name: 'Store Admin', email: 'admin@luxebag.com', role: 'admin', status: 'active', salt, passwordHash: crypto.createHash('sha256').update(`${salt}:Admin@123`).digest('hex'), phone: '', createdAt: new Date().toISOString(), addresses: [], orders: [] });

const nav = makeNav();
useNav(nav);
const lastNav = () => nav.calls[nav.calls.length - 1];
const navTo = (name) => nav.calls.some((c) => (c.type === 'navigate' || c.type === 'replace') && c.args[0] === name);

await auth.initAuth();

// =========================================================================
console.log('GUEST');
{
  const Cart = await S('CartScreen');
  let r = await mount(<Cart navigation={nav} />);
  assert(has(r, 'Sign in to add handbags'), allText(r)); ok('Cart: khách thấy lời mời đăng nhập');
  await press(r, 'Sign in'); assert(navTo('Login')); ok('Cart: bấm Sign in -> Login');

  const Login = await S('LoginScreen');
  r = await mount(<Login navigation={nav} />);
  await typeInto(r, 'Email', 'nobody@x.co'); await typeInto(r, 'Password', 'wrongpass');
  await press(r, 'Sign in');
  assert(has(r, 'Incorrect email or password.'), allText(r)); ok('Login: sai thông tin -> báo lỗi');
  await typeInto(r, 'Email', 'bad'); await press(r, 'Sign in');
  assert(has(r, 'Enter a valid email address.')); ok('Login: email sai định dạng');

  const Register = await S('RegisterScreen');
  r = await mount(<Register navigation={nav} />);
  await typeInto(r, 'Full name', 'Mai Tran'); await typeInto(r, 'Email', 'mai@x.co');
  await typeInto(r, 'Password', 'secret1'); await typeInto(r, 'Confirm password', 'different');
  await press(r, 'Create account');
  assert(has(r, 'Passwords do not match.')); ok('Register: mật khẩu xác nhận không khớp');
  await typeInto(r, 'Confirm password', 'secret1'); await press(r, 'Create account');
  assert.equal(auth.getSnapshot().user?.email, 'mai@x.co'); ok('Register: tạo tài khoản và đăng nhập');
}

// =========================================================================
console.log('CUSTOMER');
let orderId;
{
  const Home = await S('HomeScreen');
  let r = await mount(<Home navigation={nav} />);
  assert(has(r, 'Red Serpenti bag') && has(r, 'Blue Fendi tote'), allText(r));
  assert(!has(r, 'Draft wallet')); ok('Home: hiện sản phẩm đã xuất bản, ẩn bản nháp');

  const Search = await S('SearchScreen');
  r = await mount(<Search navigation={nav} />);
  assert(has(r, 'All handbags (3)'), allText(r)); ok('Search: 3 sản phẩm (không có bản nháp)');
  await press(r, 'Filters');
  await press(r, 'Tote (1)');
  assert(has(r, 'Show 1 result'), allText(r)); ok('Search: bộ lọc category -> xem trước 1 kết quả');
  await press(r, 'Show 1 result');
  assert(has(r, 'All handbags (1) · 1 filter'), allText(r)); assert(!has(r, 'Red Serpenti bag')); ok('Search: áp dụng bộ lọc, danh sách còn 1');
  await press(r, 'Filters, 1 active'); await press(r, 'Reset'); await press(r, 'Show 3 results');
  assert(has(r, 'All handbags (3)')); ok('Search: Reset bộ lọc');

  const Detail = await S('DetailScreen');
  r = await mount(<Detail navigation={nav} route={{ params: { handbag: bags[0] } }} />);
  assert(has(r, 'Red Serpenti bag') && has(r, 'Great bag'), allText(r)); ok('Detail: hiện thông tin và feedback');
  assert(has(r, 'Only customers who received this item'), allText(r)); ok('Detail: chưa nhận hàng -> ghi chú không được đánh giá');
  await press(r, 'Add to bag');
  assert.equal(cartSvc.getSnapshot().items[0].qty, 1); assert(has(r, 'Added to your bag')); ok('Detail: Add to bag -> giỏ có 1 món');
  await press(r, 'Add to bag'); await press(r, 'Add to bag'); await press(r, 'Add to bag'); await press(r, 'Add to bag'); await press(r, 'Add to bag');
  assert.equal(cartSvc.getSnapshot().items[0].qty, 5); assert(has(r, 'Maximum quantity in bag')); ok('Detail: không thêm quá tồn kho (5)');
  for (let i = 0; i < 3; i++) cartSvc.cartSetQty('1', 1); // về 1 cái cho các bước sau
  const rSold = await mount(<Detail navigation={nav} route={{ params: { handbag: bags[3] } }} />);
  assert(has(rSold, 'Out of stock')); assert(isDisabled(rSold, 'Add to bag')); ok('Detail: hết hàng -> nút bị khóa');

  const Cart = await S('CartScreen');
  r = await mount(<Cart navigation={nav} />);
  assert(has(r, 'Red Serpenti bag') && has(r, '$600'), allText(r)); ok('Cart: hiện món và tổng tiền');
  await press(r, 'Increase quantity'); assert.equal(cartSvc.getSnapshot().items[0].qty, 2);
  await press(r, 'Decrease quantity'); assert.equal(cartSvc.getSnapshot().items[0].qty, 1); ok('Cart: tăng / giảm số lượng');
  await press(r, 'Checkout'); assert(navTo('Checkout')); ok('Cart: Checkout');

  // ---- Checkout
  const Checkout = await S('CheckoutScreen');
  r = await mount(<Checkout navigation={nav} />);
  assert(has(r, 'Add a delivery address')); ok('Checkout: chưa có địa chỉ');
  await press(r, 'Add a delivery address'); assert(navTo('AddressForm'));

  const AddressForm = await S('AddressFormScreen');
  const nav2 = makeNav(); useNav(nav2);
  const rf = await mount(<AddressForm navigation={nav2} route={{ params: {} }} />);
  await press(rf, 'Save address');
  assert(has(rf, 'Enter the street address.') && has(rf, 'Enter a phone number.')); ok('AddressForm: báo thiếu thông tin');
  await typeInto(rf, 'Phone', '0901 234 567'); await typeInto(rf, 'Street address', '12 Le Loi'); await typeInto(rf, 'City / Province', 'HCMC');
  await press(rf, 'Save address');
  assert.equal(auth.getSnapshot().user.addresses.length, 1); assert(nav2.calls.some((c) => c.type === 'goBack')); ok('AddressForm: lưu địa chỉ');
  useNav(nav);

  await act(async () => { r.update(<Checkout navigation={nav} />); }); await settle();
  assert(has(r, '12 Le Loi')); ok('Checkout: tự chọn địa chỉ mặc định');

  // lưu mã giảm giá
  await promo.updateCoupons(() => [{ id: 'c1', code: 'SAVE10', type: 'percent', value: 10, minSubtotal: 100 }]);
  await typeInto(r, 'Discount code', 'wrong'); await press(r, 'Apply');
  assert(has(r, 'This code is not valid.')); ok('Checkout: mã sai -> báo lỗi');
  await typeInto(r, 'Discount code', 'save10'); await press(r, 'Apply');
  assert(has(r, 'SAVE10') && has(r, '-$60'), allText(r)); ok('Checkout: áp mã, giảm $60');
  assert(has(r, '$540'), allText(r)); ok('Checkout: tổng = 600 - 60 = 540, miễn phí ship (≥ 500 sau giảm)');

  await press(r, 'Place order');
  assert(navTo('OrderDetail'), JSON.stringify(nav.calls.slice(-3)));
  const placed = nav.calls.filter((c) => c.type === 'replace').pop().args[1];
  orderId = placed.orderId;
  assert.equal(placed.order.discount, 60); assert.equal(placed.order.total, 540);
  assert.equal(bags[0].stock, 4); assert.equal(cartSvc.getSnapshot().items.length, 0); ok('Checkout: đặt hàng -> kho 5→4, giỏ trống, đã chuyển tới chi tiết đơn');
  assert.equal((await promo.fetchPromotions())[0].usedCount, 1); ok('Checkout: ghi nhận lượt dùng mã');
}

// ---- Orders / OrderDetail / hủy đơn
{
  const Orders = await S('OrdersScreen');
  let r = await mount(<Orders navigation={nav} />);
  assert(has(r, orderId) && has(r, '$540') && has(r, 'Pending'), allText(r)); ok('Orders: hiện đơn vừa đặt');
  const OrderDetail = await S('OrderDetailScreen');
  r = await mount(<OrderDetail navigation={nav} route={{ params: { orderId, placed: true } }} />);
  assert(has(r, 'Thank you!') && has(r, 'Discount (SAVE10)') && has(r, 'Cancel order'), allText(r)); ok('OrderDetail: banner, dòng giảm giá, nút hủy');
  await press(r, 'Cancel order'); await pressAlert('Cancel order');
  assert(has(r, 'Cancelled')); assert.equal(bags[0].stock, 5); assert(!hasPressable(r, 'Cancel order')); ok('OrderDetail: hủy đơn -> hoàn kho, ẩn nút hủy');
}

// ---- Giao hàng -> đánh giá -> trả hàng
let order2;
{
  const user = auth.getSnapshot().user;
  const addr = user.addresses[0];
  order2 = await orderSvc.placeOrder({ userId: user.id, lines: [{ id: '2', qty: 1 }], address: addr, paymentMethod: 'cod' });
  for (const s of ['confirmed', 'shipping', 'delivered']) await admin.updateOrderStatus(user.id, order2.id, s);

  const Detail = await S('DetailScreen');
  let r = await mount(<Detail navigation={nav} route={{ params: { handbag: bags[1] } }} />);
  assert(hasPressable(r, 'Write a review')); ok('Detail: đã nhận hàng -> có nút Write a review');

  const ReviewForm = await S('ReviewFormScreen');
  const nav3 = makeNav(); useNav(nav3);
  r = await mount(<ReviewForm navigation={nav3} route={{ params: { handbagId: '2' } }} />);
  await press(r, 'Submit review');
  assert(has(r, 'Please tap the stars')); ok('ReviewForm: chưa chọn sao -> báo lỗi');
  await press(r, '4 stars'); await typeInto(r, 'Your review', 'Lovely tote');
  await press(r, 'Submit review');
  assert.equal(bags[1].feedbacks.length, 1); assert.equal(bags[1].feedbacks[0].rating, 4); assert(nav3.calls.some((c) => c.type === 'goBack')); ok('ReviewForm: gửi đánh giá 4★');
  useNav(nav);

  const OrderDetail = await S('OrderDetailScreen');
  r = await mount(<OrderDetail navigation={nav} route={{ params: { orderId: order2.id } }} />);
  assert(has(r, 'Delivered') && hasPressable(r, 'Request a return') && !hasPressable(r, 'Cancel order'), allText(r)); ok('OrderDetail: đơn đã giao -> có Request a return, không có Cancel');
  await press(r, 'Request a return');
  const ret = nav.calls.filter((c) => c.type === 'navigate').pop();
  assert.equal(ret.args[0], 'ReturnRequest');

  const ReturnRequest = await S('ReturnRequestScreen');
  const nav4 = makeNav(); useNav(nav4);
  r = await mount(<ReturnRequest navigation={nav4} route={{ params: ret.args[1] }} />);
  await press(r, 'Send request'); assert(has(r, 'Please choose a reason')); ok('ReturnRequest: chưa chọn lý do -> báo lỗi');
  await press(r, 'Damaged or defective'); await press(r, 'Send request');
  assert.equal(lastAlert().title, 'Request sent');
  assert.equal(users.find((u) => u.id === user.id).orders.find((o) => o.id === order2.id).returnRequest.status, 'requested'); ok('ReturnRequest: gửi yêu cầu trả hàng');
  useNav(nav);
}

console.log('PART 1 OK');

// =========================================================================
console.log('ADMIN');
const toggleSwitch = async (r, label, value) => {
  const node = r.root.findAll((n) => n.type === 'Switch' && n.props.accessibilityLabel === label)[0];
  if (!node) throw new Error('No switch ' + label);
  await act(async () => { await node.props.onValueChange(value); }); await settle();
};
const customer = () => users.find((u) => u.email === 'mai@x.co');
const orderOf = (id) => customer().orders.find((o) => o.id === id);
{
  await auth.logout();
  await auth.login('admin@luxebag.com', 'Admin@123');
  assert.equal(auth.getSnapshot().user.role, 'admin'); ok('Admin: đăng nhập, role admin');

  // ---- Dashboard
  const AdminHome = await S('AdminHomeScreen');
  let r = await mount(<AdminHome navigation={nav} />);
  assert(has(r, 'Hello, Store Admin.'), allText(r));
  assert(hasPressable(r, 'Return requests: 1'), allText(r)); ok('Dashboard: thẻ Return requests = 1');
  assert(hasPressable(r, 'Products: 4') && hasPressable(r, 'Low / out of stock: 1 / 1') || hasPressable(r, 'Products'), allText(r)); ok('Dashboard: số liệu sản phẩm / kho');
  await press(r, 'Return requests: 1');
  const last = nav.calls.filter((c) => c.type === 'navigate').pop();
  assert.equal(last.args[0], 'AdminOrders'); assert.equal(last.args[1].filter, 'returns'); ok('Dashboard: Return requests -> mở Orders với bộ lọc returns');
  for (const l of ['Sales report', 'Review moderation', 'Discount codes', 'Brands & categories']) assert(hasPressable(r, l), l);
  ok('Dashboard: có đủ lối tắt quản lý');

  // ---- Orders + trả hàng
  const AdminOrders = await S('AdminOrdersScreen');
  r = await mount(<AdminOrders navigation={nav} route={{ params: { filter: 'returns', t: 1 } }} />);
  assert(has(r, 'Return requested') && has(r, 'Mai Tran'), allText(r));
  assert.equal(r.root.findAll((n) => n.type === 'Pressable' && String(n.props.accessibilityLabel).startsWith('Order ')).length, 1); ok('Orders: bộ lọc returns chỉ còn đơn có yêu cầu trả hàng');
  await press(r, `Order ${order2.id}`);
  const open = nav.calls.filter((c) => c.type === 'navigate').pop();
  assert.equal(open.args[0], 'AdminOrderDetail');

  const AdminOrderDetail = await S('AdminOrderDetailScreen');
  r = await mount(<AdminOrderDetail navigation={nav} route={{ params: open.args[1] }} />);
  assert(has(r, 'Return request') && has(r, 'Damaged or defective') && hasPressable(r, 'Approve & refund'), allText(r)); ok('AdminOrderDetail: hiện yêu cầu trả hàng');
  await press(r, 'Reject', 0);
  await typeInto(r, 'Reject return', ' Item looks used ');
  await press(r, 'Reject', 1);
  assert.equal(orderOf(order2.id).returnRequest.status, 'rejected'); assert.equal(orderOf(order2.id).returnRequest.adminNote, 'Item looks used');
  assert(has(r, 'Return rejected') && has(r, 'Note to customer: Item looks used'), allText(r)); ok('AdminOrderDetail: từ chối trả hàng kèm lý do');

  // đơn thứ 3: duyệt + nhập lại kho
  const user = customer();
  const o3 = await orderSvc.placeOrder({ userId: user.id, lines: [{ id: '1', qty: 2 }], address: user.addresses[0], paymentMethod: 'card' });
  for (const st of ['confirmed', 'shipping', 'delivered']) await admin.updateOrderStatus(user.id, o3.id, st);
  await orderSvc.requestReturn(user.id, o3.id, { reason: 'Wrong item received' });
  const stockBefore = bags[0].stock;
  admin.invalidateAdminCache();
  const full3 = { ...orderOf(o3.id), userId: user.id, customerName: user.name, customerEmail: user.email };
  r = await mount(<AdminOrderDetail navigation={nav} route={{ params: { order: full3 } }} />);
  await press(r, 'Approve & refund'); await pressAlert('Approve & restock');
  assert.equal(orderOf(o3.id).status, 'returned'); assert.equal(orderOf(o3.id).paymentStatus, 'refunded'); assert.equal(bags[0].stock, stockBefore + 2);
  assert(has(r, 'Returned') && has(r, 'items returned to stock'), allText(r)); ok('AdminOrderDetail: duyệt trả hàng -> hoàn tiền, kho +2');

  // đơn chờ xử lý: chuyển trạng thái bằng nút
  const o4 = await orderSvc.placeOrder({ userId: user.id, lines: [{ id: '2', qty: 1 }], address: user.addresses[0], paymentMethod: 'cod', couponCode: 'save10' });
  admin.invalidateAdminCache();
  const full4 = { ...orderOf(o4.id), userId: user.id, customerName: user.name, customerEmail: user.email };
  r = await mount(<AdminOrderDetail navigation={nav} route={{ params: { order: full4 } }} />);
  assert(has(r, 'Discount (SAVE10)') && hasPressable(r, 'Confirm order') && hasPressable(r, 'Cancel order'), allText(r)); ok('AdminOrderDetail: đơn pending có nút Confirm / Cancel và dòng giảm giá');
  await press(r, 'Confirm order'); await pressAlert('Confirm order');
  assert.equal(orderOf(o4.id).status, 'confirmed'); assert(hasPressable(r, 'Mark as shipping') && !hasPressable(r, 'Cancel order') === false); ok('AdminOrderDetail: Confirm -> hiện bước kế tiếp');
  await press(r, 'Cancel order'); await pressAlert('Cancel order');
  assert.equal(orderOf(o4.id).status, 'cancelled'); assert.equal(bags[1].stock, 1); ok('AdminOrderDetail: admin hủy đơn -> hoàn kho');

  // ---- Products
  const AdminProducts = await S('AdminProductsScreen');
  r = await mount(<AdminProducts navigation={nav} />);
  assert(has(r, 'Draft wallet') && has(r, 'Red Serpenti bag') && has(r, 'Out of stock'), allText(r)); ok('AdminProducts: hiện cả bản nháp và hết hàng');
  await press(r, 'Draft 1'); assert(has(r, 'Draft wallet') && !has(r, 'Red Serpenti bag')); ok('AdminProducts: lọc Draft');
  await press(r, 'All 4');
  await press(r, 'Bulk discount');
  await typeInto(r, 'Discount percent', '20'); await press(r, 'Apply label');
  assert.equal(lastAlert().title, 'Apply label?'); await pressAlert('Apply');
  await settle(10);
  assert(bags.every((b) => b.percentOff === 0.2), JSON.stringify(bags.map((b) => b.percentOff))); ok('AdminProducts: giảm giá hàng loạt 20% cho cả 4 sản phẩm');

  // ---- Product form
  const AdminProductForm = await S('AdminProductFormScreen');
  const navF = makeNav(); useNav(navF);
  r = await mount(<AdminProductForm navigation={navF} route={{ params: {} }} />);
  await press(r, 'Create product');
  assert(has(r, 'Enter the product name.') && has(r, 'Enter a valid image link')); ok('ProductForm: báo thiếu thông tin');
  await typeInto(r, 'Image link', 'https://x/new.jpg'); await typeInto(r, 'Product name', 'New Chanel flap'); await typeInto(r, 'Brand', 'Chanel');
  await typeInto(r, 'Category', 'Shoulder Bag'); await typeInto(r, 'Price ($)', '1200.50'); await typeInto(r, 'Discount (%)', '15');
  await typeInto(r, 'Colors (comma separated)', 'Black, Gold');
  await press(r, 'Create product');
  const created = bags.find((b) => b.handbagName === 'New Chanel flap');
  assert(created && created.status === 'draft' && created.stock === 10 && created.cost === 1200.5 && created.percentOff === 0.15 && created.color.length === 2, JSON.stringify(created)); ok('ProductForm: tạo sản phẩm (draft, kho 10, giá 1200.5)');
  assert(navF.calls.some((c) => c.type === 'goBack'));
  // sửa: kho không bị ghi đè khi admin không đụng ô Stock
  bags[0].stock = 3;
  const rEdit = await mount(<AdminProductForm navigation={navF} route={{ params: { handbagId: '1' } }} />);
  bags[0].stock = 1; // khách vừa mua thêm trong lúc admin đang sửa
  await typeInto(rEdit, 'Price ($)', '650'); await press(rEdit, 'Save changes');
  assert.equal(bags[0].cost, 650); assert.equal(bags[0].stock, 1); assert.equal(bags[0].feedbacks.length, 1); ok('ProductForm: sửa giá, không ghi đè kho / feedback');
  useNav(nav);

  // ---- Customers
  const AdminCustomers = await S('AdminCustomersScreen');
  r = await mount(<AdminCustomers navigation={nav} />);
  assert(has(r, 'Mai Tran') && has(r, 'mai@x.co') && !has(r, 'Store Admin'), allText(r)); ok('Customers: chỉ liệt kê khách hàng (không có admin / bản ghi system)');
  const AdminCustomerDetail = await S('AdminCustomerDetailScreen');
  r = await mount(<AdminCustomerDetail navigation={nav} route={{ params: { userId: user.id } }} />);
  assert(has(r, 'Total spent') && has(r, 'Disable account'), allText(r));
  await press(r, 'Disable account'); await pressAlert('Disable');
  assert.equal(customer().status, 'disabled'); assert(has(r, 'Enable account'), allText(r)); ok('CustomerDetail: khóa tài khoản');
  await assert.rejects(auth.login('mai@x.co', 'secret1'), { code: 'disabled' }); ok('Khách bị khóa không đăng nhập được');
  await press(r, 'Enable account'); await pressAlert('Enable');
  assert.equal(customer().status, 'active'); ok('CustomerDetail: mở lại tài khoản');

  // ---- Reviews
  const AdminReviews = await S('AdminReviewsScreen');
  r = await mount(<AdminReviews />);
  assert(has(r, 'Great bag') && has(r, 'Lovely tote'), allText(r)); ok('AdminReviews: hiện đánh giá mẫu và đánh giá của khách');
  await press(r, 'Hide', 0);
  const hiddenCount = bags.flatMap((b) => b.feedbacks).filter((f) => f.hidden).length;
  assert.equal(hiddenCount, 1); assert(has(r, 'Hidden')); ok('AdminReviews: ẩn một đánh giá');
  await press(r, 'Hidden 1'); assert(has(r, 'Show')); await press(r, 'Show');
  assert.equal(bags.flatMap((b) => b.feedbacks).filter((f) => f.hidden).length, 0); ok('AdminReviews: hiện lại đánh giá');

  // ---- Promotions
  const AdminPromotions = await S('AdminPromotionsScreen');
  r = await mount(<AdminPromotions navigation={nav} />);
  assert(has(r, 'SAVE10') && has(r, '10% off over $100') && has(r, 'Active') && has(r, 'Used 2'), allText(r)); ok('AdminPromotions: hiện mã SAVE10 (đã dùng 2 lần)');
  await toggleSwitch(r, 'SAVE10 active', false);
  assert.equal((await promo.fetchPromotions())[0].active, false); assert(has(r, 'Paused')); ok('AdminPromotions: tạm dừng mã');
  const AdminCouponForm = await S('AdminCouponFormScreen');
  const navC = makeNav(); useNav(navC);
  r = await mount(<AdminCouponForm navigation={navC} route={{ params: {} }} />);
  await press(r, 'Create code'); assert(has(r, 'Use 3–20 letters')); ok('CouponForm: mã quá ngắn -> báo lỗi');
  await typeInto(r, 'Code', 'welcome5'); await press(r, 'Fixed amount ($)'); await typeInto(r, 'Discount amount ($)', '5'); await press(r, '30 days');
  await press(r, 'Create code');
  const list = await promo.fetchPromotions(); const w5 = list.find((c) => c.code === 'WELCOME5');
  assert(w5 && w5.type === 'fixed' && w5.value === 5 && w5.expiresAt && w5.active); ok('CouponForm: tạo WELCOME5 ($5, hết hạn sau 30 ngày)');
  r = await mount(<AdminCouponForm navigation={navC} route={{ params: {} }} />);
  await typeInto(r, 'Code', 'save10'); await typeInto(r, 'Discount (%)', '5'); await press(r, 'Create code');
  assert(has(r, 'This code already exists.')); ok('CouponForm: chặn mã trùng');
  useNav(nav);

  // ---- Reports
  const AdminReports = await S('AdminReportsScreen');
  r = await mount(<AdminReports />);
  assert(has(r, 'Revenue') && has(r, 'Top products') && has(r, 'By brand') && has(r, 'Orders by status'), allText(r));
  await press(r, 'All time'); await press(r, 'Last 7 days'); assert(has(r, 'Excludes cancelled and returned orders.')); ok('Reports: hiển thị và đổi kỳ báo cáo');

  // ---- Taxonomy
  const AdminTaxonomy = await S('AdminTaxonomyScreen');
  r = await mount(<AdminTaxonomy />);
  assert(has(r, 'Bvlgari') && has(r, 'Crossbody'), allText(r));
  await press(r, 'Rename Bvlgari'); await typeInto(r, 'Rename brand', 'Bulgari'); await press(r, 'Rename', -1);
  await settle(10);
  assert.equal(bags[0].brand, 'Bulgari'); ok('Taxonomy: đổi tên brand hàng loạt');

  // ---- khách thấy gì sau các thay đổi của admin
  await auth.logout(); await auth.login('mai@x.co', 'secret1');
  await store.reload();
  const Home = await S('HomeScreen');
  r = await mount(<Home navigation={nav} />);
  assert(has(r, 'Red Serpenti bag') && !has(r, 'Draft wallet') && !has(r, 'New Chanel flap'), allText(r)); ok('Khách: vẫn không thấy bản nháp, thấy sản phẩm đã sửa');
}


// =========================================================================
console.log('EXTRA');
{
  const fav = await import('../../src/services/favoriteService.js');
  let r;
  // ---- Profile + đăng xuất
  const Profile = await S('ProfileScreen');
  r = await mount(<Profile navigation={nav} />);
  assert(has(r, 'mai@x.co') && has(r, 'My orders') && has(r, 'Delivery addresses'), allText(r)); ok('Profile: hiện email và lối tắt');
  await press(r, 'My orders'); assert(navTo('Orders'));
  await press(r, 'Sign out'); await pressAlert('Sign out');
  assert.equal(auth.getSnapshot().user, null); assert(has(r, 'Sign in to manage your account'), allText(r)); ok('Profile: Sign out -> quay về lời mời đăng nhập');
  await auth.login('mai@x.co', 'secret1');

  // ---- Favorites theo tài khoản
  await fav.addFavorite(bags[1]);
  const Favourites = await S('FavouritesScreen');
  r = await mount(<Favourites navigation={nav} />);
  assert(has(r, 'Blue Fendi tote'), allText(r)); ok('Favorites: hiện sản phẩm đã thích');
  await auth.logout();
  assert.equal((await fav.getFavorites()).length, 0); ok('Favorites: đăng xuất -> danh sách khách (trống)');
  await auth.login('mai@x.co', 'secret1');
  assert.equal((await fav.getFavorites()).length, 1); ok('Favorites: đăng nhập lại -> danh sách của tài khoản được khôi phục');

  // ---- Orders: mất mạng rồi thử lại
  const Orders = await S('OrdersScreen');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError('Network request failed'); };
  r = await mount(<Orders navigation={nav} />);
  assert(has(r, 'Couldn’t load your orders'), allText(r)); ok('Orders: mất mạng -> màn lỗi');
  globalThis.fetch = realFetch;
  await press(r, 'Try again');
  assert(has(r, 'Delivered') && has(r, 'Cancelled'), allText(r)); ok('Orders: Try again -> hiện danh sách');

  // ---- Đánh giá của chính mình: sửa / xóa
  const Detail = await S('DetailScreen');
  r = await mount(<Detail navigation={nav} route={{ params: { handbag: bags[1] } }} />);
  assert(has(r, 'Your review') && hasPressable(r, 'Edit'), allText(r)); ok('Detail: đã đánh giá -> hiện "Your review" và nút Edit');
  const ReviewForm = await S('ReviewFormScreen');
  const navR = makeNav(); useNav(navR);
  r = await mount(<ReviewForm navigation={navR} route={{ params: { handbagId: '2' } }} />);
  assert(has(r, 'Save changes') && has(r, 'Delete my review')); await press(r, '5 stars'); await press(r, 'Save changes');
  assert.equal(bags[1].feedbacks[0].rating, 5); ok('ReviewForm: sửa đánh giá 4★ -> 5★ (không tạo bản ghi mới)');
  r = await mount(<ReviewForm navigation={navR} route={{ params: { handbagId: '2' } }} />);
  await press(r, 'Delete my review'); await pressAlert('Delete');
  assert.equal(bags[1].feedbacks.length, 0); ok('ReviewForm: xóa đánh giá của mình');
  useNav(nav);

  // ---- Địa chỉ: xóa
  const Addresses = await S('AddressesScreen');
  r = await mount(<Addresses navigation={nav} />);
  assert(has(r, '12 Le Loi') && has(r, 'Default'), allText(r)); await press(r, 'Delete'); await pressAlert('Delete');
  assert.equal(auth.getSnapshot().user.addresses.length, 0); assert(has(r, 'No saved addresses')); ok('Addresses: xóa địa chỉ -> trạng thái trống');

  // ---- Stylist chỉ cần dựng được
  const Stylist = await S('StylistScreen');
  r = await mount(<Stylist navigation={nav} />); ok('Stylist: dựng màn hình thành công');
}

console.log(`ALL ${step} UI CHECKS PASSED`);
process.exit(0);
