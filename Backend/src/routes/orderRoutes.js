const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authenticate = require('../middleware/authenticate');
const {
  cancelMyOrder,
  createOrder,
  getMyOrder,
  listMyOrders,
  listPurchasedBags,
  requestReturn,
} = require('../controllers/orderController');

const router = express.Router();
router.use(authenticate);
router.post('/', asyncHandler(createOrder));
router.get('/my', asyncHandler(listMyOrders));

/**
 * @swagger
 * /api/orders/purchased:
 *   get:
 *     tags: [Orders]
 *     summary: List the bags the authenticated customer has purchased successfully
 *     description: >
 *       Returns one entry per product from the customer's delivered orders (cancelled,
 *       returned and in-progress orders are not counted), newest purchase first.
 *       Registered before `/api/orders/{id}` so "purchased" is not read as an order id.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Purchased bags with totals
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PurchasedBagsResponse'
 *       401:
 *         description: Authentication required
 */
// Must stay above '/:id', otherwise Express would treat "purchased" as an order id.
router.get('/purchased', asyncHandler(listPurchasedBags));
router.get('/:id', asyncHandler(getMyOrder));
router.patch('/:id/cancel', asyncHandler(cancelMyOrder));
router.post('/:id/return-requests', asyncHandler(requestReturn));

module.exports = router;