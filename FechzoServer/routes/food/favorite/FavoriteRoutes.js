const express = require('express');
const router = express.Router();
const favoriteController = require('../../../controllers/food/favorite/FavoriteControllers');

router.get('/get', favoriteController.getFavorites);
router.post('/toggle', favoriteController.toggleFavorite);

module.exports = router;
