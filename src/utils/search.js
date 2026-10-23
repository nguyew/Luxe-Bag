/**
 * Tiện ích tìm kiếm túi xách theo tên.
 */

// Bỏ dấu, đổi về chữ thường, gộp khoảng trắng: "  Épée  BAG " -> "epee bag"
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lọc danh sách theo từ khóa. Mọi từ trong từ khóa đều phải xuất hiện
 * trong tên (hoặc brand) của túi, không phân biệt hoa thường/dấu.
 * Từ khóa rỗng -> trả về nguyên danh sách.
 */
export function filterHandbags(list, query) {
  const tokens = normalizeText(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return list;

  return list.filter((item) => {
    const haystack = normalizeText(`${item.handbagName} ${item.brand}`);
    return tokens.every((token) => haystack.includes(token));
  });
}
