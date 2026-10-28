const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authenticate = require('../middleware/authenticate');
const { deleteMyReview, listProductReviews, upsertMyReview } = require('../controllers/reviewController');

const router = express.Router({ mergeParams: true });
/**
 * @swagger
 * /api/products/{productId}/reviews:
 *   get:
 *     tags: [Reviews]
 *     summary: List visible reviews for a published product
 *     parameters:
 *       - { in: path, name: productId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Product reviews }
 *       404: { description: Product not found }
 *   post:
 *     tags: [Reviews]
 *     summary: Create or update the authenticated customer's review
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: productId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string, maxLength: 500 }
 *     responses:
 *       201: { description: Review created }
 *       200: { description: Review updated }
 *       403: { description: Customer has not received the product }
 */
router.get('/', asyncHandler(listProductReviews));
router.post('/', authenticate, asyncHandler(upsertMyReview));
/**
 * @swagger
 * /api/products/{productId}/reviews/mine:
 *   delete:
 *     tags: [Reviews]
 *     summary: Delete the authenticated customer's review
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: productId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Review deleted }
 *       404: { description: Review not found }
 */
router.delete('/mine', authenticate, asyncHandler(deleteMyReview));

module.exports = router;
