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
const { deleteAdminReview, listAdminReviews, moderateReview } = require('../controllers/reviewController');
const { createCoupon, deleteCoupon, listAdminCoupons, updateCoupon } = require('../controllers/couponController');

const router = express.Router();

router.use(authenticate, requireAdmin);

/**
 * @swagger
 * /api/admin/orders:
 *   get:
 *     tags: [Admin - Orders]
 *     summary: List all customer orders
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 500 } }
 *       - { in: query, name: status, schema: { type: string } }
 *     responses:
 *       200: { description: Paginated orders }
 */
router.get('/orders', asyncHandler(listAdminOrders));
/**
 * @swagger
 * /api/admin/orders/{id}/status:
 *   patch:
 *     tags: [Admin - Orders]
 *     summary: Update an order status
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string }
 *     responses:
 *       200: { description: Order updated }
 *       400: { description: Invalid status }
 *       404: { description: Order not found }
 */
router.patch('/orders/:id/status', asyncHandler(updateAdminOrderStatus));
/**
 * @swagger
 * /api/admin/orders/{id}/return-request:
 *   patch:
 *     tags: [Admin - Orders]
 *     summary: Approve or reject an order return request
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision]
 *             properties:
 *               decision: { type: string, enum: [approved, rejected] }
 *               restock: { type: boolean, default: false }
 *               note: { type: string }
 *     responses:
 *       200: { description: Return request resolved }
 *       400: { description: Invalid decision }
 *       404: { description: Order not found }
 */
router.patch('/orders/:id/return-request', asyncHandler(resolveAdminReturn));
/**
 * @swagger
 * /api/admin/reviews:
 *   get:
 *     tags: [Admin - Reviews]
 *     summary: List product reviews for moderation
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: productId, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reviews: { type: array, items: { $ref: '#/components/schemas/Review' } }
 */
router.get('/reviews', asyncHandler(listAdminReviews));
/**
 * @swagger
 * /api/admin/reviews/{reviewId}/moderation:
 *   patch:
 *     tags: [Admin - Reviews]
 *     summary: Hide or show a product review
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: reviewId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [hidden]
 *             properties:
 *               hidden: { type: boolean }
 *     responses:
 *       200: { description: Review moderated }
 *       404: { description: Review not found }
 */
router.patch('/reviews/:reviewId/moderation', asyncHandler(moderateReview));
/**
 * @swagger
 * /api/admin/reviews/{reviewId}:
 *   delete:
 *     tags: [Admin - Reviews]
 *     summary: Delete a product review
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: reviewId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Review deleted }
 *       400: { description: Invalid review id }
 *       404: { description: Review not found }
 */
router.delete('/reviews/:reviewId', asyncHandler(deleteAdminReview));
/**
 * @swagger
 * /api/admin/coupons:
 *   get:
 *     tags: [Admin - Coupons]
 *     summary: List all coupons
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Coupons }
 *   post:
 *     tags: [Admin - Coupons]
 *     summary: Create a coupon
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/Coupon'
 *             required: [id, code, type, value]
 *     responses:
 *       201: { description: Coupon created }
 *       400: { description: Invalid coupon }
 *       409: { description: Duplicate coupon }
 */
router.get('/coupons', asyncHandler(listAdminCoupons));
router.post('/coupons', asyncHandler(createCoupon));
/**
 * @swagger
 * /api/admin/coupons/{id}:
 *   patch:
 *     tags: [Admin - Coupons]
 *     summary: Update a coupon
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Coupon' }
 *     responses:
 *       200: { description: Coupon updated }
 *       404: { description: Coupon not found }
 *   delete:
 *     tags: [Admin - Coupons]
 *     summary: Delete a coupon
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Coupon deleted }
 *       404: { description: Coupon not found }
 */
router.patch('/coupons/:id', asyncHandler(updateCoupon));
router.delete('/coupons/:id', asyncHandler(deleteCoupon));

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
