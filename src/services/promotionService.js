/**
 * promotionService – mã giảm giá.
 *
 * Gói MockAPI miễn phí chỉ có 2 resource (handbags, users), nên mã giảm giá được
 * lưu trong MỘT bản ghi nội bộ của resource `users`:
 *   { email: 'promotions@luxebag.system', role: 'system', promotions: [...] }
 * Bản ghi này không có mật khẩu nên không thể đăng nhập, và bị loại khỏi danh
 * sách khách hàng (role 'system'). Bản ghi được tạo tự động lần đầu admin lưu mã.
 * Nếu sau này có resource riêng, chỉ cần sửa file này.
 *
 * Resource `users` cần có thêm field `promotions` (kiểu Array).
 */
import { api } from './api';
import { sanitizeCoupons } from '../utils/coupons';

export const SYSTEM_EMAIL = 'promotions@luxebag.system';

async function findRecord() {
  try {
    const list = await api.get(`users?email=${encodeURIComponent(SYSTEM_EMAIL)}`);
    if (!Array.isArray(list)) return null;
    return list.find((item) => String(item.email).toLowerCase() === SYSTEM_EMAIL) || null;
  } catch (error) {
    if (error?.status === 404) return null; // MockAPI trả 404 khi lọc không có kết quả
    throw error;
  }
}

/** Tất cả mã giảm giá hiện có. */
export async function fetchPromotions() {
  const record = await findRecord();
  return sanitizeCoupons(record?.promotions);
}

/**
 * Sửa danh sách mã: đọc bản MỚI NHẤT, áp dụng `mutate(list) -> list mới`, rồi ghi lại.
 * (Đọc lại để không làm mất lượt dùng `usedCount` mà khách vừa tạo ra.)
 */
export async function updateCoupons(mutate) {
  const record = await findRecord();
  const next = sanitizeCoupons(mutate(sanitizeCoupons(record?.promotions)));

  if (record) {
    await api.put(`users/${encodeURIComponent(record.id)}`, { ...record, promotions: next });
  } else {
    await api.post('users', {
      name: 'Promotions',
      email: SYSTEM_EMAIL,
      role: 'system',
      status: 'active',
      phone: '',
      createdAt: new Date().toISOString(),
      addresses: [],
      orders: [],
      promotions: next,
    });
  }
  return next;
}

/** Ghi nhận một lượt dùng mã. Không bao giờ ném lỗi: đơn hàng đã đặt thành công rồi. */
export async function redeemCoupon(couponId) {
  try {
    await updateCoupons((list) =>
      list.map((item) =>
        item.id === couponId ? { ...item, usedCount: item.usedCount + 1 } : item
      )
    );
  } catch {
    // bỏ qua
  }
}
