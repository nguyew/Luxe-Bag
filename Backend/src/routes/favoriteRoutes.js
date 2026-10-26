const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authenticate = require('../middleware/authenticate');
const { getFavorites, replaceFavorites } = require('../controllers/favoriteController');

const router = express.Router();
router.use(authenticate);
router.get('/', asyncHandler(getFavorites));
router.put('/', asyncHandler(replaceFavorites));

module.exports = router;
