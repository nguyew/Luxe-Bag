/**
 * Lọc & sắp xếp nâng cao cho danh sách túi xách (màn Search). Thuần, không gọi mạng.
 */
import { isPurchasable } from './catalog';

export const SORT_OPTIONS = [
  { key: 'price_desc', label: 'Price: high to low' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'discount', label: 'Biggest discount' },
  { key: 'name', label: 'Name: A–Z' },
  { key: 'newest', label: 'Newest' },
];

export const DEFAULT_FILTERS = {
  categories: [],
  brands: [],
  gender: 'any', // 'any' | 'women' | 'men'
  minPrice: '',
  maxPrice: '',
  inStockOnly: false,
  sort: 'price_desc',
};

// Giá VND là số nguyên: "1.500.000" hoặc "1,500,000" đều thành 1500000.
const toPrice = (text) => {
  const digits = String(text ?? '').replace(/[^0-9]/g, '');
  return digits ? Number(digits) : null;
};

// percentOff có thể là 0.42 hoặc 42 -> quy về 0..1
const discountOf = (item) => {
  const n = Number(item.percentOff);
  if (!(n > 0)) return 0;
  return n <= 1 ? n : n / 100;
};

const idOf = (item) => Number(item.id) || 0;

/** Áp dụng bộ lọc rồi sắp xếp. Không thay đổi mảng gốc. */
export function applyFilters(items, filters = DEFAULT_FILTERS) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const min = toPrice(f.minPrice);
  const max = toPrice(f.maxPrice);

  const result = items.filter((item) => {
    if (f.categories.length > 0 && !f.categories.includes(item.category)) return false;
    if (f.brands.length > 0 && !f.brands.includes(item.brand)) return false;
    if (f.gender === 'women' && item.gender !== true) return false;
    if (f.gender === 'men' && item.gender !== false) return false;

    const price = Number(item.cost) || 0;
    if (min !== null && price < min) return false;
    if (max !== null && price > max) return false;

    if (f.inStockOnly && !isPurchasable(item)) return false;
    return true;
  });

  const byCost = (a, b) => (Number(a.cost) || 0) - (Number(b.cost) || 0);
  switch (f.sort) {
    case 'price_asc':
      return result.sort(byCost);
    case 'discount':
      return result.sort((a, b) => discountOf(b) - discountOf(a) || byCost(b, a));
    case 'name':
      return result.sort((a, b) =>
        String(a.handbagName || '').localeCompare(String(b.handbagName || ''))
      );
    case 'newest':
      return result.sort((a, b) => idOf(b) - idOf(a));
    case 'price_desc':
    default:
      return result.sort((a, b) => byCost(b, a));
  }
}

/** Số bộ lọc đang bật (không tính cách sắp xếp). */
export function countActiveFilters(filters) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  return (
    (f.categories.length > 0 ? 1 : 0) +
    (f.brands.length > 0 ? 1 : 0) +
    (f.gender !== 'any' ? 1 : 0) +
    (toPrice(f.minPrice) !== null || toPrice(f.maxPrice) !== null ? 1 : 0) +
    (f.inStockOnly ? 1 : 0)
  );
}

/** Các giá trị có thể chọn (brand / category) kèm số sản phẩm, xếp theo tên. */
export function facetOptions(items, field) {
  const counts = new Map();
  items.forEach((item) => {
    const value = String(item[field] || '').trim();
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));
}
