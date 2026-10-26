/**
 * adminService – các thao tác của quản trị viên.
 *
 * Admin products use the authenticated backend API:
 *  - Sản phẩm: `/api/admin/products`.
 *  - Khách hàng: authenticated backend API `/api/admin/customers`.
 *  - Đơn hàng: authenticated backend API `/api/admin/orders`.
 *
 * Mọi thao tác ghi đều ĐỌC bản mới nhất rồi mới ghi lại, để không làm mất dữ
 * liệu khách vừa thay đổi (feedbacks, đơn mới...). Tuy vậy MockAPI không có
 * transaction: nếu khách và admin ghi vào cùng một bản ghi trong cùng một
 * khoảnh khắc, bản ghi sau cùng sẽ thắng.
 */
import { api, backendApi, BACKEND_URL } from './api';
import { getAuthToken } from './authToken';
import { removeHandbag, upsertHandbag } from './handbagStore';
import { OrderError } from './orderService';
import { feedbackId } from '../utils/feedback';
import { toPublicUser } from './userService';
import { nextStatuses } from '../utils/orders';

const asArray = (value) => (Array.isArray(value) ? value : []);
const handbagPath = (id) => `api/admin/products/${encodeURIComponent(id)}`;
const userPath = (id) => `users/${encodeURIComponent(id)}`;
const customerPath = (id) => `api/admin/customers/${encodeURIComponent(id)}`;
const customerDisablePath = (id) => `${customerPath(id)}/disable`;
const customerEnablePath = (id) => `${customerPath(id)}/enable`;

export async function uploadProductImage(uri, contentType) {
  if (!BACKEND_URL) {
    throw new Error('Missing EXPO_PUBLIC_BACKEND_URL. Add it to your .env file and restart Expo.');
  }
  const image = await (await fetch(uri)).blob();
  const token = await getAuthToken();
  const response = await fetch(
    `${BACKEND_URL}/api/admin/products/image-upload/proxy`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + token,
        'Content-Type': contentType,
      },
      body: image,
    }
  );
  if (!response.ok) {
    throw new Error(`Image upload failed with status ${response.status}.`);
  }
  const uploaded = await response.json();
  return { imageKey: uploaded.key, uri: uploaded.uri };
}

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
 * Tất cả tài khoản từ backend. Không bao giờ trả về passwordHash/salt.
 * `force` = true: bỏ qua bộ nhớ đệm.
 */
export function fetchAdminUsers({ force = false } = {}) {
  if (!force && usersCache && Date.now() - usersCachedAt < USERS_CACHE_MS) {
    return Promise.resolve(usersCache);
  }
  if (usersInflight) return usersInflight;

  usersInflight = (async () => {
    try {
      const customers = [];
      let page = 1;
      let totalPages = 1;

      do {
        const response = await backendApi.get(`api/admin/customers?page=${page}&limit=100`);
        if (!Array.isArray(response?.customers)) {
          throw new Error('Unexpected response from the admin customers endpoint.');
        }
        customers.push(...response.customers);
        totalPages = Number(response.pagination?.totalPages) || 1;
        page += 1;
      } while (page <= totalPages);

      // Orders live in the Backend Order collection, not embedded in User records.
      // Fetch them separately and attach to each customer for existing Admin screens.
      const orders = [];
      let orderPage = 1;
      let orderTotalPages = 1;
      do {
        const response = await backendApi.get(`api/admin/orders?page=${orderPage}&limit=500`);
        if (!Array.isArray(response?.orders)) {
          throw new Error('Unexpected response from the admin orders endpoint.');
        }
        orders.push(...response.orders);
        orderTotalPages = Number(response.pagination?.totalPages) || 1;
        orderPage += 1;
      } while (orderPage <= orderTotalPages);

      const ordersByUser = new Map();
      orders.forEach((order) => {
        const ownerId = String(order.userId || '');
        if (!ordersByUser.has(ownerId)) ordersByUser.set(ownerId, []);
        ordersByUser.get(ownerId).push(order);
      });

      usersCache = customers.map((record) => {
        const user = toPublicUser(record);
        return {
          ...user,
          orders: (ordersByUser.get(String(user.id)) || []).sort(
            (a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0)
          ),
        };
      });
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
  'originalCost',
  'percentOff',
  'discountMode',
  'color',
  'gender',
  'uri',
  'stock',
  'status',
  'imageKey',
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
  const response = await backendApi.post('api/admin/products', pickProduct(data));
  const created = response.product;
  upsertHandbag(created);
  return created;
}

/** Load every product for the admin catalog, including drafts and archived products. */
export async function fetchAdminProducts() {
  const response = await backendApi.get('api/admin/products');
  if (!Array.isArray(response?.products)) {
    throw new Error('Unexpected response from the admin products endpoint.');
  }
  return response.products;
}

/** Sửa sản phẩm: chỉ ghi đè các trường được truyền vào, giữ nguyên phần còn lại (feedbacks...). */
export async function updateHandbag(id, data) {
  const path = handbagPath(id);
  const record = (await backendApi.get(path)).product;
  const saved = (await backendApi.patch(path, { ...record, ...pickProduct(data) })).product;
  upsertHandbag(saved);
  return saved;
}

/** Xóa hẳn sản phẩm (muốn giữ lại thì chuyển status sang 'archived'). */
export async function deleteHandbag(id) {
  await backendApi.delete(handbagPath(id));
  removeHandbag(id);
}

/**
 * Cập nhật cùng một thay đổi cho nhiều sản phẩm (đổi tên brand/category, giảm giá...).
 * Trả về { updated, failed: [id...] } – một sản phẩm lỗi không làm dừng cả lô.
 */
export async function bulkUpdateHandbags(ids, patch) {
  let updated = 0;
  const failed = [];
  for (const id of ids) {
    try {
      await updateHandbag(id, patch);
      updated += 1;
    } catch {
      failed.push(id);
    }
  }
  return { updated, failed };
}

/**
 * Áp dụng giảm giá theo nhóm. `real` giảm giá bán; `fake` chỉ tạo giá gốc
 * hiển thị cao hơn mà không thay đổi giá bán hiện tại.
 */
export async function applyBulkDiscount({ scope, value, percentOff, discountMode }) {
  const response = await backendApi.post('api/admin/products/bulk-discount', {
    scope,
    ...(scope === 'all' ? {} : { value }),
    percentOff,
    discountMode,
  });
  if (!Number.isInteger(response?.updated) || !Array.isArray(response.products)) {
    throw new Error('Unexpected response from the bulk discount endpoint.');
  }
  response.products.forEach(upsertHandbag);
  return { updated: response.updated, failed: [] };
}

// ---------------------------------------------------------------------------
// Kiểm duyệt đánh giá
// ---------------------------------------------------------------------------
// Đọc bản mới nhất của túi, sửa mảng feedbacks bằng `mutate`, rồi ghi lại
async function mutateFeedbacks(handbagId, mutate) {
  const path = handbagPath(handbagId);
  const record = await api.get(path);
  const saved = await api.put(path, { ...record, feedbacks: mutate(asArray(record.feedbacks)) });
  upsertHandbag(saved);
}

/** Ẩn / hiện một đánh giá (đánh giá bị ẩn không hiện cho khách và không tính điểm trung bình). */
export function setReviewHidden(handbagId, reviewId, hidden) {
  return mutateFeedbacks(handbagId, (list) =>
    list.map((item, index) =>
      feedbackId(item, index) === String(reviewId) ? { ...item, hidden: !!hidden } : item
    )
  );
}

/** Xóa hẳn một đánh giá. */
export function deleteReview(handbagId, reviewId) {
  return mutateFeedbacks(handbagId, (list) =>
    list.filter((item, index) => feedbackId(item, index) !== String(reviewId))
  );
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
    const response = await backendApi.patch(
      `api/admin/orders/${encodeURIComponent(orderId)}/status`,
      { status: nextStatus }
    );
    if (!response?.order) throw new Error('Unexpected response from the admin order endpoint.');
    invalidateAdminCache();
    return response.order;
  } catch (error) {
    const code = error?.data?.code;
    if (code) throw new OrderError(code, error.message, error.data?.details);
    if (error instanceof OrderError) throw error;
    throw new OrderError('network', error?.message || 'Unable to update the order.');
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

  const path = status === 'disabled' ? customerDisablePath(userId) : customerEnablePath(userId);
  const response = await backendApi.patch(path);
  if (!response?.customer) {
    throw new Error('Unexpected response from the admin customer endpoint.');
  }
  invalidateAdminCache();
  return toPublicUser(response.customer);
}

// ---------------------------------------------------------------------------
// Trả hàng & hoàn tiền
// ---------------------------------------------------------------------------
/**
 * Xử lý yêu cầu trả hàng của khách.
 *  - decision 'approve': đơn chuyển sang 'returned', ghi nhận hoàn tiền;
 *    restock = true thì sản phẩm được cộng lại vào kho (hàng còn bán được).
 *  - decision 'reject': giữ nguyên đơn, ghi lý do từ chối cho khách xem.
 */
export async function resolveReturn(userId, orderId, decision, { restock = false, note = '' } = {}) {
  try {
    if (decision !== 'approve' && decision !== 'reject') throw new OrderError('invalid_return');
    const response = await backendApi.patch(
      `api/admin/orders/${encodeURIComponent(orderId)}/return-request`,
      {
        decision,
        restock: decision === 'approve' && !!restock,
        note: String(note ?? '').trim().slice(0, 300),
      }
    );
    if (!response?.order) throw new Error('Unexpected response from the admin return endpoint.');
    invalidateAdminCache();
    return response.order;
  } catch (error) {
    const code = error?.data?.code;
    if (code) throw new OrderError(code, error.message, error.data?.details);
    if (error instanceof OrderError) throw error;
    throw new OrderError('network', error?.message || 'Unable to resolve the return request.');
  }
}
