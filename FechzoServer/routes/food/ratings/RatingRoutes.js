// routes/food/ratingRoutes.js
const express = require('express');
const {submitRating}=require('../../../controllers/food/ratings/RatingsControllers.js');

const router = express.Router();

router.post('/submitratings', submitRating);

module.exports = router;
