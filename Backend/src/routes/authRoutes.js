const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authenticate = require('../middleware/authenticate');
const { getCurrentUser, updateCurrentUser, updateAvatar, deleteAvatar, login, register } = require('../controllers/authController');

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a customer account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Account created and JWT issued
 *       400:
 *         description: Invalid input
 *       409:
 *         description: Email is already registered
 */
router.post('/register', asyncHandler(register));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Sign in with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: JWT issued
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', asyncHandler(login));

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *       401:
 *         description: Missing or invalid JWT
 */
router.route('/me')
  /**
   * @swagger
   * /api/auth/me:
   *   get:
   *     tags: [Authentication]
   *     summary: Get the authenticated user
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Current user }
   *       401: { description: Missing or invalid JWT }
   *   patch:
   *     tags: [Authentication]
   *     summary: Update the authenticated user's profile
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name: { type: string }
   *               phone: { type: string }
   *               addresses: { type: array, items: { $ref: '#/components/schemas/Address' } }
   *     responses:
   *       200: { description: Profile updated }
   *       400: { description: Invalid profile }
   */
  .get(authenticate, getCurrentUser)
  .patch(authenticate, asyncHandler(updateCurrentUser));

/**
 * @swagger
 * /api/auth/me/avatar:
 *   put:
 *     tags: [Authentication]
 *     summary: Upload the authenticated user's avatar
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         image/jpeg: { schema: { type: string, format: binary } }
 *         image/png: { schema: { type: string, format: binary } }
 *         image/webp: { schema: { type: string, format: binary } }
 *     responses:
 *       200: { description: Avatar uploaded }
 *       400: { description: Invalid image body or type }
 */
router.put(
  '/me/avatar',
  authenticate,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }),
  asyncHandler(updateAvatar)
);
/**
 * @swagger
 * /api/auth/me/avatar:
 *   delete:
 *     tags: [Authentication]
 *     summary: Delete the authenticated user's avatar
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Avatar deleted }
 */
router.delete('/me/avatar', authenticate, asyncHandler(deleteAvatar));

module.exports = router;
