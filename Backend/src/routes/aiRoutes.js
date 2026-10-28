const express = require('express');
const { rateLimit } = require('express-rate-limit');
const asyncHandler = require('../middleware/asyncHandler');
const { askStylist } = require('../controllers/aiController');

const router = express.Router();
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait a moment.', code: 'rate_limited' },
});
/**
 * @swagger
 * /api/ai/stylist:
 *   post:
 *     tags: [AI Stylist]
 *     summary: Get handbag recommendations from the AI stylist
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StylistRequest'
 *     responses:
 *       200:
 *         description: AI stylist response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 outputText: { type: string }
 *       400: { description: Invalid stylist request }
 *       503: { description: AI Stylist is not configured }
 */
router.post('/stylist', aiLimiter, asyncHandler(askStylist));

module.exports = router;
