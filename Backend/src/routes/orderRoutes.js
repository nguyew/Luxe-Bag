const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authenticate = require('../middleware/authenticate');
const { cancelMyOrder, createOrder, getMyOrder, listMyOrders, requestReturn } = require('../controllers/orderController');

const router = express.Router();
router.use(authenticate);
router.post('/', asyncHandler(createOrder));
router.get('/my', asyncHandler(listMyOrders));
router.get('/:id', asyncHandler(getMyOrder));
router.patch('/:id/cancel', asyncHandler(cancelMyOrder));
router.post('/:id/return-requests', asyncHandler(requestReturn));

module.exports = router;
