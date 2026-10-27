const express = require('express');
const { getHealth } = require('../controllers/healthController');

const router = express.Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [System]
 *     summary: Check API and database health
 *     responses:
 *       200:
 *         description: Health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 database: { type: string, example: connected }
 *                 timestamp: { type: string, format: date-time }
 */
router.get('/', getHealth);

module.exports = router;
