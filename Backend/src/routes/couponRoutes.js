const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { listPublicCoupons } = require('../controllers/couponController');

const router = express.Router();
/**
 * @swagger
 * /api/coupons:
 *   get:
 *     tags: [Coupons]
 *     summary: List currently usable public coupons
 *     responses:
 *       200:
 *         description: Active coupons
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 coupons: { type: array, items: { $ref: '#/components/schemas/Coupon' } }
 */
router.get('/', asyncHandler(listPublicCoupons));

module.exports = router;
