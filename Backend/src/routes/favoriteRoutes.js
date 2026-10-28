const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authenticate = require('../middleware/authenticate');
const { getFavorites, replaceFavorites } = require('../controllers/favoriteController');

const router = express.Router();
router.use(authenticate);
/**
 * @swagger
 * /api/favorites:
 *   get:
 *     tags: [Favorites]
 *     summary: Get the authenticated customer's favorite products
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Favorite products }
 *   put:
 *     tags: [Favorites]
 *     summary: Replace the authenticated customer's favorites
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [favorites]
 *             properties:
 *               favorites: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Favorites saved }
 *       400: { description: Invalid favorites }
 */
router.get('/', asyncHandler(getFavorites));
router.put('/', asyncHandler(replaceFavorites));

module.exports = router;
