const { refundPayment, retrievePaymentIntent } = require('./stripeService');

function applyRefundState(order, refund) {
  order.refundId = refund.id;
  order.refundStatus = refund.status || 'pending';
  if (refund.status === 'succeeded') {
    order.paymentStatus = 'refunded';
    order.refundedAt = new Date();
  }
}

async function refundOrderPayment(order) {
  if (order.paymentStatus !== 'paid') return null;

  // Orders created before Stripe integration have no PaymentIntent. Preserve
  // their existing simulated refund behavior without pretending Stripe was called.
  if (order.paymentMethod === 'card' && !order.paymentIntentId) {
    order.paymentStatus = 'refunded';
    order.refundStatus = 'succeeded';
    order.refundedAt = new Date();
    return { id: null, status: 'succeeded', legacy: true };
  }

  if (order.paymentMethod !== 'card') {
    order.paymentStatus = 'refunded';
    order.refundStatus = 'succeeded';
    order.refundedAt = new Date();
    return { id: null, status: 'succeeded', manual: true };
  }
  const refund = await refundPayment(order);
  if (refund) applyRefundState(order, refund);
  return refund;
}

/**
 * Reconcile a pending card order when the webhook has not reached the API yet.
 * The authenticated order endpoint uses this as a fallback; webhook handling
 * remains the normal source of payment state changes.
 */
async function reconcilePaymentIntent(order) {
  if (
    order.paymentMethod !== 'card'
    || order.status !== 'pending'
    || !order.paymentIntentId
    || !['requires_payment', 'processing'].includes(order.paymentStatus)
  ) {
    return false;
  }

  const intent = await retrievePaymentIntent(order.paymentIntentId);
  if (intent.id !== order.paymentIntentId) return false;

  if (intent.status === 'succeeded') {
    order.paymentStatus = 'paid';
    order.paymentCompletedAt = new Date();
    order.paymentExpiresAt = null;
    order.paymentFailureMessage = '';
    await order.save();
    return true;
  }

  if (intent.status === 'processing' && order.paymentStatus === 'requires_payment') {
    order.paymentStatus = 'processing';
    await order.save();
    return true;
  }

  return false;
}

module.exports = {
  applyRefundState,
  reconcilePaymentIntent,
  refundOrderPayment,
};
