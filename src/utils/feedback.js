/**
 * Tiện ích xử lý feedback của túi xách.
 *
 * Mỗi handbag trên MockAPI có thêm trường `feedbacks` (mảng):
 *   { id, author, rating (1-5), comment, date (ISO) }
 * Dữ liệu từ API có thể thiếu/sai nên luôn chuẩn hóa trước khi dùng.
 */

// Chuẩn hóa: bỏ mục không hợp lệ, ép kiểu, xếp mới nhất lên trước
export function normalizeFeedbacks(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;

      const rating = Math.round(Number(item.rating));
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;

      const time = Date.parse(item.date);

      return {
        id: String(item.id ?? `feedback-${index}`),
        author: String(item.author || item.user || '').trim() || 'Anonymous',
        rating,
        comment: String(item.comment || '').trim(),
        date: Number.isNaN(time) ? null : time,
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