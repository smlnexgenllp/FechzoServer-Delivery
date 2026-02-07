// routes/performance/performanceRoutes.js
const express = require('express');
const router = express.Router();
const PerformanceController = require('../../../controllers/restaurantportal/offers/PerformanceController');

router.get('/', PerformanceController.getPerformanceData);

module.exports = router;