const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Review = require('../models/Review');

const SHIPPING_FEE = 15;
const FREE_SHIPPING_THRESHOLD = 500;
const MAX_PER_LINE = 10;
const RETURN_WINDOW_DAYS = 7;
const normalizeCouponCode = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '');
const RETURN_REASONS = [
  'Damaged or defective',
  'Wrong item received',
  'Not as described',
  'Changed my mind',
  'Other',
];

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const asId = (value) => value?._id ? value._id.toString() : String(value?.id || value || '');
const serializeOrder = (order) => {
  const raw = order.toObject ? order.toObject() : order;
  return {
    ...raw,
    id: asId(raw._id),
    userId: asId(raw.userId),
    items: (raw.items || []).map((item) => ({ ...item, handbagId: item.handbagId || asId(item.productId) })),
    history: (raw.history || []).map((entry) => ({ ...entry, at: entry.at instanceof Date ? entry.at.toISOString() : entry.at })),
    createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : raw.createdAt,
    updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : raw.updatedAt,
    cancelledAt: raw.cancelledAt instanceof Date ? raw.cancelledAt.toISOString() : raw.cancelledAt,
    returnRequest: raw.returnRequest?.requestedAt instanceof Date
      ? { ...raw.returnRequest, requestedAt: raw.returnRequest.requestedAt.toISOString() }
      : raw.returnRequest,
  };
};

const badRequest = (res, error, details) => res.status(400).json({ error, ...(details?.code ? { code: details.code } : {}), ...(details ? { details } : {}) });

const createOrder = async (req, res) => {
  const body = req.body || {};
  const { items: requestedItems, address, paymentMethod, couponCode } = body;
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) return badRequest(res, 'Your bag is empty.', { code: 'empty' });
  if (!address || !['fullName', 'phone', 'line1', 'city'].every((key) => typeof address[key] === 'string' && address[key].trim())) {
    return badRequest(res, 'A complete delivery address is required.', { code: 'no_address' });
  }
  if (!['cod', 'card'].includes(paymentMethod)) return badRequest(res, 'Invalid payment method.', { code: 'invalid_input' });
  const normalizedCouponCode = normalizeCouponCode(couponCode);

  const quantities = new Map();
  for (const item of requestedItems) {
    const productId = String(item?.productId || item?.id || '');
    const qty = Number(item?.qty);
    if (!mongoose.isValidObjectId(productId) || !Number.isInteger(qty) || qty < 1 || qty > MAX_PER_LINE) {
      return badRequest(res, 'Each item must contain a valid productId and quantity from 1 to 10.', { code: 'invalid_input' });
    }
    quantities.set(productId, (quantities.get(productId) || 0) + qty);
  }
  for (const qty of quantities.values()) {
    if (qty > MAX_PER_LINE) return badRequest(res, 'Maximum quantity per product is 10.', { code: 'invalid_input' });
  }

  const reserved = [];
  const orderItems = [];
  const problems = [];
  let redeemedCoupon = null;
  try {
    for (const [productId, qty] of quantities.entries()) {
      // Atomically reserve stock so concurrent orders cannot oversell a product.
      const product = await Product.findOneAndUpdate(
        { _id: productId, status: 'published', stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { new: true }
      );
      if (!product) {
        const current = await Product.findById(productId);
        problems.push({
          id: productId,
          name: current?.handbagName || 'Unknown item',
          reason: !current || current.status !== 'published' ? 'unavailable' : (current.stock === 0 ? 'sold_out' : 'insufficient'),
          available: current?.status === 'published' ? Number(current.stock || 0) : 0,
        });
        continue;
      }
      reserved.push({ productId, qty });
      orderItems.push({
        productId: product._id,
        handbagId: product._id.toString(),
        name: product.handbagName,
        brand: product.brand || '',
        uri: product.uri || '',
        unitPrice: round2(Number(product.cost)),
        qty,
      });
    }

    if (problems.length) {
      await Promise.all(reserved.map(({ productId, qty }) => Product.updateOne({ _id: productId }, { $inc: { stock: qty } })));
      return res.status(409).json({ error: 'Some items are no longer available in the requested quantity.', code: 'unavailable', details: problems });
    }

    const subtotal = round2(orderItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0));
    let discount = 0;
    if (normalizedCouponCode) {
      const nowForCoupon = new Date();
      // Increment usedCount atomically only when the coupon is still valid and has capacity.
      redeemedCoupon = await Coupon.findOneAndUpdate(
        {
          code: normalizedCouponCode,
          active: true,
          minSubtotal: { $lte: subtotal },
          $and: [
            { $or: [{ expiresAt: null }, { expiresAt: { $gt: nowForCoupon } }] },
            { $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
          ],
        },
        { $inc: { usedCount: 1 } },
        { new: true }
      );
      if (!redeemedCoupon) {
        await Promise.all(reserved.map(({ productId, qty }) => Product.updateOne({ _id: productId }, { $inc: { stock: qty } })));
        reserved.length = 0;
        return res.status(400).json({ error: 'This discount code is invalid, expired, inactive, or no longer available.', code: 'invalid_coupon' });
      }
      const rawDiscount = redeemedCoupon.type === 'percent'
        ? (subtotal * redeemedCoupon.value) / 100
        : redeemedCoupon.value;
      discount = round2(Math.min(Math.max(rawDiscount, 0), subtotal));
    }
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const now = new Date();
    const order = await Order.create({
      userId: req.user._id,
      status: 'pending',
      items: orderItems,
      subtotal,
      discount,
      shipping,
      total: round2(subtotal - discount + shipping),
      address: {
        fullName: address.fullName.trim(),
        phone: address.phone.trim(),
        line1: address.line1.trim(),
        city: address.city.trim(),
      },
      couponCode: redeemedCoupon ? redeemedCoupon.code : null,
      paymentMethod,
      // 
      // Card payment is a demo payment method; no real charge is made.
      paymentStatus: paymentMethod === 'card' ? 'paid' : 'unpaid',
      history: [{ status: 'pending', at: now }],
    });
    return res.status(201).json({ order: serializeOrder(order) });
  } catch (error) {
    await Promise.allSettled(reserved.map(({ productId, qty }) => Product.updateOne({ _id: productId }, { $inc: { stock: qty } })));
    if (redeemedCoupon) {
      await Coupon.updateOne({ _id: redeemedCoupon._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }).catch(() => {});
    }
    throw error;
  }
};

const listMyOrders = async (req, res) => {
  const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
  return res.json({ orders: orders.map(serializeOrder) });
};

const toIso = (value) => (value instanceof Date ? value.toISOString() : value);

/**
 * Bags the customer has purchased successfully.
 * A purchase counts once its order is `delivered`; cancelled, returned, and
 * still-in-progress orders are excluded. Orders are grouped per product so a bag
 * bought several times appears once, with how many were bought and the totals.
 */
const listPurchasedBags = async (req, res) => {
  const orders = await Order.find({ userId: req.user._id, status: 'delivered' }).sort({ createdAt: -1 });

  const grouped = new Map();
  for (const order of orders) {
    const raw = order.toObject();
    const deliveredEntry = [...(raw.history || [])].reverse().find((entry) => entry.status === 'delivered');
    const purchasedAt = toIso(deliveredEntry?.at || raw.updatedAt || raw.createdAt);
    const orderId = asId(raw._id);

    for (const item of raw.items || []) {
      const productId = asId(item.productId) || item.handbagId;
      const lineTotal = round2(Number(item.unitPrice) * Number(item.qty));
      const existing = grouped.get(productId);
      if (!existing) {
        grouped.set(productId, {
          id: productId,
          productId,
          name: item.name,
          brand: item.brand || '',
          uri: item.uri || '',
          unitPrice: item.unitPrice,
          quantity: item.qty,
          ordersCount: 1,
          totalSpent: lineTotal,
          firstPurchasedAt: purchasedAt,
          lastPurchasedAt: purchasedAt,
          lastOrderId: orderId,
          orderIds: [orderId],
        });
        continue;
      }
      existing.quantity += item.qty;
      existing.totalSpent = round2(existing.totalSpent + lineTotal);
      if (!existing.orderIds.includes(orderId)) {
        existing.orderIds.push(orderId);
        existing.ordersCount += 1;
      }
      if (new Date(purchasedAt) > new Date(existing.lastPurchasedAt)) {
        // Newest purchase wins for the snapshot shown to the customer.
        Object.assign(existing, {
          name: item.name,
          brand: item.brand || '',
          uri: item.uri || existing.uri,
          unitPrice: item.unitPrice,
          lastPurchasedAt: purchasedAt,
          lastOrderId: orderId,
        });
      }
      if (new Date(purchasedAt) < new Date(existing.firstPurchasedAt)) existing.firstPurchasedAt = purchasedAt;
    }
  }

  const productIds = [...grouped.keys()].filter((id) => mongoose.isValidObjectId(id));
  const [products, reviews] = productIds.length
    ? await Promise.all([
      Product.find({ _id: { $in: productIds } }).select('handbagName cost stock status'),
      Review.find({ userId: req.user._id, productId: { $in: productIds } }).select('productId rating hidden'),
    ])
    : [[], []];
  const productById = new Map(products.map((product) => [asId(product._id), product]));
  const reviewByProduct = new Map(reviews.map((review) => [asId(review.productId), review]));

  const bags = [...grouped.values()]
    .map((bag) => {
      const product = productById.get(bag.productId);
      const review = reviewByProduct.get(bag.productId);
      return {
        ...bag,
        // Live catalog state, so the app can offer "buy again" only when it is possible.
        available: Boolean(product && product.status === 'published' && Number(product.stock) > 0),
        currentPrice: product ? product.cost : null,
        myReview: review ? { rating: review.rating, hidden: review.hidden === true } : null,
      };
    })
    .sort((a, b) => new Date(b.lastPurchasedAt) - new Date(a.lastPurchasedAt));

  return res.json({
    summary: {
      bags: bags.length,
      items: bags.reduce((sum, bag) => sum + bag.quantity, 0),
      totalSpent: round2(bags.reduce((sum, bag) => sum + bag.totalSpent, 0)),
    },
    bags,
  });
};

const getMyOrder = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid order id.' });
  const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
  if (!order) return res.status(404).json({ error: 'Order not found.', code: 'not_found' });
  return res.json({ order: serializeOrder(order) });
};

const cancelMyOrder = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid order id.' });
  const now = new Date();
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id, status: 'pending' },
    { $set: { status: 'cancelled', cancelledAt: now }, $push: { history: { status: 'cancelled', at: now } } },
    { new: true }
  );
  if (!order) {
    const existing = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!existing) return res.status(404).json({ error: 'Order not found.', code: 'not_found' });
    return res.status(409).json({ error: 'This order can no longer be cancelled.', code: 'not_cancellable' });
  }
  if (order.paymentStatus === 'paid') {
    order.paymentStatus = 'refunded';
    await order.save();
  }
  await Promise.all(order.items.map((item) => Product.updateOne({ _id: item.productId }, { $inc: { stock: item.qty } })));
  return res.json({ order: serializeOrder(order) });
};

const requestReturn = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid order id.' });
  const { reason, note } = req.body || {};
  if (!RETURN_REASONS.includes(reason)) return badRequest(res, 'Please choose a reason for the return.', { code: 'invalid_input' });
  const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
  if (!order) return res.status(404).json({ error: 'Order not found.', code: 'not_found' });
  if (order.status !== 'delivered' || order.returnRequest?.status) return res.status(409).json({ error: 'This order is no longer eligible for a return.', code: 'return_not_allowed' });
  const deliveredEntry = [...(order.history || [])].reverse().find((entry) => entry.status === 'delivered');
  const deliveredAt = deliveredEntry?.at || order.createdAt;
  if (Date.now() > new Date(deliveredAt).getTime() + RETURN_WINDOW_DAYS * 86400000) {
    return res.status(409).json({ error: 'The return window has expired.', code: 'return_not_allowed' });
  }
  order.returnRequest = {
    status: 'requested',
    reason,
    note: String(note || '').trim().slice(0, 300),
    requestedAt: new Date(),
  };
  await order.save();
  return res.status(201).json({ order: serializeOrder(order) });
};

module.exports = { cancelMyOrder, createOrder, getMyOrder, listMyOrders, listPurchasedBags, requestReturn };