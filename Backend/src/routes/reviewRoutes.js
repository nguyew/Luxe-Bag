const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authenticate = require('../middleware/authenticate');
const { deleteMyReview, listProductReviews, upsertMyReview } = require('../controllers/reviewController');

const router = express.Router({ mergeParams: true });
router.get('/', asyncHandler(listProductReviews));
router.post('/', authenticate, asyncHandler(upsertMyReview));
router.delete('/mine', authenticate, asyncHandler(deleteMyReview));

module.exports = router;
