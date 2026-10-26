const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { listPublicCoupons } = require('../controllers/couponController');

const router = express.Router();
router.get('/', asyncHandler(listPublicCoupons));

module.exports = router;
