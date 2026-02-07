const express = require('express');
const router = express.Router();
const foodinventoryController = require('../../../controllers/restaurantportal/dashboard/MenuInventorycontroller');
const dashboardController = require('../../../controllers/restaurantportal/dashboard/MenuDashboardController');
// Route to fetch foods by restaurant ID
router.get('/inventoryfoods', foodinventoryController.getFoodsByRestaurant);

// Route to update food status
router.put('/foods/:foodId/status', foodinventoryController.updateFoodStatus);

// Route to update food auto-update settings
router.put('/foods/:foodId/auto-settings', foodinventoryController.updateFoodAutoSettings);

router.get('/restaurantdashboard', dashboardController.getDashboardStats);

module.exports = router;