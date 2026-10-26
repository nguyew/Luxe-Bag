/**
 * Coupon service backed by the LuxeBag Backend (MongoDB).
 * Public checkout reads active coupons from GET /api/coupons.
 * Admin screens use the protected /api/admin/coupons endpoints.
 */
import { backendApi } from './api';
import { sanitizeCoupons } from '../utils/coupons';

const ADMIN_PATH = 'api/admin/coupons';
const PUBLIC_PATH = 'api/coupons';

/** Return coupons available for checkout. Server filters inactive/expired/used-up codes. */
export async function fetchPromotions() {
  const response = await backendApi.get(PUBLIC_PATH);
  if (!Array.isArray(response?.coupons)) {
    throw new Error('Unexpected response from the coupons endpoint.');
  }
  return sanitizeCoupons(response.coupons);
}

/** Return every coupon, including inactive/expired coupons, for Admin screens. */
export async function fetchAdminPromotions() {
  const response = await backendApi.get(ADMIN_PATH);
  if (!Array.isArray(response?.coupons)) {
    throw new Error('Unexpected response from the admin coupons endpoint.');
  }
  return sanitizeCoupons(response.coupons);
}

/**
 * Retains the existing UI contract: updateCoupons(list => nextList).
 * Changes are reconciled against the Backend using protected CRUD endpoints.
 */
export async function updateCoupons(mutate) {
  if (typeof mutate !== 'function') {
    throw new TypeError('updateCoupons expects a function.');
  }

  const current = await fetchAdminPromotions();
  const next = sanitizeCoupons(mutate(current));
  const currentById = new Map(current.map((coupon) => [coupon.id, coupon]));
  const nextById = new Map(next.map((coupon) => [coupon.id, coupon]));

  // Delete removed coupons first. Historical orders keep their stored couponCode/discount.
  for (const coupon of current) {
    if (!nextById.has(coupon.id)) {
      await backendApi.delete(`${ADMIN_PATH}/${encodeURIComponent(coupon.id)}`);
    }
  }

  // Create new coupons or patch changed coupons.
  for (const coupon of next) {
    const previous = currentById.get(coupon.id);
    if (!previous) {
      await backendApi.post(ADMIN_PATH, coupon);
    } else if (JSON.stringify(previous) !== JSON.stringify(coupon)) {
      await backendApi.patch(`${ADMIN_PATH}/${encodeURIComponent(coupon.id)}`, coupon);
    }
  }

  // Read server state back so the UI uses canonical data.
  return fetchAdminPromotions();
}

/**
 * Kept for backwards compatibility. Redemption is now counted atomically by
 * the Backend during POST /api/orders; clients must not increment usage separately.
 */
export async function redeemCoupon(_couponId) {
  return undefined;
}
