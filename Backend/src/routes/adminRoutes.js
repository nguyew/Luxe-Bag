const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/requireAdmin');
const {
  createCustomer,
  disableCustomer,
  enableCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} = require('../controllers/customerController');
const {
  createImageUpload,
  createProduct,
  bulkDiscount,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
  uploadImageProxy,
} = require('../controllers/productController');

const { listAdminOrders, updateAdminOrderStatus, resolveAdminReturn } = require('../controllers/adminOrderController');

const router = express.Router();

router.use(authenticate, requireAdmin);

// Admin order management (orders are stored in the Order collection, not User documents).
router.get('/orders', asyncHandler(listAdminOrders));
router.patch('/orders/:id/status', asyncHandler(updateAdminOrderStatus));
router.patch('/orders/:id/return-request', asyncHandler(resolveAdminReturn));

/**
 * @swagger
 * /api/admin/products:
 *   get:
 *     tags: [Admin - Products]
 *     summary: List all handbag products
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All products, including drafts and archived products
 *   post:
 *     tags: [Admin - Products]
 *     summary: Create a handbag product
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductCreateRequest'
 *     responses:
 *       201: { description: Product created }
 *       400: { description: Validation failed }
 *       403: { description: Administrator access required }
 */
router.route('/products')
  .post(asyncHandler(createProduct))
  .get(asyncHandler(listProducts));

/**
 * @swagger
 * /api/admin/products/bulk-discount:
 *   post:
 *     tags: [Admin - Products]
 *     summary: Apply a real or display-only discount to a product group
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Products updated }
 *       400: { description: Validation failed }
 */
router.post('/products/bulk-discount', asyncHandler(bulkDiscount));

/**
 * @swagger
 * /api/admin/products/{id}:
 *   get:
 *     tags: [Admin - Products]
 *     summary: Get one handbag product
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Product details }
 *       404: { description: Product not found }
 *   patch:
 *     tags: [Admin - Products]
 *     summary: Update a handbag product
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductUpdateRequest'
 *     responses:
 *       200: { description: Product updated }
 *       400: { description: Validation failed }
 *       404: { description: Product not found }
 *   delete:
 *     tags: [Admin - Products]
 *     summary: Permanently delete a handbag product and its B2 image
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Product deleted }
 *       404: { description: Product not found }
 */
router.route('/products/:id')
  .get(asyncHandler(getProduct))
  .patch(asyncHandler(updateProduct))
  .delete(asyncHandler(deleteProduct));

/**
 * @swagger
 * /api/admin/products/image-upload:
 *   post:
 *     tags: [Admin - Products]
 *     summary: Create a presigned B2 image upload URL
 *     description: The mobile client can upload directly to Backblaze B2 with the returned URL.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ImageUploadRequest'
 *     responses:
 *       200:
 *         description: Presigned upload URL
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImageUploadResponse'
 *       400: { description: Unsupported image type }
 *       503: { description: Backblaze B2 is not configured }
 */
router.post('/products/image-upload', asyncHandler(createImageUpload));

/**
 * @swagger
 * /api/admin/products/image-upload/proxy:
 *   post:
 *     tags: [Admin - Products]
 *     summary: Upload an image through the API to Backblaze B2
 *     description: Use this endpoint from browsers when direct B2 upload is blocked by bucket CORS.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         image/jpeg: { schema: { type: string, format: binary } }
 *         image/png: { schema: { type: string, format: binary } }
 *         image/webp: { schema: { type: string, format: binary } }
 *     responses:
 *       201:
 *         description: Image uploaded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImageUploadResponse'
 *       400: { description: Invalid image body or unsupported image type }
 *       503: { description: Backblaze B2 is not configured }
 */
router.post(
  '/products/image-upload/proxy',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '10mb' }),
  asyncHandler(uploadImageProxy)
);
router.route('/products')
  .post(asyncHandler(createProduct))
  .get(asyncHandler(listProducts));
router.route('/products/:id')
  .get(asyncHandler(getProduct))
  .patch(asyncHandler(updateProduct))
  .delete(asyncHandler(deleteProduct));

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

/**
 * @swagger
 * /api/admin/customers/{id}/enable:
 *   patch:
 *     tags: [Admin - Customers]
 *     summary: Enable a disabled customer account
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Customer enabled }
 *       404: { description: Customer not found }
 *       409: { description: Customer is already active }
 */
router.patch('/customers/:id/enable', asyncHandler(enableCustomer));

module.exports = router;
