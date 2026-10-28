const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authenticate = require('../middleware/authenticate');
const { getCart, replaceCart } = require('../controllers/cartController');

const router = express.Router();
router.use(authenticate);
/**
 * @swagger
 * /api/cart:
 *   get:
 *     tags: [Cart]
 *     summary: Get the authenticated customer's cart
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Cart contents }
 *   put:
 *     tags: [Cart]
 *     summary: Replace the authenticated customer's cart
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items: { type: array, items: { $ref: '#/components/schemas/CartItem' } }
 *     responses:
 *       200: { description: Cart saved }
 *       400: { description: Invalid cart }
 */
router.get('/', asyncHandler(getCart));
router.put('/', asyncHandler(replaceCart));

module.exports = router;
