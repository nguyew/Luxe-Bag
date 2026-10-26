const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authenticate = require('../middleware/authenticate');
const { getCart, replaceCart } = require('../controllers/cartController');

const router = express.Router();
router.use(authenticate);
router.get('/', asyncHandler(getCart));
router.put('/', asyncHandler(replaceCart));

module.exports = router;
