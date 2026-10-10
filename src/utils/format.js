export const formatPrice = (price) =>
  `$${Number(price || 0).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })}`;

// percentOff trong API là số thập phân (0.42) -> hiển thị "42%"
export const formatPercentOff = (value) => {
  const n = Number(value);
  if (!n || n <= 0) return '';
  const percent = n <= 1 ? n * 100 : n;
  return `${Math.round(percent)}%`;
};