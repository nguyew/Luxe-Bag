export const formatPrice = (price) =>
  `₫${Number(price || 0).toLocaleString('vi-VN', {
    maximumFractionDigits: 0,
  })}`;

export const formatCompactPrice = (price) => {
  const value = Number(price);
  if (!Number.isFinite(value)) return '₫0';

  const absoluteValue = Math.abs(value);
  const suffix = absoluteValue >= 1e9 ? 'B' : absoluteValue >= 1e6 ? 'M' : '';
  const divisor = suffix === 'B' ? 1e9 : suffix === 'M' ? 1e6 : 1;

  if (!suffix) return formatPrice(value);

  return `₫${(value / divisor).toFixed(1).replace(/\.0$/, '')}${suffix}`;
};

export const formatOriginalPrice = (item) => {
  const original = Number(item?.originalCost);
  const current = Number(item?.cost);
  return Number.isFinite(original) && Number.isFinite(current) && original > current
    ? formatPrice(original)
    : '';
};

// percentOff trong API là số thập phân (0.42) -> hiển thị "42%"
export const formatPercentOff = (value) => {
  const n = Number(value);
  if (!n || n <= 0) return '';
  const percent = n <= 1 ? n * 100 : n;
  return `${Math.round(percent)}%`;
};

const KNOWN_LABELS = {
  '670000000000000000000101': 'Coach',
  '670000000000000000000102': 'Furla',
  '670000000000000000000201': 'Shoulder Bag',
  '670000000000000000000202': 'Tote Bag',
};

/** Tên đã biết của một mã brand/category, hoặc '' nếu chưa có trong bảng. */
export const knownLabel = (val) => KNOWN_LABELS[String(val ?? '').trim()] || '';

// Mã ID database (24 ký tự hex) chưa có tên thì không hiển thị thô ra giao diện
const isDatabaseId = (str) => /^[a-f0-9]{24}$/i.test(str);

export const formatBrand = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  if (KNOWN_LABELS[str]) return KNOWN_LABELS[str];
  return isDatabaseId(str) ? 'Other' : str;
};

export const formatCategory = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  if (KNOWN_LABELS[str]) return KNOWN_LABELS[str];
  return isDatabaseId(str) ? 'Uncategorized' : str;
};

/** ["Black", "Ivory"] -> "Black, Ivory" (chấp nhận mảng hoặc chuỗi). */
export const formatColors = (val) => {
  const list = Array.isArray(val) ? val : val ? [val] : [];
  return list
    .map((name) => String(name).trim())
    .filter(Boolean)
    .join(', ');
};