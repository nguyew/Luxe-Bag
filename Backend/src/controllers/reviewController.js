const mongoose = require('mongoose');
const Product = require('../models/Product');
const Review = require('../models/Review');
const Order = require('../models/Order');

const serializeReview = (review) => {
  const raw = review.toObject ? review.toObject() : review;
  return {
    id: String(raw._id || raw.id),
    productId: String(raw.productId),
    userId: String(raw.userId),
    author: raw.author || 'Anonymous',
    rating: Number(raw.rating),
    comment: raw.comment || '',
    date: new Date(raw.createdAt || raw.date || Date.now()).toISOString(),
    hidden: raw.hidden === true,
  };
};

const validProduct = async (productId) => mongoose.isValidObjectId(productId)
  ? Product.findOne({ _id: productId, status: 'published' })
  : null;

const listProductReviews = async (req, res) => {
  const product = await validProduct(req.params.productId);
  if (!product) return res.status(404).json({ error: 'Product not found.', code: 'not_found' });
  const reviews = await Review.find({ productId: product._id, hidden: false }).sort({ createdAt: -1 });
  return res.json({ reviews: reviews.map(serializeReview) });
};

const upsertMyReview = async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) return res.status(400).json({ error: 'Invalid product id.', code: 'invalid_input' });
  const product = await Product.findOne({ _id: productId, status: 'published' });
  if (!product) return res.status(404).json({ error: 'Product not found.', code: 'not_found' });

  const rating = Number(req.body?.rating);
  const comment = String(req.body?.comment ?? '').trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Please choose a rating from 1 to 5 stars.', code: 'invalid_input' });
  }
  if (comment.length > 500) return res.status(400).json({ error: 'Review must be 500 characters or fewer.', code: 'invalid_input' });

  const deliveredOrder = await Order.findOne({
    userId: req.user._id,
    status: 'delivered',
    'items.productId': product._id,
  }).select('_id');
  const existing = await Review.findOne({ productId: product._id, userId: req.user._id });
  if (!existing && !deliveredOrder) {
    return res.status(403).json({ error: 'Only customers who received this item can review it.', code: 'not_purchased' });
  }

  const review = existing || new Review({ productId: product._id, userId: req.user._id });
  review.author = req.user.name || 'Customer';
  review.rating = rating;
  review.comment = comment;
  // Keep moderation state when the author edits an existing review.
  await review.save();
  return res.status(existing ? 200 : 201).json({ review: serializeReview(review) });
};

const deleteMyReview = async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) return res.status(400).json({ error: 'Invalid product id.', code: 'invalid_input' });
  const deleted = await Review.findOneAndDelete({ productId, userId: req.user._id });
  if (!deleted) return res.status(404).json({ error: 'Review not found.', code: 'not_found' });
  return res.json({ success: true, id: String(deleted._id) });
};

const listAdminReviews = async (req, res) => {
  const filter = {};
  if (req.query.productId && mongoose.isValidObjectId(req.query.productId)) filter.productId = req.query.productId;
  const reviews = await Review.find(filter).sort({ createdAt: -1 }).limit(1000);
  return res.json({ reviews: reviews.map(serializeReview) });
};

const moderateReview = async (req, res) => {
  const { reviewId } = req.params;
  if (!mongoose.isValidObjectId(reviewId)) return res.status(400).json({ error: 'Invalid review id.', code: 'invalid_input' });
  const hidden = req.body?.hidden;
  if (typeof hidden !== 'boolean') return res.status(400).json({ error: 'hidden must be a boolean.', code: 'invalid_input' });
  const review = await Review.findByIdAndUpdate(reviewId, { $set: { hidden } }, { new: true, runValidators: true });
  if (!review) return res.status(404).json({ error: 'Review not found.', code: 'not_found' });
  return res.json({ review: serializeReview(review) });
};

const deleteAdminReview = async (req, res) => {
  const { reviewId } = req.params;
  if (!mongoose.isValidObjectId(reviewId)) return res.status(400).json({ error: 'Invalid review id.', code: 'invalid_input' });
  const deleted = await Review.findByIdAndDelete(reviewId);
  if (!deleted) return res.status(404).json({ error: 'Review not found.', code: 'not_found' });
  return res.json({ success: true, id: String(deleted._id) });
};

module.exports = { deleteAdminReview, deleteMyReview, listAdminReviews, listProductReviews, moderateReview, upsertMyReview };
