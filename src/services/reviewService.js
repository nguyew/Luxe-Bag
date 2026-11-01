/** Customer review operations backed by the LuxeBag Express API. */
import { backendApi } from './api';
import { getSnapshot, upsertHandbag } from './handbagStore';

export class ReviewError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ReviewError';
    this.code = code;
  }
}

export function describeReviewError(error) {
  switch (error?.code || error?.data?.code) {
    case 'invalid_input':
      return error.message || error?.data?.error || 'Please check your review and try again.';
    case 'not_purchased':
      return 'Only customers who received this item can review it.';
    case 'not_found':
      return 'This product or review is no longer available.';
    case 'unauthorized':
      return 'Please sign in again to manage your review.';
    case 'network':
    default:
      return error?.message || 'Could not reach the server. Check your connection and try again.';
  }
}

export const REVIEW_MAX_LENGTH = 500;
const productReviewsPath = (id) => `api/products/${encodeURIComponent(id)}/reviews`;

function toReviewError(error) {
  if (error instanceof ReviewError) return error;
  const code = error?.data?.code;
  if (code) return new ReviewError(code, error?.data?.error || error.message);
  if (error?.status === 401) return new ReviewError('unauthorized', 'Please sign in again.');
  if (error?.status === 404) return new ReviewError('not_found');
  return new ReviewError('network', error?.message);
}

function syncProductReviews(productId, feedbacks) {
  const current = getSnapshot().items.find((item) => String(item.id) === String(productId));
  if (current) upsertHandbag({ ...current, feedbacks });
}

function syncReviewIntoCache(productId, review) {
  const current = getSnapshot().items.find((item) => String(item.id) === String(productId));
  if (!current) return;
  const feedbacks = Array.isArray(current.feedbacks) ? current.feedbacks : [];
  const next = feedbacks.filter((item) => String(item.id) !== String(review.id));
  next.push(review);
  syncProductReviews(productId, next);
}

/** Check delivery eligibility against the authenticated user's Backend orders. */
export async function hasDeliveredPurchase(userId, handbagId) {
  if (!userId || !handbagId) return false;
  try {
    // One grouped request (delivered orders only) instead of downloading every order.
    const response = await backendApi.get('api/orders/purchased');
    return (Array.isArray(response?.bags) ? response.bags : []).some((bag) =>
      String(bag.productId || bag.id) === String(handbagId)
    );
  } catch (error) {
    throw toReviewError(error);
  }
}

/** Fetch public reviews for a product and synchronize the shared product cache. */
export async function fetchProductReviews(handbagId) {
  try {
    const response = await backendApi.get(productReviewsPath(handbagId));
    const reviews = Array.isArray(response?.reviews) ? response.reviews : [];
    syncProductReviews(handbagId, reviews);
    return reviews;
  } catch (error) {
    throw toReviewError(error);
  }
}

/** Create or update the signed-in customer's review. Eligibility is enforced by Backend. */
export async function submitReview({ user, handbagId, rating, comment }) {
  const stars = Math.round(Number(rating));
  if (!(stars >= 1 && stars <= 5)) {
    throw new ReviewError('invalid_input', 'Please choose a rating from 1 to 5 stars.');
  }
  const text = String(comment ?? '').trim();
  if (text.length > REVIEW_MAX_LENGTH) {
    throw new ReviewError('invalid_input', `Please keep your review under ${REVIEW_MAX_LENGTH} characters.`);
  }
  if (!user?.id || !handbagId) {
    throw new ReviewError('invalid_input', 'Please sign in and select a product first.');
  }

  try {
    const response = await backendApi.post(productReviewsPath(handbagId), {
      rating: stars,
      comment: text,
    });
    if (!response?.review) throw new Error('Unexpected response from the review endpoint.');
    syncReviewIntoCache(handbagId, response.review);
    return response.review;
  } catch (error) {
    throw toReviewError(error);
  }
}

/** Delete only the current customer's review for this product. */
export async function deleteOwnReview({ userId, handbagId }) {
  if (!userId || !handbagId) throw new ReviewError('invalid_input', 'Please sign in first.');
  try {
    await backendApi.delete(`${productReviewsPath(handbagId)}/mine`);
    const current = getSnapshot().items.find((item) => String(item.id) === String(handbagId));
    if (current) {
      syncProductReviews(handbagId, (current.feedbacks || []).filter((item) => String(item.userId) !== String(userId)));
    }
  } catch (error) {
    throw toReviewError(error);
  }
}
