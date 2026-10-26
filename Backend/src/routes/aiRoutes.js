const express = require('express');
const { askStylist } = require('../controllers/aiController');

const router = express.Router();
router.post('/stylist', askStylist);

module.exports = router;
