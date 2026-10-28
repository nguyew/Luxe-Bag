/**
 * Quy tắc về đơn hàng: phí ship, tổng tiền, trạng thái, phương thức thanh toán.
 *
 * Trạng thái: pending -> confirmed -> shipping -> delivered
 *             pending -> cancelled (khách hủy được khi còn "pending")
 */
export const SHIPPING_FEE = 15;
export const FREE_SHIPPING_THRESHOLD = 500;

export const round2 = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/** Miễn phí ship từ FREE_SHIPPING_THRESHOLD USD. */
export function calcShipping(subtotal) {
  if (!(subtotal > 0)) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
}

/**
 * lines: [{ unitPrice, qty }], discount: số tiền giảm (mã giảm giá)
 * -> { subtotal, discount, shipping, total }
 * Miễn phí ship tính trên tiền hàng SAU khi giảm.
 */
export function calcTotals(lines, discount = 0) {
  const subtotal = round2(
    lines.reduce((sum, line) => sum + Number(line.unitPrice) * Number(line.qty), 0)
  );
  const applied = round2(Math.min(Math.max(Number(discount) || 0, 0), subtotal));
  const afterDiscount = round2(subtotal - applied);
  const shipping = calcShipping(afterDiscount);
  return { subtotal, discount: applied, shipping, total: round2(afterDiscount + shipping) };
}

export const ORDER_FLOW = ['pending', 'confirmed', 'shipping', 'delivered'];

export const ORDER_STATUS = {
  pending: { label: 'Pending', color: '#8A5A00', bg: '#FFF1D6', icon: 'time-outline' },
  confirmed: { label: 'Confirmed', color: '#1F5FA8', bg: '#E1EDFB', icon: 'checkmark-circle-outline' },
  shipping: { label: 'Shipping', color: '#5B3FA8', bg: '#ECE6FB', icon: 'car-outline' },
  delivered: { label: 'Delivered', color: '#1F7A3E', bg: '#DFF3E5', icon: 'gift-outline' },
  cancelled: { label: 'Cancelled', color: '#B3261E', bg: '#FBE3E1', icon: 'close-circle-outline' },
  returned: { label: 'Returned', color: '#55514C', bg: '#E7E3DF', icon: 'return-up-back-outline' },
};

export const statusMeta = (status) => ORDER_STATUS[status] || ORDER_STATUS.pending;

/**
 * Cửa hàng được phép chuyển đơn sang những trạng thái nào.
 * (delivered và cancelled là trạng thái cuối)
 */
export const NEXT_STATUS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const nextStatuses = (status) => NEXT_STATUS[status] || [];

/** Chữ trên nút hành động của admin. */
export const STATUS_ACTION_LABEL = {
  confirmed: 'Confirm order',
  shipping: 'Mark as shipping',
  delivered: 'Mark as delivered',
  cancelled: 'Cancel order',
};

/** Khách chỉ hủy được đơn chưa được cửa hàng xác nhận. */
export const canCancel = (order) => order?.status === 'pending';

export const PAYMENT_METHODS = {
  cod: { label: 'Cash on delivery', hint: 'Pay when your order arrives.', icon: 'cash-outline' },
  card: { label: 'Credit card (demo)', hint: 'Simulated payment – no real charge.', icon: 'card-outline' },
};

export const paymentLabel = (method) => PAYMENT_METHODS[method]?.label || 'Unknown';

export function generateOrderId() {
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `LB-${time}${rand}`;
}

/**
 * Short, readable order code for screens, e.g. "LB-B9DE3C24".
 * The database id is a 24-character ObjectId: too long to display. The last 8 characters change
 * with every order, so they are enough to tell orders apart (and to search for in Admin).
 * Ids that already start with "LB-" (older local orders) are returned unchanged.
 */
export function formatOrderCode(id) {
  const raw = String(id ?? '').trim();
  if (!raw) return '';
  if (/^LB-/i.test(raw)) return raw.toUpperCase();
  return `LB-${raw.slice(-8).toUpperCase()}`;
}

export function formatOrderDate(iso) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  return new Date(time).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Trả hàng & hoàn tiền
// ---------------------------------------------------------------------------
export const RETURN_WINDOW_DAYS = 7;

export const RETURN_REASONS = [
  'Damaged or defective',
  'Wrong item received',
  'Not as described',
  'Changed my mind',
  'Other',
];

export const RETURN_STATUS = {
  requested: { label: 'Return requested', color: '#8A5A00', bg: '#FFF1D6' },
  approved: { label: 'Return approved', color: '#1F7A3E', bg: '#DFF3E5' },
  rejected: { label: 'Return rejected', color: '#B3261E', bg: '#FBE3E1' },
};

/** Thời điểm giao hàng thành công (lấy từ lịch sử trạng thái). */
export function deliveredAt(order) {
  const entry = (Array.isArray(order?.history) ? order.history : [])
    .filter((item) => item.status === 'delivered')
    .pop();
  return entry?.at || order?.createdAt || null;
}

/** Hạn cuối để yêu cầu trả hàng (ms), hoặc null. */
export function returnDeadline(order) {
  const time = Date.parse(deliveredAt(order));
  return Number.isNaN(time) ? null : time + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/** Khách chỉ yêu cầu trả hàng được khi đơn đã giao, chưa từng yêu cầu, và còn trong hạn. */
export function canRequestReturn(order, now = Date.now()) {
  if (!order || order.status !== 'delivered' || order.returnRequest) return false;
  const deadline = returnDeadline(order);
  return deadline !== null && now <= deadline;
}

export const hasOpenReturn = (order) => order?.returnRequest?.status === 'requested';