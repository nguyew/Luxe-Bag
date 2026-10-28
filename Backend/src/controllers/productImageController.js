const mongoose = require('mongoose');
const Product = require('../models/Product');
const { deleteObject } = require('../services/b2Storage');
const { createImage, syncLegacyPrimary } = require('../utils/productImages');

async function getProduct(id, res) {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: 'Invalid product id.', code: 'invalid_input' });
    return null;
  }
  const product = await Product.findById(id);
  if (!product) {
    res.status(404).json({ error: 'Product not found.', code: 'not_found' });
    return null;
  }
  return product;
}

function validStorageKey(key) {
  return /^products\/[A-Za-z0-9._/-]+$/.test(key) && !key.includes('..');
}

async function addProductImage(req, res) {
  const product = await getProduct(req.params.id, res);
  if (!product) return;

  const url = String(req.body?.url || req.body?.uri || '').trim();
  const key = String(req.body?.key || req.body?.imageKey || '').trim();
  if (!/^https?:\/\/\S+$/i.test(url) || !validStorageKey(key)) {
    return res.status(400).json({ error: 'A valid image URL and product storage key are required.' });
  }
  if (product.images.length >= 10) {
    return res.status(409).json({ error: 'A product can have at most 10 images.' });
  }
  if (product.images.some((image) => image.key === key)) {
    return res.status(409).json({ error: 'This image is already attached to the product.' });
  }

  const makePrimary = req.body?.isPrimary === true || product.images.length === 0;
  if (makePrimary) product.images.forEach((image) => { image.isPrimary = false; });
  product.images.push(createImage({
    url,
    key,
    alt: req.body?.alt || product.handbagName,
    sortOrder: product.images.length,
    isPrimary: makePrimary,
  }));
  syncLegacyPrimary(product);
  await product.save();
  return res.status(201).json({ product });
}

async function setPrimaryImage(req, res) {
  const product = await getProduct(req.params.id, res);
  if (!product) return;
  const image = product.images.find((item) => item.id === req.params.imageId);
  if (!image) return res.status(404).json({ error: 'Image not found.' });

  product.images.forEach((item) => { item.isPrimary = item.id === image.id; });
  syncLegacyPrimary(product);
  await product.save();
  return res.json({ product });
}

async function reorderImages(req, res) {
  const product = await getProduct(req.params.id, res);
  if (!product) return;
  const ids = req.body?.imageIds;
  if (!Array.isArray(ids) || ids.length !== product.images.length) {
    return res.status(400).json({ error: 'imageIds must contain every image exactly once.' });
  }
  const unique = new Set(ids.map(String));
  if (unique.size !== product.images.length
    || product.images.some((image) => !unique.has(image.id))) {
    return res.status(400).json({ error: 'imageIds must contain every image exactly once.' });
  }

  const positions = new Map(ids.map((id, index) => [String(id), index]));
  product.images.forEach((image) => { image.sortOrder = positions.get(image.id); });
  product.images.sort((left, right) => left.sortOrder - right.sortOrder);
  syncLegacyPrimary(product);
  await product.save();
  return res.json({ product });
}

async function deleteProductImage(req, res) {
  const product = await getProduct(req.params.id, res);
  if (!product) return;
  const index = product.images.findIndex((item) => item.id === req.params.imageId);
  if (index < 0) return res.status(404).json({ error: 'Image not found.' });

  const [removed] = product.images.splice(index, 1);
  product.images.forEach((image, position) => { image.sortOrder = position; });
  syncLegacyPrimary(product);
  await product.save();

  try {
    await deleteObject(removed.key);
  } catch (error) {
    console.warn('Could not delete product image object:', error.message);
  }
  return res.json({ product });
}

module.exports = {
  addProductImage,
  deleteProductImage,
  reorderImages,
  setPrimaryImage,
};
