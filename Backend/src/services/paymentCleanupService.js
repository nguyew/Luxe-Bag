const Order = require('../models/Order');
const { paymentCleanupIntervalMinutes } = require('../config/env');
const { cancelPaymentIntent } = require('./stripeService');
const { releaseOrderResources } = require('./orderResourceService');

let cleanupTimer;

async function cleanupExpiredPayments() {
  const expiredOrders = await Order.find({
    status: 'pending',
    paymentMethod: 'card',
    paymentStatus: 'requires_payment',
    paymentExpiresAt: { $lte: new Date() },
  }).limit(100);

  let cleaned = 0;
  for (const order of expiredOrders) {
    try {
      await cancelPaymentIntent(order);
      const now = new Date();
      order.paymentStatus = 'failed';
      order.paymentExpiresAt = null;
      order.paymentFailureMessage = 'Payment time expired.';
      order.status = 'cancelled';
      order.cancelledAt = now;
      order.history.push({ status: 'cancelled', at: now });
      await order.save();
      await releaseOrderResources(order);
      cleaned += 1;
    } catch (error) {
      // A PaymentIntent that completed just before cleanup cannot be cancelled;
      // its signed webhook remains the source of truth.
      console.warn(`Could not expire order ${order.orderNumber}:`, error.message);
    }
  }
  if (cleaned) console.log(`Expired ${cleaned} unpaid card orders.`);
  return cleaned;
}

function startPaymentCleanup() {
  if (cleanupTimer) return;
  const intervalMs = paymentCleanupIntervalMinutes * 60 * 1000;
  cleanupExpiredPayments().catch((error) => {
    console.error('Initial payment cleanup failed:', error);
  });
  cleanupTimer = setInterval(() => {
    cleanupExpiredPayments().catch((error) => {
      console.error('Payment cleanup failed:', error);
    });
  }, intervalMs);
  cleanupTimer.unref();
}

function stopPaymentCleanup() {
  if (!cleanupTimer) return;
  clearInterval(cleanupTimer);
  cleanupTimer = null;
}

module.exports = { cleanupExpiredPayments, startPaymentCleanup, stopPaymentCleanup };
