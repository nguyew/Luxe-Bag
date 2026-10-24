/**
 * reviewService – khách hàng viết đánh giá sản phẩm.
 *
 * Đánh giá nằm trong mảng `feedbacks` của từng túi (resource `handbags`).
 * Quy tắc: chỉ khách đã NHẬN hàng (đơn `delivered` có sản phẩm đó) mới được
 * đánh giá; mỗi khách một đánh giá cho mỗi sản phẩm (được sửa / xóa).
 */
import { api } from './api';
import { upsertHandbag } from './handbagStore';

export class ReviewError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ReviewError';
    this.code = code;
  }
}

export function describeReviewError(error) {
  switch (error?.code) {
    case 'invalid_input':
      return error.message;
    case 'not_purchased':
      return 'Only customers who received this item can review it.';
    case 'not_found':
      return 'This product is no longer available.';
    case 'network':
    default:
      return 'Could not reach the server. Check your connection and try again.';
  }
}

export const REVIEW_MAX_LENGTH = 500;

const asArray = (value) => (Array.isArray(value) ? value : []);
const handbagPath = (id) => `handbags/${encodeURIComponent(id)}`;

const newReviewId = () =>
  `rv-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Khách đã nhận hàng (đơn delivered) có sản phẩm này chưa? */
export async function hasDeliveredPurchase(userId, handbagId) {
  const record = await api.get(`users/${encodeURIComponent(userId)}`);
  return asArray(record.orders).some(
    (order) =>
      order.status === 'delivered' &&
      asArray(order.items).some((item) => String(item.handbagId) === String(handbagId))
  );
}

const isOwn = (feedback, userId) =>
  feedback && feedback.userId && String(feedback.userId) === String(userId);

/**
 * Gửi (hoặc sửa) đánh giá của user cho một sản phẩm.
 * Nếu admin đã ẩn đánh giá cũ thì sửa xong vẫn bị ẩn (quyết định kiểm duyệt giữ nguyên).
 */
export async function submitReview({ user, handbagId, rating, comment }) {
  const stars = Math.round(Number(rating));
  if (!(stars >= 1 && stars <= 5)) {
    throw new ReviewError('invalid_input', 'Please choose a rating from 1 to 5 stars.');
  }
  const text = String(comment ?? '').trim();
  if (text.length > REVIEW_MAX_LENGTH) {
    throw new ReviewError('invalid_input', `Please keep your review under ${REVIEW_MAX_LENGTH} characters.`);
  }

  try {
    const path = handbagPath(handbagId);
    const record = await api.get(path);
    const feedbacks = asArray(record.feedbacks);
    const index = feedbacks.findIndex((item) => isOwn(item, user.id));

    // Đánh giá mới phải đến từ người đã nhận hàng (kiểm tra trên dữ liệu mới nhất)
    if (index < 0 && !(await hasDeliveredPurchase(user.id, handbagId))) {
      throw new ReviewError('not_purchased');
    }

    const review = {
      id: index >= 0 ? feedbacks[index].id : newReviewId(),
      userId: String(user.id),
      author: user.name,
      rating: stars,
      comment: text,
      date: new Date().toISOString(),
      hidden: index >= 0 ? feedbacks[index].hidden === true : false,
    };
    const next = index >= 0 ? feedbacks.map((item, i) => (i === index ? review : item)) : [...feedbacks, review];

    upsertHandbag(await api.put(path, { ...record, feedbacks: next }));
    return review;
  } catch (error) {
    if (error instanceof ReviewError) throw error;
    if (error?.status === 404) throw new ReviewError('not_found');
    throw new ReviewError('network');
  }
}

/** Xóa đánh giá của chính user. */
export async function deleteOwnReview({ userId, handbagId }) {
  try {
    const path = handbagPath(handbagId);
    const record = await api.get(path);
    const next = asArray(record.feedbacks).filter((item) => !isOwn(item, userId));
    upsertHandbag(await api.put(path, { ...record, feedbacks: next }));
  } catch (error) {
    if (error?.status === 404) throw new ReviewError('not_found');
    throw new ReviewError('network');
  }
}
