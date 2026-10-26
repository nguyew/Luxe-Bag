/**
 * Quy tắc về sản phẩm: giá, tồn kho, trạng thái xuất bản.
 * Gom ở một chỗ để mọi màn hình (Detail, Cart, Checkout, Admin) dùng chung.
 */

// Số lượng tối đa của một món trong giỏ
export const MAX_PER_LINE = 10;

/**
 * Giá bán của một túi. `cost` là giá đang bán (đã là giá sau giảm),
 * `percentOff` chỉ để hiển thị nhãn "% off". Nếu giảng viên muốn `cost` là giá
 * gốc rồi trừ giảm giá thì chỉ cần sửa hàm này.
 */
export function unitPrice(handbag) {
  const price = Number(handbag?.cost);
  return Number.isFinite(price) ? price : 0;
}

/**
 * Tồn kho: số nguyên >= 0, hoặc null nếu sản phẩm chưa có trường `stock`
 * (null = không giới hạn, để app vẫn chạy khi chưa chạy seed-stock).
 */
export function getStock(handbag) {
  // Ưu tiên trường tồn kho chính của backend.
  // Dùng stock cho dữ liệu cũ nếu inventoryQuantity không tồn tại.
  const raw =
    handbag?.inventoryQuantity ??
    handbag?.stock;

  if (raw === undefined || raw === null || raw === '') {
    return null;
  }

  const stock = Number(raw);

  return Number.isFinite(stock)
    ? Math.max(0, Math.floor(stock))
    : null;
}

/** Sản phẩm đã xuất bản (thiếu `status` coi như đã xuất bản). */
export function isPublished(handbag) {
  return !handbag?.status || handbag.status === 'published';
}

/** Số lượng tối đa có thể đặt cho sản phẩm này. */
export function maxQtyFor(handbag) {
  const stock = getStock(handbag);
  return stock === null ? MAX_PER_LINE : Math.min(MAX_PER_LINE, stock);
}

export function isPurchasable(handbag) {
  return !!handbag && isPublished(handbag) && maxQtyFor(handbag) > 0;
}

