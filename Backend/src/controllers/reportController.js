const Order = require('../models/Order');

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function parsePeriod(rawDays) {
  if (rawDays === 'all') return null;
  const parsed = Number.parseInt(rawDays || '30', 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(Math.max(parsed, 1), 366);
}

async function getSalesReport(req, res) {
  const days = parsePeriod(req.query.days);
  const from = days ? new Date(Date.now() - (days - 1) * DAY_MS) : null;
  const orderFilter = from ? { createdAt: { $gte: from } } : {};
  const paymentPeriodFilter = from ? {
    $or: [
      { paymentCompletedAt: { $gte: from } },
      { paymentCompletedAt: null, createdAt: { $gte: from } },
    ],
  } : {};
  const refundPeriodFilter = from ? {
    $or: [
      { refundedAt: { $gte: from } },
      { refundedAt: null, createdAt: { $gte: from } },
    ],
  } : {};

  const [orders, paidOrders, refundedOrders] = await Promise.all([
    Order.find(orderFilter).lean(),
    Order.find({
      ...paymentPeriodFilter,
      paymentStatus: 'paid',
      status: { $nin: ['cancelled', 'returned'] },
    }).lean(),
    Order.find({ ...refundPeriodFilter, paymentStatus: 'refunded' }).lean(),
  ]);

  const revenue = round2(paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0));
  const statusCounts = {};
  orders.forEach((order) => {
    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
  });

  const products = new Map();
  const brands = new Map();
  const daily = new Map();
  paidOrders.forEach((order) => {
    const paidDate = order.paymentCompletedAt || order.createdAt;
    const day = new Date(paidDate).toISOString().slice(0, 10);
    const dailyEntry = daily.get(day) || { date: day, orders: 0, revenue: 0 };
    dailyEntry.orders += 1;
    dailyEntry.revenue = round2(dailyEntry.revenue + Number(order.total || 0));
    daily.set(day, dailyEntry);

    (order.items || []).forEach((item) => {
      const id = String(item.handbagId || item.productId);
      const amount = round2(Number(item.unitPrice || 0) * Number(item.qty || 0));
      const product = products.get(id) || {
        handbagId: id,
        name: item.name,
        brand: item.brand || '',
        qty: 0,
        revenue: 0,
      };
      product.qty += Number(item.qty || 0);
      product.revenue = round2(product.revenue + amount);
      products.set(id, product);

      const brandName = item.brand || 'Other';
      const brand = brands.get(brandName) || { brand: brandName, qty: 0, revenue: 0 };
      brand.qty += Number(item.qty || 0);
      brand.revenue = round2(brand.revenue + amount);
      brands.set(brandName, brand);
    });
  });

  const sortRevenue = (values) => [...values].sort((left, right) => right.revenue - left.revenue);
  return res.json({
    report: {
      periodDays: days,
      revenue,
      paidOrderCount: paidOrders.length,
      totalOrderCount: orders.length,
      averagePaidOrder: paidOrders.length ? round2(revenue / paidOrders.length) : 0,
      refunded: round2(refundedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)),
      refundedOrderCount: refundedOrders.length,
      statusCounts,
      revenueByDay: [...daily.values()].sort((left, right) => left.date.localeCompare(right.date)),
      topProducts: sortRevenue(products.values()).slice(0, 10),
      byBrand: sortRevenue(brands.values()).slice(0, 10),
    },
  });
}

module.exports = { getSalesReport, parsePeriod };
