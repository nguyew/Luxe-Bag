/**
 * adminService – các thao tác của quản trị viên.
 *
 * Không có database thật nên admin đọc/ghi thẳng MockAPI:
 *  - Sản phẩm: resource `handbags`.
 *  - Đơn hàng & khách hàng: resource `users` (đơn nằm trong `users.orders`).
 *
 * Mọi thao tác ghi đều ĐỌC bản mới nhất rồi mới ghi lại, để không làm mất dữ
 * liệu khách vừa thay đổi (feedbacks, đơn mới...). Tuy vậy MockAPI không có
 * transaction: nếu khách và admin ghi vào cùng một bản ghi trong cùng một
 * khoảnh khắc, bản ghi sau cùng sẽ thắng.
 */
import { api } from './api';
import { removeHandbag, upsertHandbag } from './handbagStore';
import { OrderError, restoreOrderStock } from './orderService';
import { toPublicUser } from './userService';
import { nextStatuses } from '../utils/orders';

const asArray = (value) => (Array.isArray(value) ? value : []);
const handbagPath = (id) => `handbags/${encodeURIComponent(id)}`;
const userPath = (id) => `users/${encodeURIComponent(id)}`;

// ---------------------------------------------------------------------------
// Dữ liệu người dùng + đơn hàng (có bộ nhớ đệm ngắn để chuyển tab không phải chờ)
// ---------------------------------------------------------------------------
const USERS_CACHE_MS = 15 * 1000;
let usersCache = null;
let usersCachedAt = 0;
let usersInflight = null;

/** Dữ liệu đã có trong bộ nhớ đệm (nếu có) để hiển thị ngay. */
export const peekAdminUsers = () => usersCache;

/** Xóa bộ nhớ đệm: gọi sau mỗi thao tác ghi để lần tải kế tiếp lấy dữ liệu mới. */
export function invalidateAdminCache() {
  usersCache = null;
  usersCachedAt = 0;
}

/**
 * Tất cả tài khoản kèm mảng `orders`. Không bao giờ trả về passwordHash/salt.
 * `force` = true: bỏ qua bộ nhớ đệm.
 */
export function fetchAdminUsers({ force = false } = {}) {
  if (!force && usersCache && Date.now() - usersCachedAt < USERS_CACHE_MS) {
    return Promise.resolve(usersCache);
  }
  if (usersInflight) return usersInflight;

  usersInflight = (async () => {
    try {
      let list;
      try {
        list = await api.get('users');
      } catch (error) {
        if (error?.status === 404) list = []; // MockAPI trả 404 khi chưa có bản ghi nào
        else throw error;
      }

      usersCache = (Array.isArray(list) ? list : []).map((record) => ({
        ...toPublicUser(record),
        orders: asArray(record.orders),
      }));
      usersCachedAt = Date.now();
      return usersCache;
    } finally {
      usersInflight = null;
    }
  })();

  return usersInflight;
}

// ---------------------------------------------------------------------------
// Sản phẩm
// ---------------------------------------------------------------------------
const PRODUCT_FIELDS = [
  'handbagName',
  'brand',
  'category',
  'cost',
  'percentOff',
  'color',
  'gender',
  'uri',
  'stock',
  'status',
];

// Chỉ nhận các trường sản phẩm hợp lệ (không để lọt id, feedbacks...)
function pickProduct(data) {
  const picked = {};
  PRODUCT_FIELDS.forEach((key) => {
    if (data[key] !== undefined) picked[key] = data[key];
  });
  return picked;
}

/** Tạo sản phẩm mới. */
export async function createHandbag(data) {
  const created = await api.post('handbags', { feedbacks: [], ...pickProduct(data) });
  upsertHandbag(created);
  return created;
}

/** Sửa sản phẩm: chỉ ghi đè các trường được truyền vào, giữ nguyên phần còn lại (feedbacks...). */
export async function updateHandbag(id, data) {
  const path = handbagPath(id);
  const record = await api.get(path);
  const saved = await api.put(path, { ...record, ...pickProduct(data) });
  upsertHandbag(saved);
  return saved;
}

/** Xóa hẳn sản phẩm (muốn giữ lại thì chuyển status sang 'archived'). */
export async function deleteHandbag(id) {
  await api.delete(handbagPath(id));
  removeHandbag(id);
}

/**
 * Đặt % giảm giá cho nhiều sản phẩm. percentOff là số thập phân (0.2 = 20%).
 * Trả về { updated, failed: [id...] } – một sản phẩm lỗi không làm dừng cả lô.
 */
export async function applyBulkDiscount(ids, percentOff) {
  let updated = 0;
  const failed = [];
  for (const id of ids) {
    try {
      await updateHandbag(id, { percentOff });
      updated += 1;
    } catch {
      failed.push(id);
    }
  }
  return { updated, failed };
}

// ---------------------------------------------------------------------------
// Đơn hàng
// ---------------------------------------------------------------------------
/**
 * Chuyển trạng thái đơn của một khách.
 * Kiểm tra bước chuyển hợp lệ trên bản MỚI NHẤT (khách có thể vừa hủy đơn).
 * Hủy đơn thì hoàn lại tồn kho; giao thành công đơn COD thì ghi nhận đã thanh toán.
 */
export async function updateOrderStatus(userId, orderId, nextStatus) {
  try {
    const path = userPath(userId);
    const record = await api.get(path);
    const orders = asArray(record.orders);
    const index = orders.findIndex((order) => order.id === orderId);

    if (index < 0) throw new OrderError('not_found');
    const order = orders[index];
    if (!nextStatuses(order.status).includes(nextStatus)) {
      throw new OrderError('invalid_transition');
    }

    const now = new Date().toISOString();
    const updated = {
      ...order,
      status: nextStatus,
      history: [...asArray(order.history), { status: nextStatus, at: now }],
    };
    if (nextStatus === 'delivered' && order.paymentMethod === 'cod') {
      updated.paymentStatus = 'paid';
    }
    if (nextStatus === 'cancelled') {
      updated.cancelledAt = now;
      if (order.paymentStatus === 'paid') updated.paymentStatus = 'refunded';
    }

    await api.put(path, {
      ...record,
      orders: orders.map((item, i) => (i === index ? updated : item)),
    });
    invalidateAdminCache();

    if (nextStatus === 'cancelled') await restoreOrderStock(order);
    return updated;
  } catch (error) {
    if (error instanceof OrderError) throw error;
    throw new OrderError('network');
  }
}

// ---------------------------------------------------------------------------
// Khách hàng
// ---------------------------------------------------------------------------
/** Khóa ('disabled') hoặc mở lại ('active') một tài khoản khách hàng. */
export async function setCustomerStatus(userId, status) {
  if (status !== 'active' && status !== 'disabled') {
    throw new Error('Invalid status.');
  }

  const path = userPath(userId);
  const record = await api.get(path);
  if (record.role === 'admin') throw new Error('Admin accounts cannot be changed here.');

  const saved = await api.put(path, { ...record, status });
  invalidateAdminCache();
  return toPublicUser(saved);
}
