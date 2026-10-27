const express = require('express');
const { askStylist } = require('../controllers/aiController');

const router = express.Router();
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
router.post('/stylist', askStylist);

module.exports = router;
