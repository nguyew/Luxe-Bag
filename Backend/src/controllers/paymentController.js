const Order = require('../models/Order');
const { constructWebhookEvent } = require('../services/stripeService');
const { releaseOrderResources } = require('../services/orderResourceService');
const { applyRefundState, refundOrderPayment } = require('../services/orderPaymentService');

async function findOrderForRefund(refund) {
  const orderId = refund.metadata?.orderId;
  if (orderId) return Order.findById(orderId);
  const paymentIntentId = typeof refund.payment_intent === 'string'
    ? refund.payment_intent
    : refund.payment_intent?.id;
  return paymentIntentId ? Order.findOne({ paymentIntentId }) : null;
}

async function handleRefundEvent(event) {
  const refund = event.data.object;
  const order = await findOrderForRefund(refund);
  if (!order) return;

  order.refundId = refund.id;
  if (event.type === 'refund.failed' || refund.status === 'failed') {
    order.refundStatus = 'failed';
  } else if (refund.status === 'canceled') {
    order.refundStatus = 'canceled';
  } else {
    applyRefundState(order, refund);
  }
  await order.save();
}

async function handlePaymentIntentEvent(event) {
  const intent = event.data.object;
  const orderId = intent.metadata?.orderId;
  if (!orderId) return;
  const order = await Order.findById(orderId);
  if (!order || order.paymentIntentId !== intent.id) return;

  if (event.type === 'payment_intent.succeeded') {
    order.paymentStatus = 'paid';
    order.paymentCompletedAt = new Date();
    order.paymentExpiresAt = null;
    order.paymentFailureMessage = '';
    await order.save();

    // A late success after cancellation must be returned automatically.
    if (order.status === 'cancelled' && order.refundStatus === 'none') {
      await refundOrderPayment(order);
      await order.save();
    }
    return;
  }

  if (event.type === 'payment_intent.processing') {
    if (order.paymentStatus === 'requires_payment') {
      order.paymentStatus = 'processing';
      await order.save();
    }
    return;
  }

  if (['payment_intent.payment_failed', 'payment_intent.canceled'].includes(event.type)) {
    if (!['requires_payment', 'processing'].includes(order.paymentStatus)) return;
    order.paymentStatus = 'failed';
    order.paymentExpiresAt = null;
    order.paymentFailureMessage = String(
      intent.last_payment_error?.message || 'The payment was not completed.'
    ).slice(0, 300);
    if (order.status === 'pending') {
      order.status = 'cancelled';
      order.cancelledAt = new Date();
      order.history.push({ status: 'cancelled', at: order.cancelledAt });
    }
    await order.save();
    await releaseOrderResources(order);
  }
}

async function stripeWebhook(req, res) {
  let event;
  try {
    event = constructWebhookEvent(req.body, req.headers['stripe-signature']);
  } catch (error) {
    return res.status(400).json({ error: `Invalid Stripe webhook: ${error.message}` });
  }

  if (event.type.startsWith('payment_intent.')) {
    await handlePaymentIntentEvent(event);
  } else if (['refund.created', 'refund.updated', 'refund.failed'].includes(event.type)) {
    await handleRefundEvent(event);
  }

  return res.json({ received: true });
}

module.exports = { stripeWebhook };
