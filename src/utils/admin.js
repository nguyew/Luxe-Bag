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

/** Số đơn và tổng chi tiêu của một khách (không tính đơn đã hủy). */
export function customerStats(user) {
  const orders = asArray(user?.orders);
  const valid = orders.filter((order) => order.status !== 'cancelled');
  return {
    orderCount: orders.length,
    totalSpent: round2(valid.reduce((sum, order) => sum + (Number(order.total) || 0), 0)),
  };
}

/** Tổng quan bán hàng: doanh thu (không tính đơn đã hủy), số đơn, đơn chờ xử lý. */
export function salesSummary(orders) {
  const valid = orders.filter((order) => order.status !== 'cancelled');
  return {
    orderCount: orders.length,
    pending: orders.filter((order) => order.status === 'pending').length,
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
