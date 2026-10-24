/**
 * orderService – đặt hàng, xem đơn, hủy đơn.
 *
 * Không có database thật nên:
 *  - Đơn hàng được lưu trong mảng `orders` của chính user (resource `users`).
 *  - Tồn kho nằm ở trường `stock` của từng túi (resource `handbags`).
 *
 * Đặt hàng làm lần lượt: (1) kiểm tra lại tồn kho/giá với dữ liệu MỚI NHẤT từ
 * API, (2) trừ kho, (3) ghi đơn vào user. Nếu bước 3 hỏng thì hoàn lại kho.
 * LƯU Ý: MockAPI không có transaction, hai người đặt cùng lúc món cuối cùng
 * vẫn có thể làm kho sai. Chấp nhận được với bài tập, nên ghi rõ trong báo cáo.
 */
import { api } from './api';
import { fetchPromotions, redeemCoupon } from './promotionService';
import { getStock, isPublished, unitPrice } from '../utils/catalog';
import { describeCouponError, validateCoupon } from '../utils/coupons';
import {
  PAYMENT_METHODS,
  RETURN_REASONS,
  calcTotals,
  canCancel,
  canRequestReturn,
  generateOrderId,
} from '../utils/orders';

export class OrderError extends Error {
  constructor(code, message, details) {
    super(message || code);
    this.name = 'OrderError';
    this.code = code;
    this.details = details || [];
  }
}

/** Thông báo thân thiện để hiển thị cho người dùng. */
export function describeOrderError(error) {
  switch (error?.code) {
    case 'empty':
      return 'Your bag is empty.';
    case 'no_address':
      return 'Please choose a delivery address.';
    case 'invalid_input':
      return error.message;
    case 'unavailable':
      return 'Some items are no longer available in the requested quantity. Please review your bag.';
    case 'not_found':
      return 'We could not find this order.';
    case 'invalid_coupon':
      return error.message;
    case 'return_not_allowed':
      return 'This order is no longer eligible for a return.';
    case 'invalid_return':
      return 'This return request has already been handled.';
    case 'invalid_transition':
      return 'This order status can no longer be changed that way. It may have been updated already.';
    case 'not_cancellable':
      return 'This order can no longer be cancelled because the store has already processed it.';
    case 'network':
    default:
      return 'Could not reach the server. Check your connection and try again.';
  }
}

const handbagPath = (id) => `handbags/${encodeURIComponent(id)}`;
const userPath = (id) => `users/${encodeURIComponent(id)}`;

async function fetchHandbag(id) {
  try {
    return await api.get(handbagPath(id));
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
}

// Cộng/trừ tồn kho theo bản ghi MỚI NHẤT. Sản phẩm không theo dõi kho thì bỏ qua.
async function adjustStock(id, delta) {
  const record = await fetchHandbag(id);
  if (!record) return;
  const stock = getStock(record);
  if (stock === null) return;
  await api.put(handbagPath(id), { ...record, stock: Math.max(0, stock + delta) });
}

// Hoàn kho tốt nhất có thể: lỗi từng món không làm dừng các món còn lại
async function restoreStock(entries) {
  for (const entry of entries) {
    try {
      await adjustStock(entry.id, entry.qty);
    } catch {
      // bỏ qua
    }
  }
}

const asArray = (value) => (Array.isArray(value) ? value : []);

/** Hoàn lại tồn kho cho tất cả sản phẩm trong một đơn (dùng khi đơn bị hủy). */
export async function restoreOrderStock(order) {
  await restoreStock(
    asArray(order?.items).map((item) => ({ id: item.handbagId, qty: item.qty }))
  );
}

function sortNewestFirst(orders) {
  return [...orders].sort(
    (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
  );
}

/**
 * Đặt hàng.
 *  - userId, address (object địa chỉ), paymentMethod ('cod' | 'card'), couponCode (tùy chọn)
 *  - lines: [{ id, qty }] lấy từ giỏ hàng
 * Trả về đơn hàng đã lưu. Ném OrderError nếu có vấn đề
 * (code 'unavailable' kèm `details` = [{ id, name, reason, available }]).
 */
export async function placeOrder({ userId, lines, address, paymentMethod, couponCode }) {
  if (!Array.isArray(lines) || lines.length === 0) throw new OrderError('empty');
  if (!address) throw new OrderError('no_address');
  if (!PAYMENT_METHODS[paymentMethod]) {
    throw new OrderError('invalid_input', 'Please choose a payment method.');
  }

  try {
    // 1) Kiểm tra lại với dữ liệu mới nhất
    const checked = [];
    const problems = [];
    for (const line of lines) {
      const record = await fetchHandbag(line.id);
      const name = record?.handbagName || 'Unknown item';

      if (!record || !isPublished(record)) {
        problems.push({ id: String(line.id), name, reason: 'unavailable', available: 0 });
        continue;
      }
      const stock = getStock(record);
      if (stock !== null && stock < line.qty) {
        problems.push({
          id: String(line.id),
          name,
          reason: stock === 0 ? 'sold_out' : 'insufficient',
          available: stock,
        });
        continue;
      }
      checked.push({ record, qty: line.qty, stock });
    }
    if (problems.length > 0) {
      throw new OrderError('unavailable', 'Items unavailable', problems);
    }

    // 2) Chốt giá tại thời điểm đặt hàng, rồi áp mã giảm giá (kiểm tra lại với dữ liệu mới nhất)
    const items = checked.map((entry) => ({
      handbagId: String(entry.record.id),
      name: entry.record.handbagName,
      brand: entry.record.brand || '',
      uri: entry.record.uri || '',
      unitPrice: unitPrice(entry.record),
      qty: entry.qty,
    }));

    let coupon = null;
    let discount = 0;
    if (couponCode) {
      const result = validateCoupon(await fetchPromotions(), couponCode, calcTotals(items).subtotal);
      if (!result.ok) throw new OrderError('invalid_coupon', describeCouponError(result));
      coupon = result.coupon;
      discount = result.discount;
    }
    const totals = calcTotals(items, discount);

    // 3) Trừ kho (hoàn lại nếu một món bị lỗi)
    const taken = [];
    try {
      for (const entry of checked) {
        if (entry.stock === null) continue;
        await api.put(handbagPath(entry.record.id), {
          ...entry.record,
          stock: entry.stock - entry.qty,
        });
        taken.push({ id: entry.record.id, qty: entry.qty });
      }
    } catch (error) {
      await restoreStock(taken);
      throw error;
    }

    // 4) Ghi đơn vào user
    const now = new Date().toISOString();
    const order = {
      id: generateOrderId(),
      createdAt: now,
      status: 'pending',
      items,
      ...totals,
      address: {
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        city: address.city,
      },
      couponCode: coupon ? coupon.code : null,
      paymentMethod,
      paymentStatus: paymentMethod === 'card' ? 'paid' : 'unpaid',
      history: [{ status: 'pending', at: now }],
    };

    try {
      const record = await api.get(userPath(userId));
      await api.put(userPath(userId), {
        ...record,
        orders: [order, ...asArray(record.orders)],
      });
    } catch (error) {
      await restoreStock(taken);
      throw error;
    }

    if (coupon) await redeemCoupon(coupon.id); // ghi nhận lượt dùng (không bao giờ ném lỗi)
    return order;
  } catch (error) {
    if (error instanceof OrderError) throw error;
    throw new OrderError('network');
  }
}

/** Danh sách đơn của user, mới nhất trước. */
export async function getMyOrders(userId) {
  try {
    const record = await api.get(userPath(userId));
    return sortNewestFirst(asArray(record.orders));
  } catch (error) {
    throw error instanceof OrderError ? error : new OrderError('network');
  }
}

/**
 * Hủy đơn (chỉ khi đang "pending"). Kiểm tra lại với bản MỚI NHẤT trên API
 * vì cửa hàng có thể vừa xác nhận đơn. Hoàn lại tồn kho sau khi hủy.
 */
export async function cancelOrder(userId, orderId) {
  try {
    const record = await api.get(userPath(userId));
    const orders = asArray(record.orders);
    const index = orders.findIndex((order) => order.id === orderId);

    if (index < 0) throw new OrderError('not_found');
    const order = orders[index];
    if (!canCancel(order)) throw new OrderError('not_cancellable');

    const now = new Date().toISOString();
    const updated = {
      ...order,
      status: 'cancelled',
      cancelledAt: now,
      paymentStatus: order.paymentStatus === 'paid' ? 'refunded' : order.paymentStatus,
      history: [...asArray(order.history), { status: 'cancelled', at: now }],
    };

    await api.put(userPath(userId), {
      ...record,
      orders: orders.map((item, i) => (i === index ? updated : item)),
    });

    await restoreOrderStock(order);
    return updated;
  } catch (error) {
    if (error instanceof OrderError) throw error;
    throw new OrderError('network');
  }
}

/**
 * Khách yêu cầu trả hàng cho đơn đã giao (trong RETURN_WINDOW_DAYS ngày, mỗi đơn một lần).
 * Kiểm tra lại trên dữ liệu mới nhất. Trả về đơn đã cập nhật.
 */
export async function requestReturn(userId, orderId, { reason, note }) {
  if (!RETURN_REASONS.includes(reason)) {
    throw new OrderError('invalid_input', 'Please choose a reason for the return.');
  }

  try {
    const record = await api.get(userPath(userId));
    const orders = asArray(record.orders);
    const index = orders.findIndex((order) => order.id === orderId);

    if (index < 0) throw new OrderError('not_found');
    const order = orders[index];
    if (!canRequestReturn(order)) throw new OrderError('return_not_allowed');

    const updated = {
      ...order,
      returnRequest: {
        status: 'requested',
        reason,
        note: String(note ?? '').trim().slice(0, 300),
        requestedAt: new Date().toISOString(),
      },
    };
    await api.put(userPath(userId), {
      ...record,
      orders: orders.map((item, i) => (i === index ? updated : item)),
    });
    return updated;
  } catch (error) {
    if (error instanceof OrderError) throw error;
    throw new OrderError('network');
  }
}
