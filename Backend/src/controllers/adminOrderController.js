const mongoose = require('mongoose');
const Order = require('../models/Order');
const { cancelPaymentIntent } = require('../services/stripeService');
const { refundOrderPayment } = require('../services/orderPaymentService');
const { releaseOrderResources } = require('../services/orderResourceService');

const NEXT_STATUSES = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered'],
  delivered: [],
  cancelled: [],
  returned: [],
};

const asId = (value) => value?._id ? value._id.toString() : String(value || '');
const serializeOrder = (order) => {
  const raw = order.toObject ? order.toObject() : order;
  return {
    ...raw,
    id: asId(raw._id),
    userId: asId(raw.userId),
    items: (raw.items || []).map((item) => ({ ...item.toObject?.() || item, handbagId: item.handbagId || asId(item.productId) })),
    history: (raw.history || []).map((entry) => ({ ...entry.toObject?.() || entry, at: entry.at instanceof Date ? entry.at.toISOString() : entry.at })),
    createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : raw.createdAt,
    updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : raw.updatedAt,
    cancelledAt: raw.cancelledAt instanceof Date ? raw.cancelledAt.toISOString() : raw.cancelledAt,
    returnRequest: raw.returnRequest ? {
      ...raw.returnRequest,
      requestedAt: raw.returnRequest.requestedAt instanceof Date ? raw.returnRequest.requestedAt.toISOString() : raw.returnRequest.requestedAt,
      resolvedAt: raw.returnRequest.resolvedAt instanceof Date ? raw.returnRequest.resolvedAt.toISOString() : raw.returnRequest.resolvedAt,
    } : null,
  };
};

const listAdminOrders = async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '100', 10), 1), 500);
  const filter = {};
  if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  return res.json({ orders: orders.map(serializeOrder), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
};

const updateAdminOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid order id.', code: 'invalid_input' });
  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ error: 'Order not found.', code: 'not_found' });
  if (!Object.prototype.hasOwnProperty.call(NEXT_STATUSES, status) || !NEXT_STATUSES[order.status].includes(status)) {
    return res.status(409).json({ error: 'Invalid order status transition.', code: 'invalid_transition' });
  }

  if (order.paymentMethod === 'card' && status !== 'cancelled' && order.paymentStatus !== 'paid') {
    return res.status(409).json({
      error: 'Card payment has not completed.',
      code: 'payment_required',
    });
  }

  const now = new Date();
  let shouldReleaseResources = false;
  if (status === 'cancelled') {
    if (order.paymentStatus === 'processing') {
      return res.status(409).json({
        error: 'The payment is processing and the order cannot be cancelled yet.',
        code: 'payment_processing',
      });
    }
    if (order.paymentMethod === 'card' && order.paymentStatus === 'requires_payment') {
      await cancelPaymentIntent(order);
    }
    await refundOrderPayment(order);
    order.cancelledAt = now;
    shouldReleaseResources = true;
  }
  if (status === 'delivered' && order.paymentMethod === 'cod') {
    order.paymentStatus = 'paid';
    order.paymentCompletedAt = now;
  }
  order.status = status;
  order.history.push({ status, at: now });
  await order.save();
  if (shouldReleaseResources) await releaseOrderResources(order);
  return res.json({ order: serializeOrder(await Order.findById(order._id)) });
};

const resolveAdminReturn = async (req, res) => {
  const { id } = req.params;
  const { decision, restock = false, note = '' } = req.body || {};
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid order id.', code: 'invalid_input' });
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'Decision must be approve or reject.', code: 'invalid_return' });
  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ error: 'Order not found.', code: 'not_found' });
  if (order.returnRequest?.status !== 'requested') return res.status(409).json({ error: 'This order has no pending return request.', code: 'invalid_return' });

  const now = new Date();
  const approved = decision === 'approve';
  const shouldRestock = approved && restock === true;
  order.returnRequest.status = approved ? 'approved' : 'rejected';
  order.returnRequest.resolvedAt = now;
  order.returnRequest.adminNote = String(note || '').trim().slice(0, 300);
  order.returnRequest.restocked = approved && restock === true;
  if (approved) {
    await refundOrderPayment(order);
    order.status = 'returned';
    order.history.push({ status: 'returned', at: now });
  }
  await order.save();
  if (shouldRestock) await releaseOrderResources(order);
  return res.json({ order: serializeOrder(await Order.findById(order._id)) });
};

module.exports = { listAdminOrders, updateAdminOrderStatus, resolveAdminReturn };
