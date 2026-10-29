const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');
const {
  createPromotion, deletePromotion, listPromotions, updatePromotion,
} = require('../controllers/promotionController');

const router = express.Router();
/**
 * @swagger
 * /api/promotions:
 *   get:
 *     tags: [Promotions]
 *     summary: List active promotions available to the authenticated customer
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Active promotions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 promotions: { type: array, items: { $ref: '#/components/schemas/Promotion' } }
 *       401: { description: Authentication required }
 */
router.get('/', authenticate, asyncHandler(listPromotions));
router.use(authenticate, requireAdmin);
router.post('/', asyncHandler(createPromotion));
router.patch('/:id', asyncHandler(updatePromotion));
router.delete('/:id', asyncHandler(deletePromotion));
module.exports = router;
