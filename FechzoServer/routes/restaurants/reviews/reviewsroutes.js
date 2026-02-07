// routes/api/food/ratingRoutes.js
const express = require('express');
const router = express.Router();
const ratingController = require('../../../controllers/restaurantportal/reviews/ReviewControllers');

// Get reviews by string restaurantId
router.get('/allreviews', ratingController.getAllReviews);


module.exports = router;
