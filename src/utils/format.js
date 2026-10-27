export const formatPrice = (price) =>
  `₫${Number(price || 0).toLocaleString('vi-VN', {
    maximumFractionDigits: 0,
  })}`;

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

export const formatBrand = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  return KNOWN_LABELS[str] || str;
};

export const formatCategory = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  return KNOWN_LABELS[str] || str;
};