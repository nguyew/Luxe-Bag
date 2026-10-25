const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');
const {
  createCustomer,
  disableCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} = require('../controllers/customerController');

const router = express.Router();

router.use(authenticate, requireAdmin);

/**
 * @swagger
 * /api/admin/customers:
 *   post:
 *     tags: [Admin - Customers]
 *     summary: Create a customer account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminCustomerRequest'
 *     responses:
 *       201: { description: Customer created }
 *       400: { description: Invalid input }
 *       403: { description: Administrator access required }
 *       409: { description: Email is already registered }
 *   get:
 *     tags: [Admin - Customers]
 *     summary: List customer accounts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100 } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string, enum: [active, disabled] } }
 *     responses:
 *       200: { description: Paginated customers }
 *       403: { description: Administrator access required }
 */
router.route('/customers')
  .post(asyncHandler(createCustomer))
  .get(asyncHandler(listCustomers));

/**
 * @swagger
 * /api/admin/customers/{id}:
 *   get:
 *     tags: [Admin - Customers]
 *     summary: Get one customer account
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Customer details }
 *       404: { description: Customer not found }
 *   patch:
 *     tags: [Admin - Customers]
 *     summary: Update a customer account
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminCustomerUpdateRequest'
 *     responses:
 *       200: { description: Customer updated }
 *       400: { description: Invalid input }
 *       404: { description: Customer not found }
 *       409: { description: Email is already registered }
 */
router.route('/customers/:id')
  .get(asyncHandler(getCustomer))
  .patch(asyncHandler(updateCustomer));

/**
 * @swagger
 * /api/admin/customers/{id}/disable:
 *   patch:
 *     tags: [Admin - Customers]
 *     summary: Disable a customer account
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Customer disabled }
 *       404: { description: Customer not found }
 *       409: { description: Customer is already disabled }
 */
router.patch('/customers/:id/disable', asyncHandler(disableCustomer));

module.exports = router;
