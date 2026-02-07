const express = require('express');
const router = express.Router();
const {getRestaurantDetails}=require('../../../controllers/food/restaurantPage/RestaurantInfoController');
const menuController = require('../../../controllers/food/restaurantPage/RestaurantMenu');
const cartController = require("../../../controllers/food/restaurantPage/FoodCart");
const ratingController = require('../../../controllers/food/restaurantPage/RestaurantReviewsControllers');


router.get("/restaurantdetails/:id",getRestaurantDetails);

// Get reviews for a restaurant
router.get('/reviews', ratingController.getReviewsByRestaurant);

router.get('/restaurantsmenu/:restaurantId/menu', menuController.getRestaurantMenu);
// Mark a review as helpful (no authentication required)
router.post('/reviews/:reviewId/helpful', ratingController.markReviewHelpful);

router.post("/cart", cartController.addToCart);
router.get("/carts", cartController.getCart);
router.delete("/cart/:userId", cartController.deleteCart); // Add this line

module.exports = router;