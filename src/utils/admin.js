/**
 * Hàm tính toán cho khu quản trị (thuần, không gọi mạng).
 */
import { getStock, isPublished } from './catalog';
import { round2 } from './orders';

export const LOW_STOCK_THRESHOLD = 3;

const asArray = (value) => (Array.isArray(value) ? value : []);
const timeOf = (iso) => Date.parse(iso) || 0;

/** Gom đơn của mọi khách thành một danh sách (mới nhất trước), kèm thông tin khách. */
export function flattenOrders(users) {
  const orders = [];
  asArray(users).forEach((user) => {
    asArray(user.orders).forEach((order) => {
      orders.push({
        ...order,
        userId: user.id,
        customerName: user.name,
        customerEmail: user.email,
      });
    });
  });
  return orders.sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
}

/** Số đơn theo từng trạng thái, kèm tổng (key 'all'). */
export function orderCountsByStatus(orders) {
  const counts = { all: orders.length };
  orders.forEach((order) => {
    counts[order.status] = (counts[order.status] || 0) + 1;
  });
  return counts;
}

/** Số đơn và tổng chi tiêu của một khách (không tính đơn đã hủy / đã trả hàng). */
export function customerStats(user) {
  const orders = asArray(user?.orders);
  const valid = orders.filter(isRevenueOrder);
  return {
    orderCount: orders.length,
    totalSpent: round2(valid.reduce((sum, order) => sum + (Number(order.total) || 0), 0)),
  };
}

/** Đơn được tính vào doanh thu: không phải đơn đã hủy hoặc đã trả hàng/hoàn tiền. */
export const isRevenueOrder = (order) =>
  order.status !== 'cancelled' && order.status !== 'returned';

/** Số đơn khách đang yêu cầu trả hàng và chờ admin xử lý. */
export const returnRequestCount = (orders) =>
  orders.filter((order) => order.returnRequest?.status === 'requested').length;

/** Tổng quan bán hàng: doanh thu, số đơn, đơn chờ xử lý, yêu cầu trả hàng. */
export function salesSummary(orders) {
  const valid = orders.filter(isRevenueOrder);
  return {
    orderCount: orders.length,
    pending: orders.filter((order) => order.status === 'pending').length,
    returns: returnRequestCount(orders),
    revenue: round2(valid.reduce((sum, order) => sum + (Number(order.total) || 0), 0)),
  };
}

/** Số liệu kho: tổng, theo trạng thái xuất bản, sắp hết hàng, hết hàng. */
export function inventoryStats(handbags) {
  const stats = { total: 0, published: 0, draft: 0, archived: 0, lowStock: 0, outOfStock: 0 };

  asArray(handbags).forEach((item) => {
    stats.total += 1;
    if (item.status === 'draft') stats.draft += 1;
    else if (item.status === 'archived') stats.archived += 1;
    else stats.published += 1;

    if (!isPublished(item)) return;
    const stock = getStock(item);
    if (stock === 0) stats.outOfStock += 1;
    else if (stock !== null && stock <= LOW_STOCK_THRESHOLD) stats.lowStock += 1;
  });
  return stats;
}

// ---------------------------------------------------------------------------
// Báo cáo doanh số
// ---------------------------------------------------------------------------
const DAY = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(ms) {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

const dayLabel = (ms) => {
  const date = new Date(ms);
  return `${date.getDate()}/${date.getMonth() + 1}`;
};

function topBy(map, limit) {
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

/**
 * Báo cáo doanh số trong `days` ngày gần nhất (days = null: toàn bộ thời gian).
 * Doanh thu chỉ tính đơn không bị hủy / trả hàng.
 * series: cột biểu đồ – theo ngày (7 ngày), theo 3 ngày (30), theo 10 ngày (90),
 *         theo tháng (toàn bộ, tối đa 12 tháng gần nhất).
 */
export function buildReport(orders, { days = 30, now = Date.now() } = {}) {
  const from = days ? startOfDay(now) - (days - 1) * DAY : null;

  const inRange = orders.filter((order) => {
    const time = Date.parse(order.createdAt);
    return !Number.isNaN(time) && (from === null || time >= from);
  });
  const revenueOrders = inRange.filter(isRevenueOrder);
  const money = (list) => round2(list.reduce((sum, order) => sum + (Number(order.total) || 0), 0));

  const revenue = money(revenueOrders);
  const returnedOrders = inRange.filter((order) => order.status === 'returned');

  // --- cột biểu đồ ---
  let series = [];
  if (days) {
    const bucketDays = days <= 7 ? 1 : days <= 30 ? 3 : 10;
    const count = Math.ceil(days / bucketDays);
    series = Array.from({ length: count }, (_, i) => ({
      label: dayLabel(from + i * bucketDays * DAY),
      value: 0,
    }));
    revenueOrders.forEach((order) => {
      const index = Math.min(
        Math.floor((Date.parse(order.createdAt) - from) / (bucketDays * DAY)),
        count - 1
      );
      if (index >= 0) series[index].value = round2(series[index].value + (Number(order.total) || 0));
    });
  } else if (revenueOrders.length > 0) {
    const nowDate = new Date(now);
    const nowIndex = nowDate.getFullYear() * 12 + nowDate.getMonth();
    const times = revenueOrders.map((order) => new Date(order.createdAt));
    const firstIndex = Math.min(...times.map((date) => date.getFullYear() * 12 + date.getMonth()));
    const startIndex = Math.max(firstIndex, nowIndex - 11);
    series = Array.from({ length: nowIndex - startIndex + 1 }, (_, i) => ({
      label: MONTHS[(startIndex + i) % 12],
      value: 0,
    }));
    revenueOrders.forEach((order) => {
      const date = new Date(order.createdAt);
      const index = date.getFullYear() * 12 + date.getMonth() - startIndex;
      if (index >= 0 && index < series.length) {
        series[index].value = round2(series[index].value + (Number(order.total) || 0));
      }
    });
  }

  // --- sản phẩm & thương hiệu bán chạy (theo tiền hàng của từng món) ---
  const products = new Map();
  const brands = new Map();
  revenueOrders.forEach((order) => {
    asArray(order.items).forEach((item) => {
      const amount = (Number(item.unitPrice) || 0) * (Number(item.qty) || 0);
      const qty = Number(item.qty) || 0;

      const product = products.get(item.handbagId) || {
        handbagId: item.handbagId,
        name: item.name,
        brand: item.brand || '',
        qty: 0,
        revenue: 0,
      };
      product.qty += qty;
      product.revenue = round2(product.revenue + amount);
      products.set(item.handbagId, product);

      const brandName = item.brand || 'Other';
      const brand = brands.get(brandName) || { brand: brandName, qty: 0, revenue: 0 };
      brand.qty += qty;
      brand.revenue = round2(brand.revenue + amount);
      brands.set(brandName, brand);
    });
  });

  return {
    revenue,
    orderCount: revenueOrders.length,
    avgOrder: revenueOrders.length ? round2(revenue / revenueOrders.length) : 0,
    refunded: money(returnedOrders),
    cancelled: inRange.filter((order) => order.status === 'cancelled').length,
    returned: returnedOrders.length,
    series,
    topProducts: topBy(products, 5),
    byBrand: topBy(brands, 5),
    statusCounts: orderCountsByStatus(inRange),
  };
}
