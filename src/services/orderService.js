/**
 * Order service.
 * Customer order operations use the authenticated LuxeBag Backend. Product
 * pricing, stock reservation, totals, ownership checks, and order persistence
 * are performed server-side. The legacy MockAPI stock helper remains exported
 * only for the older Admin service until that service is migrated.
 */
import { api, backendApi } from './api';
import { getStock } from '../utils/catalog';
import {
  PAYMENT_METHODS,
  RETURN_REASONS,
  canCancel,
  canRequestReturn,
} from '../utils/orders';

export class OrderError extends Error {
  constructor(code, message, details) {
    super(message || code);
    this.name = 'OrderError';
    this.code = code;
    this.details = details || [];
  }
}

export function describeOrderError(error) {
  switch (error?.code) {
    case 'empty':
      return 'Your bag is empty.';
    case 'no_address':
      return 'Please choose a delivery address.';
    case 'invalid_input':
      return error.message || 'Please check your order details.';
    case 'unavailable':
      return 'Some items are no longer available in the requested quantity. Please review your bag.';
    case 'not_found':
      return 'We could not find this order.';
    case 'invalid_coupon':
      return error.message || 'This coupon cannot be used right now.';
    case 'return_not_allowed':
      return 'This order is no longer eligible for a return.';
    case 'invalid_return':
      return 'This return request has already been handled.';
    case 'invalid_transition':
      return 'This order status can no longer be changed that way. It may have been updated already.';
    case 'not_cancellable':
      return 'This order can no longer be cancelled because the store has already processed it.';
    case 'timeout':
      return 'The server took too long to respond. Please try again.';
    case 'network':
    default:
      return error?.message || 'Could not reach the server. Check your connection and try again.';
  }
}

function toOrderError(error) {
  if (error instanceof OrderError) return error;
  const data = error?.data || {};
  const details = data.details || error?.details || [];
  const code = data.code || data.details?.code
    || (error?.status === 404 ? 'not_found' : null)
    || (error?.status === 409 ? 'unavailable' : null)
    || (error?.code === 'timeout' ? 'timeout' : null)
    || 'network';
  return new OrderError(code, data.error || data.message || error?.message, details);
}

const asArray = (value) => (Array.isArray(value) ? value : []);

/**
 * Legacy MockAPI stock helper. The new Backend checkout/cancellation flows do
 * not call this; stock changes for Backend orders are handled on the server.
 * It is kept temporarily because the existing Admin service still imports it.
 */
const legacyHandbagPath = (id) => `handbags/${encodeURIComponent(id)}`;

async function fetchLegacyHandbag(id) {
  try {
    return await api.get(legacyHandbagPath(id));
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
}

async function adjustLegacyStock(id, delta) {
  const record = await fetchLegacyHandbag(id);
  if (!record) return;
  const stock = getStock(record);
  if (stock === null) return;
  await api.put(legacyHandbagPath(id), {
    ...record,
    stock: Math.max(0, stock + delta),
  });
}

async function restoreLegacyStock(entries) {
  for (const entry of entries) {
    try {
      await adjustLegacyStock(entry.id, entry.qty);
    } catch {
      // Best effort for legacy MockAPI orders only.
    }
  }
}

/** Legacy helper retained for the current Admin service during migration. */
export async function restoreOrderStock(order) {
  await restoreLegacyStock(
    asArray(order?.items).map((item) => ({ id: item.handbagId, qty: Number(item.qty) || 0 }))
  );
}

function sortNewestFirst(orders) {
  return [...orders].sort(
    (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
  );
}

/**
 * Place an order through Backend.
 * `userId` is retained for compatibility with CheckoutScreen but is not sent:
 * the server derives the customer identity from the JWT.
 * lines: [{ id, qty }], address: { fullName, phone, line1, city }.
 */
export async function placeOrder({ userId: _userId, lines, address, paymentMethod, couponCode }) {
  if (!Array.isArray(lines) || lines.length === 0) throw new OrderError('empty');
  if (!address) throw new OrderError('no_address');
  if (!PAYMENT_METHODS[paymentMethod]) {
    throw new OrderError('invalid_input', 'Please choose a payment method.');
  }

  try {
    const response = await backendApi.post('api/orders', {
      items: lines.map((line) => ({ productId: String(line.id), qty: Number(line.qty) })),
      address: {
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        city: address.city,
      },
      paymentMethod,
      ...(couponCode ? { couponCode } : {}),
    });
    if (!response?.order) throw new Error('Unexpected response from the server.');
    return response.order;
  } catch (error) {
    throw toOrderError(error);
  }
}

/** List orders belonging to the authenticated customer. */
export async function getMyOrders(_userId) {
  try {
    const response = await backendApi.get('api/orders/my');
    if (!Array.isArray(response?.orders)) throw new Error('Unexpected response from the server.');
    return sortNewestFirst(response.orders);
  } catch (error) {
    throw toOrderError(error);
  }
}

/** Cancel a pending order. Backend performs the status check and restocks items. */
export async function cancelOrder(_userId, orderId) {
  try {
    const response = await backendApi.patch(`api/orders/${encodeURIComponent(orderId)}/cancel`, {});
    if (!response?.order) throw new Error('Unexpected response from the server.');
    return response.order;
  } catch (error) {
    throw toOrderError(error);
  }
}

/** Request a return for an eligible delivered order. */
export async function requestReturn(_userId, orderId, { reason, note }) {
  if (!RETURN_REASONS.includes(reason)) {
    throw new OrderError('invalid_input', 'Please choose a reason for the return.');
  }
  try {
    const response = await backendApi.post(
      `api/orders/${encodeURIComponent(orderId)}/return-requests`,
      { reason, note: String(note ?? '').trim().slice(0, 300) },
    );
    if (!response?.order) throw new Error('Unexpected response from the server.');
    return response.order;
  } catch (error) {
    throw toOrderError(error);
  }
}

// Re-exported to avoid breaking screens that use local eligibility checks.
export { canCancel, canRequestReturn };
