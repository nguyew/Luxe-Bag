const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { getProduct, listProducts } = require('../controllers/productController');

const router = express.Router();

/**
 * @swagger
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: List published handbag products
 *     responses:
 *       200:
 *         description: Published products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 */
router.get('/', asyncHandler(listProducts));

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get one published handbag product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product:
 *                   $ref: '#/components/schemas/Product'
 *       404: { description: Product not found }
 */
router.get('/:id', asyncHandler(getProduct));

module.exports = router;
