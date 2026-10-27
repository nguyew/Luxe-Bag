const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authenticate = require('../middleware/authenticate');
const { cancelMyOrder, createOrder, getMyOrder, listMyOrders, requestReturn } = require('../controllers/orderController');

const router = express.Router();
router.use(authenticate);
/**
 * @swagger
 * /api/orders:
 *   post:
 *     tags: [Orders]
 *     summary: Place an order
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items, address, paymentMethod]
 *             properties:
 *               items: { type: array, items: { $ref: '#/components/schemas/OrderItem' } }
 *               address: { $ref: '#/components/schemas/Address' }
 *               paymentMethod: { type: string, enum: [cod, card] }
 *               couponCode: { type: string }
 *     responses:
 *       201: { description: Order created }
 *       400: { description: Invalid order }
 *       409: { description: Product stock is unavailable }
 */
router.post('/', asyncHandler(createOrder));
/**
 * @swagger
 * /api/orders/my:
 *   get:
 *     tags: [Orders]
 *     summary: List the authenticated customer's orders
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Customer orders }
 */
router.get('/my', asyncHandler(listMyOrders));
/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Get one of the authenticated customer's orders
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Order details }
 *       404: { description: Order not found }
 */
router.get('/:id', asyncHandler(getMyOrder));
/**
 * @swagger
 * /api/orders/{id}/cancel:
 *   patch:
 *     tags: [Orders]
 *     summary: Cancel a pending order
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Order cancelled }
 *       409: { description: Order cannot be cancelled }
 */
router.patch('/:id/cancel', asyncHandler(cancelMyOrder));
/**
 * @swagger
 * /api/orders/{id}/return-requests:
 *   post:
 *     tags: [Orders]
 *     summary: Request a return for a delivered order
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string }
 *               note: { type: string }
 *     responses:
 *       201: { description: Return request created }
 *       400: { description: Invalid return request }
 *       409: { description: Return request is not allowed }
 */
router.post('/:id/return-requests', asyncHandler(requestReturn));

module.exports = router;
