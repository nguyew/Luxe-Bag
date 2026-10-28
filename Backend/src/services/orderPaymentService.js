const { refundPayment } = require('./stripeService');

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

module.exports = { applyRefundState, refundOrderPayment };
