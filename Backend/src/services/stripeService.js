const Stripe = require('stripe');
const {
  stripeCurrency,
  stripeSecretKey,
  stripeWebhookSecret,
} = require('../config/env');

const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf',
  'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

let stripeClient;

function getStripe() {
  if (!stripeSecretKey) {
    const error = new Error('Stripe is not configured. Set STRIPE_SECRET_KEY on the server.');
    error.statusCode = 503;
    error.code = 'payment_not_configured';
    throw error;
  }
  if (!stripeClient) stripeClient = new Stripe(stripeSecretKey);
  return stripeClient;
}

function toMinorUnits(amount, currency = stripeCurrency) {
  const numeric = Number(amount);
  const multiplier = ZERO_DECIMAL_CURRENCIES.has(String(currency).toLowerCase()) ? 1 : 100;
  const value = Math.round(numeric * multiplier);
  if (!Number.isFinite(numeric) || !Number.isSafeInteger(value) || value < 1) {
    const error = new Error('Invalid payment amount.');
    error.statusCode = 400;
    error.code = 'invalid_payment_amount';
    throw error;
  }
  return value;
}

async function createPaymentIntent(order) {
  return getStripe().paymentIntents.create({
    amount: toMinorUnits(order.total),
    currency: stripeCurrency,
    automatic_payment_methods: { enabled: true },
    description: `LuxeBag order ${order.orderNumber}`,
    metadata: {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      userId: String(order.userId),
    },
  }, { idempotencyKey: `luxebag-order-${String(order._id)}` });
}

async function cancelPaymentIntent(order) {
  if (!order.paymentIntentId) return null;
  return getStripe().paymentIntents.cancel(
    order.paymentIntentId,
    {},
    { idempotencyKey: `luxebag-cancel-${String(order._id)}` }
  );
}

async function retrievePaymentIntent(paymentIntentId) {
  return getStripe().paymentIntents.retrieve(paymentIntentId);
}

async function refundPayment(order) {
  if (order.paymentMethod !== 'card' || order.paymentStatus !== 'paid') return null;
  if (!order.paymentIntentId) {
    const error = new Error('The order has no Stripe PaymentIntent.');
    error.statusCode = 409;
    error.code = 'payment_reference_missing';
    throw error;
  }
  if (order.refundId) return getStripe().refunds.retrieve(order.refundId);

  return getStripe().refunds.create({
    payment_intent: order.paymentIntentId,
    reason: 'requested_by_customer',
    metadata: {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
    },
  }, { idempotencyKey: `luxebag-refund-${String(order._id)}` });
}

function constructWebhookEvent(rawBody, signature) {
  if (!stripeWebhookSecret) {
    const error = new Error('STRIPE_WEBHOOK_SECRET is not configured.');
    error.statusCode = 503;
    throw error;
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
}

module.exports = {
  cancelPaymentIntent,
  constructWebhookEvent,
  createPaymentIntent,
  retrievePaymentIntent,
  refundPayment,
  toMinorUnits,
};
