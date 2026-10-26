const mongoose = require('mongoose');
const Product = require('../models/Product');
const { createUpload, deleteObject, uploadObject } = require('../services/b2Storage');

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const fields = ['handbagName', 'brand', 'category', 'cost', 'percentOff', 'color', 'gender', 'stock', 'status', 'uri', 'imageKey'];

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
  if (body.percentOff !== undefined && (!Number.isFinite(Number(body.percentOff)) || Number(body.percentOff) < 0 || Number(body.percentOff) > 0.9)) errors.push('percentOff must be between 0 and 0.9.');
  if (body.stock !== undefined && (!Number.isInteger(Number(body.stock)) || Number(body.stock) < 0)) errors.push('stock must be a non-negative integer.');
  if (body.status !== undefined && !['draft', 'published', 'archived'].includes(body.status)) errors.push('Invalid product status.');
  if (body.color !== undefined && (!Array.isArray(body.color) || body.color.some((value) => typeof value !== 'string'))) errors.push('color must be an array of strings.');
  return errors;
};

const pick = (body) => Object.fromEntries(fields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
const findById = (id) => mongoose.isValidObjectId(id) ? Product.findById(id) : null;
const sendNotFound = (res, id) => res.status(mongoose.isValidObjectId(id) ? 404 : 400).json({ error: mongoose.isValidObjectId(id) ? 'Product not found.' : 'Invalid product id.' });

const listProducts = async (req, res) => {
  const filter = req.user ? {} : { status: 'published' };
  const products = await Product.find(filter).sort({ createdAt: -1 });
  return res.json({ products });
};

const getProduct = async (req, res) => {
  const product = await (mongoose.isValidObjectId(req.params.id)
    ? Product.findOne(req.user ? { _id: req.params.id } : { _id: req.params.id, status: 'published' })
    : null);
  if (!product) return sendNotFound(res, req.params.id);
  return res.json({ product });
};

const createProduct = async (req, res) => {
  const errors = validate(req.body || {});
  if (errors.length) return res.status(400).json({ error: 'Validation failed.', details: errors });
  const product = await Product.create(pick(req.body));
  return res.status(201).json({ product });
};

const updateProduct = async (req, res) => {
  const product = await findById(req.params.id);
  if (!product) return sendNotFound(res, req.params.id);
  const errors = validate(req.body || {}, true);
  if (errors.length) return res.status(400).json({ error: 'Validation failed.', details: errors });
  const oldImageKey = product.imageKey;
  Object.assign(product, pick(req.body));
  await product.save();
  if (oldImageKey && oldImageKey !== product.imageKey) await deleteObject(oldImageKey);
  return res.json({ product });
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
  const key = `products/${require('crypto').randomUUID()}.${extension}`;
  const uri = await uploadObject({ key, body: req.body, contentType });
  return res.status(201).json({ key, uri });
};

module.exports = {
  createImageUpload,
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
  uploadImageProxy,
};
