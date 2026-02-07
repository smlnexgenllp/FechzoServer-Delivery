const express = require('express');
const router = express.Router();
const { fetchFoodAndRestaurants} = require("../../controllers/food/searchList/FoodSearchController");
// const {getFoodByRestaurant} = require("../../controllers/food/restaurantPage/FoodItemController");
const OfferRoutes = require("./offers/OfferRoutes"); // Import the offer routes
const RestaurantRoutes=require('./restaurantPage/RestaurantPageRoutes');
const HomePageRoutes=require("./homePage/HomePageRoutes");
const OrderRoutes=require("./order/OrderFoodRoutes")
const FavoriteRoutes=require("./favorite/FavoriteRoutes")
const RatingRoutes = require("./ratings/RatingRoutes")
const CartRoutes = require("./cart/CartPageRoutes");
const { searchFoods,searchRestaurants } = require('../../controllers/food/searchList/RestaurantSearchController');
const GoogleMapsRoutes =  require("./googleMap/distance.js");
const {searchMainRestaurants} = require('../../controllers/food/searchList/RestaurantMainSearch.js');
// Base route for food
router.get('/', (req, res) => {
  res.send("Food page");
});

// router.get('/getFoodByRestaurant', getFoodByRestaurant);

// router.get('/getFood',getFoodByRestaurant);

router.use('/home',HomePageRoutes);

router.use("/offers",OfferRoutes);

router.use("/restaurants",RestaurantRoutes);

router.use("/favorite",FavoriteRoutes);

router.use("/rating", RatingRoutes);

router.get("/search", fetchFoodAndRestaurants);

router.use("/order", OrderRoutes);

router.use("/carts", CartRoutes);
router.get('/restaurantssearch', searchRestaurants);
router.get('/foodsearch', searchFoods);
router.use("/googlemaps",GoogleMapsRoutes);
router.get('/restaurantsmainsearch', searchMainRestaurants);
module.exports = router;
