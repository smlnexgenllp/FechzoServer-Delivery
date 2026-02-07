const express = require('express');
const router = express.Router();

const cartController = require ('../../../controllers/food/restaurantPage/FoodCart');


router.put('/update', cartController.updateCartItem);

module.exports = router;