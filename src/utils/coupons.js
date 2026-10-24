/**
 * Mã giảm giá: kiểm tra, tính tiền giảm. Thuần (không gọi mạng).
 *
 * coupon: { id, code, type: 'percent' | 'fixed', value, minSubtotal,
 *           expiresAt (ISO | null), active, usageLimit (số | null), usedCount }
 */
import { round2 } from './orders';

export const normalizeCode = (code) =>
  String(code ?? '').trim().toUpperCase().replace(/\s+/g, '');

/** Trạng thái của một mã: 'active' | 'inactive' | 'expired' | 'used_up'. */
export function couponStatus(coupon, now = Date.now()) {
  if (!coupon.active) return 'inactive';
  if (coupon.expiresAt && Date.parse(coupon.expiresAt) < now) return 'expired';
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return 'used_up';
  return 'active';
}

/** Số tiền được giảm cho tiền hàng `subtotal` (không bao giờ vượt quá tiền hàng). */
export function calcCouponDiscount(coupon, subtotal) {
  if (!(subtotal > 0)) return 0;
  const raw = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
  return round2(Math.min(Math.max(raw, 0), subtotal));
}

/**
 * Kiểm tra một mã khách nhập.
 * -> { ok: true, coupon, discount }  hoặc  { ok: false, reason, minSubtotal? }
 * reason: 'empty' | 'not_found' | 'inactive' | 'expired' | 'used_up' | 'min_subtotal'
 */
export function validateCoupon(coupons, code, subtotal, now = Date.now()) {
  const normalized = normalizeCode(code);
  if (!normalized) return { ok: false, reason: 'empty' };

  const coupon = coupons.find((item) => item.code === normalized);
  if (!coupon) return { ok: false, reason: 'not_found' };

  const status = couponStatus(coupon, now);
  if (status !== 'active') return { ok: false, reason: status };

  if (subtotal < coupon.minSubtotal) {
    return { ok: false, reason: 'min_subtotal', minSubtotal: coupon.minSubtotal };
  }
  return { ok: true, coupon, discount: calcCouponDiscount(coupon, subtotal) };
}

export function describeCouponError(result) {
  switch (result.reason) {
    case 'empty':
      return 'Enter a discount code.';
    case 'not_found':
      return 'This code is not valid.';
    case 'inactive':
      return 'This code is no longer active.';
    case 'expired':
      return 'This code has expired.';
    case 'used_up':
      return 'This code has been fully redeemed.';
    case 'min_subtotal':
      return `Spend at least $${result.minSubtotal} to use this code.`;
    default:
      return 'This code can’t be applied.';
  }
}

/** "20% off" / "$15 off" (+ điều kiện tối thiểu). */
export function describeCoupon(coupon) {
  const base = coupon.type === 'percent' ? `${coupon.value}% off` : `$${coupon.value} off`;
  return coupon.minSubtotal > 0 ? `${base} over $${coupon.minSubtotal}` : base;
}

/** Làm sạch danh sách mã đọc từ API / trước khi lưu: bỏ mục sai, ép kiểu, không trùng mã. */
export function sanitizeCoupons(list) {
  if (!Array.isArray(list)) return [];

  const seen = new Set();
  const result = [];
  list.forEach((item) => {
    if (!item || typeof item !== 'object') return;

    const code = normalizeCode(item.code);
    const type = item.type === 'fixed' ? 'fixed' : 'percent';
    const value = Number(item.value);
    if (!code || seen.has(code) || !Number.isFinite(value) || value <= 0) return;
    if (type === 'percent' && value > 100) return;

    const limit = Number(item.usageLimit);
    const expires = item.expiresAt && !Number.isNaN(Date.parse(item.expiresAt)) ? item.expiresAt : null;

    seen.add(code);
    result.push({
      id: String(item.id || `cp-${code}`),
      code,
      type,
      value: round2(value),
      minSubtotal: Math.max(0, Number(item.minSubtotal) || 0),
      expiresAt: expires,
      active: item.active !== false,
      usageLimit: item.usageLimit === null || item.usageLimit === '' || !(limit >= 1) ? null : Math.floor(limit),
      usedCount: Math.max(0, Math.floor(Number(item.usedCount) || 0)),
    });
  });
  return result;
}
