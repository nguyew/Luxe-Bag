const crypto = require('crypto');

function syncLegacyPrimary(product) {
  const images = product.images || [];
  const sorted = [...images].sort((left, right) => left.sortOrder - right.sortOrder);
  const selected = sorted.find((image) => image.isPrimary) || sorted[0] || null;
  images.forEach((image) => {
    image.isPrimary = Boolean(selected && image.id === selected.id);
  });
  const primary = images.find((image) => image.isPrimary) || null;
  product.uri = primary?.url || '';
  product.imageKey = primary?.key || '';
}

function createImage({ url, key, alt = '', sortOrder = 0, isPrimary = false }) {
  return {
    id: crypto.randomUUID(),
    url,
    key,
    alt: String(alt || '').trim().slice(0, 160),
    sortOrder,
    isPrimary,
  };
}

module.exports = { createImage, syncLegacyPrimary };
