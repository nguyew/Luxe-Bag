const mongoose = require('mongoose');
const crypto = require('crypto');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { createUpload, deleteObject, uploadObject } = require('../services/b2Storage');

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const fields = ['handbagName', 'brand', 'category', 'cost', 'originalCost', 'percentOff', 'discountMode', 'color', 'gender', 'stock', 'status', 'uri', 'imageKey'];

const validate = (body, partial = false) => {
  const errors = [];
  if (!partial || body.handbagName !== undefined) {
    if (typeof body.handbagName !== 'string' || body.handbagName.trim().length < 2) errors.push('handbagName must be at least 2 characters.');
  }
  if (!partial || body.brand !== undefined) {
    if (typeof body.brand !== 'string' || !body.brand.trim()) errors.push('brand is required.');
  }
  if (!partial || body.cost !== undefined) {
    if (!Number.isFinite(Number(body.cost)) || Number(body.cost) <= 0) errors.push('cost must be greater than 0.');
  }
  if (body.originalCost !== undefined && (!Number.isFinite(Number(body.originalCost)) || Number(body.originalCost) < 0)) errors.push('originalCost must be a non-negative number.');
  if (body.percentOff !== undefined && (!Number.isFinite(Number(body.percentOff)) || Number(body.percentOff) < 0 || Number(body.percentOff) > 0.9)) errors.push('percentOff must be between 0 and 0.9.');
  if (body.discountMode !== undefined && !['real', 'fake'].includes(body.discountMode)) errors.push('discountMode must be real or fake.');
  if (body.stock !== undefined && (!Number.isInteger(Number(body.stock)) || Number(body.stock) < 0)) errors.push('stock must be a non-negative integer.');
  if (body.status !== undefined && !['draft', 'published', 'archived'].includes(body.status)) errors.push('Invalid product status.');
  if (body.color !== undefined && (!Array.isArray(body.color) || body.color.some((value) => typeof value !== 'string'))) errors.push('color must be an array of strings.');
  return errors;
};

const pick = (body) => Object.fromEntries(fields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
const toSlug = (value) => String(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 160);
const createSlug = (body) => {
  const base = toSlug(`${body.brand}-${body.handbagName}`) || 'product';
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
};
const findById = (id) => mongoose.isValidObjectId(id) ? Product.findById(id) : null;
const sendNotFound = (res, id) => res.status(mongoose.isValidObjectId(id) ? 404 : 400).json({ error: mongoose.isValidObjectId(id) ? 'Product not found.' : 'Invalid product id.' });

const attachFeedbacks = async (products, includeHidden = false) => {
  if (!products.length) return products;
  const ids = products.map((product) => product._id);
  const filter = { productId: { $in: ids } };
  if (!includeHidden) filter.hidden = false;
  const reviews = await Review.find(filter).sort({ createdAt: -1 });
  const grouped = new Map();
  for (const review of reviews) {
    const key = String(review.productId);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({
      id: String(review._id),
      userId: String(review.userId),
      author: review.author || 'Anonymous',
      rating: Number(review.rating),
      comment: review.comment || '',
      date: new Date(review.createdAt).toISOString(),
      hidden: review.hidden === true,
    });
  }
  return products.map((product) => ({
    ...(product.toObject ? product.toObject() : product),
    id: String(product._id || product.id),
    feedbacks: grouped.get(String(product._id || product.id)) || [],
  }));
};

const listProducts = async (req, res) => {
  const filter = req.user ? {} : { status: 'published' };
  const products = await Product.find(filter).sort({ createdAt: -1 });
  return res.json({ products: await attachFeedbacks(products, req.user?.role === 'admin') });
};

const getProduct = async (req, res) => {
  const product = await (mongoose.isValidObjectId(req.params.id)
    ? Product.findOne(req.user ? { _id: req.params.id } : { _id: req.params.id, status: 'published' })
    : null);
  if (!product) return sendNotFound(res, req.params.id);
  const [withFeedbacks] = await attachFeedbacks([product], req.user?.role === 'admin');
  return res.json({ product: withFeedbacks });
};

const createProduct = async (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'Validation failed.', details: errors });
  const productData = { ...pick(req.body), slug: createSlug(req.body) };

  // The suffix keeps slugs unique when product names or brands are repeated.
  const product = await Product.create(productData);
  return res.status(201).json({ product });
};

const updateProduct = async (req, res) => {
  const product = await findById(req.params.id);
  if (!product) return sendNotFound(res, req.params.id);
  const errors = validate(req.body || {}, true);
  if (errors.length) return res.status(400).json({ error: 'Validation failed.', details: errors });
  const oldImageKey = product.imageKey;
  Object.assign(product, pick(req.body));
  if (!product.slug) product.slug = createSlug({ brand: product.brand, handbagName: product.handbagName });
  await product.save();
  if (oldImageKey && oldImageKey !== product.imageKey) await deleteObject(oldImageKey);
  return res.json({ product });
};

const validateBulkDiscount = (body) => {
  const errors = [];
  const scope = body.scope;
  const percentOff = Number(body.percentOff);
  if (!['all', 'name', 'brand', 'category'].includes(scope)) errors.push('scope must be all, name, brand, or category.');
  if (scope !== 'all' && (typeof body.value !== 'string' || !body.value.trim())) errors.push('value is required for this scope.');
  if (!Number.isFinite(percentOff) || percentOff < 0 || percentOff > 0.9) errors.push('percentOff must be between 0 and 0.9.');
  if (!['real', 'fake'].includes(body.discountMode)) errors.push('discountMode must be real or fake.');
  return errors;
};

const bulkDiscount = async (req, res) => {
  const body = req.body || {};
  const errors = validateBulkDiscount(body);
  if (errors.length) return res.status(400).json({ error: 'Validation failed.', details: errors });

  const filter = body.scope === 'all' ? {} : { [body.scope === 'name' ? 'handbagName' : body.scope]: body.value.trim() };
  const products = await Product.find(filter);
  const percentOff = Number(body.percentOff);
  const operations = products.map((product) => {
    const currentCost = Number(product.cost);
    const baseCost =
      product.discountMode === 'real' && Number(product.originalCost) > 0
        ? Number(product.originalCost)
        : currentCost;
    const update = percentOff === 0
      ? body.discountMode === 'real'
        ? { $set: { cost: baseCost }, $unset: { originalCost: 1 } }
        : { $unset: { originalCost: 1 } }
      : body.discountMode === 'real'
        ? { $set: { cost: Number((baseCost * (1 - percentOff)).toFixed(2)), originalCost: baseCost } }
        : { $set: { cost: currentCost, originalCost: Number((currentCost / (1 - percentOff)).toFixed(2)) } };

    return {
      updateOne: {
        filter: { _id: product._id },
        update: { ...update, $set: { ...(update.$set || {}), percentOff, discountMode: body.discountMode } },
      },
    };
  });

  if (operations.length) await Product.bulkWrite(operations);
  const updatedProducts = operations.length ? await Product.find(filter) : [];
  return res.json({ updated: updatedProducts.length, products: updatedProducts });
};

const deleteProduct = async (req, res) => {
  const product = await findById(req.params.id);
  if (!product) return sendNotFound(res, req.params.id);
  await Product.deleteOne({ _id: product._id });
  if (product.imageKey) await deleteObject(product.imageKey);
  return res.status(204).send();
};

const createImageUpload = async (req, res) => {
  const { contentType } = req.body || {};
  if (!allowedTypes.has(contentType)) return res.status(400).json({ error: 'Only JPEG, PNG, and WebP images are allowed.' });
  return res.json(await createUpload({ contentType }));
};

const uploadImageProxy = async (req, res) => {
  const contentType = req.headers['content-type'];
  if (!allowedTypes.has(contentType)) {
    return res.status(400).json({ error: 'Only JPEG, PNG, and WebP images are allowed.' });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'An image body is required.' });
  }

  const extension = contentType.split('/')[1];
  const key = `products/${crypto.randomUUID()}.${extension}`;
  const uri = await uploadObject({ key, body: req.body, contentType });
  return res.status(201).json({ key, uri });
};

module.exports = {
  createImageUpload,
  createProduct,
  bulkDiscount,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
  uploadImageProxy,
};
