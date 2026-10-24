/**
 * Tiện ích xử lý feedback của túi xách.
 *
 * Mỗi handbag trên MockAPI có thêm trường `feedbacks` (mảng):
 *   { id, author, rating (1-5), comment, date (ISO), userId?, hidden? }
 *  - userId: tài khoản đã viết (đánh giá do khách viết trong app); dữ liệu mẫu không có
 *  - hidden: true khi admin đã ẩn (kiểm duyệt)
 * Dữ liệu từ API có thể thiếu/sai nên luôn chuẩn hóa trước khi dùng.
 */

// Mã định danh của một đánh giá: dùng `id`, thiếu thì dùng vị trí trong mảng gốc.
// Admin kiểm duyệt cũng dùng đúng công thức này để tìm đúng đánh giá.
export const feedbackId = (item, index) => String(item?.id ?? `feedback-${index}`);

/**
 * Chuẩn hóa: bỏ mục không hợp lệ, ép kiểu, xếp mới nhất lên trước.
 * Mặc định BỎ các đánh giá đã bị admin ẩn; admin truyền { includeHidden: true }.
 */
export function normalizeFeedbacks(raw, { includeHidden = false } = {}) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;

      const rating = Math.round(Number(item.rating));
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;

      const time = Date.parse(item.date);

      const hidden = item.hidden === true;
      if (hidden && !includeHidden) return null;

      return {
        id: feedbackId(item, index),
        author: String(item.author || item.user || '').trim() || 'Anonymous',
        rating,
        comment: String(item.comment || '').trim(),
        date: Number.isNaN(time) ? null : time,
        userId: item.userId ? String(item.userId) : '',
        hidden,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.date || 0) - (a.date || 0));
}

// Tổng hợp: số lượng theo từng mức sao, điểm trung bình, tổng số đánh giá
export function summarizeFeedbacks(list) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;

  list.forEach((item) => {
    counts[item.rating] += 1;
    sum += item.rating;
  });

  return {
    total: list.length,
    average: list.length ? sum / list.length : 0,
    counts,
  };
}

export function formatFeedbackDate(time) {
  if (!time) return '';
  return new Date(time).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
