const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { listPublicTerms } = require('../controllers/catalogController');

const router = express.Router();

/**
 * @swagger
 * /api/catalog/{type}:
 *   get:
 *     tags: [Catalog]
 *     summary: List active brands or categories
 *     parameters:
 *       - { in: path, name: type, required: true, schema: { type: string, enum: [brand, category] } }
 *     responses:
 *       200: { description: Active catalog terms }
 *       400: { description: Invalid catalog type }
 */
router.get('/:type', asyncHandler(listPublicTerms));

module.exports = router;
