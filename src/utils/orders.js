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

/** lines: [{ unitPrice, qty }] -> { subtotal, shipping, total } */
export function calcTotals(lines) {
  const subtotal = round2(
    lines.reduce((sum, line) => sum + Number(line.unitPrice) * Number(line.qty), 0)
  );
  const shipping = calcShipping(subtotal);
  return { subtotal, shipping, total: round2(subtotal + shipping) };
}

export const ORDER_FLOW = ['pending', 'confirmed', 'shipping', 'delivered'];

export const ORDER_STATUS = {
  pending: { label: 'Pending', color: '#8A5A00', bg: '#FFF1D6', icon: 'time-outline' },
  confirmed: { label: 'Confirmed', color: '#1F5FA8', bg: '#E1EDFB', icon: 'checkmark-circle-outline' },
  shipping: { label: 'Shipping', color: '#5B3FA8', bg: '#ECE6FB', icon: 'car-outline' },
  delivered: { label: 'Delivered', color: '#1F7A3E', bg: '#DFF3E5', icon: 'gift-outline' },
  cancelled: { label: 'Cancelled', color: '#B3261E', bg: '#FBE3E1', icon: 'close-circle-outline' },
};

export const statusMeta = (status) => ORDER_STATUS[status] || ORDER_STATUS.pending;

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

export function formatOrderDate(iso) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  return new Date(time).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
