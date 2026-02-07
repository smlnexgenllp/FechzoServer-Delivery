const express = require('express');
const router = express.Router();
const BranchController = require('../../../controllers/restaurantportal/offers/BranchController');

router.get('/:restaurantId/branches', BranchController.getBranchesByRestaurant);

module.exports = router;