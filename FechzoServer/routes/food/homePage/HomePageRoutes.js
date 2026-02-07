
const express = require('express');
const router = express.Router();
const {getAllRestaurants}=require('../../../controllers/food/homePage/RestaurantController')

router.get("/getRestaurants",getAllRestaurants);

module.exports = router;