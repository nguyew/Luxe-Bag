function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildProductFilter(query, isAdmin = false) {
  const filter = isAdmin ? {} : { status: 'published' };
  const search = String(query.search || '').trim().slice(0, 100);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { handbagName: pattern },
      { brand: pattern },
      { category: pattern },
      { color: pattern },
    ];
  }
  if (query.brand) filter.brand = String(query.brand).trim().slice(0, 100);
  if (query.category) filter.category = String(query.category).trim().slice(0, 100);
  if (query.gender === 'women') filter.gender = true;
  if (query.gender === 'men') filter.gender = false;
  if (query.inStock === 'true') filter.stock = { $gt: 0 };

  const minPrice = query.minPrice === undefined ? null : Number(query.minPrice);
  const maxPrice = query.maxPrice === undefined ? null : Number(query.maxPrice);
  if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
    filter.cost = {};
    if (Number.isFinite(minPrice)) filter.cost.$gte = Math.max(minPrice, 0);
    if (Number.isFinite(maxPrice)) filter.cost.$lte = Math.max(maxPrice, 0);
  }
  return { filter, minPrice, maxPrice };
}

function productSort(value) {
  const options = {
    newest: { createdAt: -1 },
    price_asc: { cost: 1, createdAt: -1 },
    price_desc: { cost: -1, createdAt: -1 },
    name_asc: { handbagName: 1, createdAt: -1 },
  };
  return options[value] || options.newest;
}

module.exports = { buildProductFilter, escapeRegex, productSort };
