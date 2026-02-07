const express = require('express');
const router = express.Router();
const OfferController = require('../../../controllers/restaurantportal/offers/OfferController');

// Add new endpoint
router.get('/food-items', OfferController.getFoodItemsByRestaurant);

// Existing routes
router.get('/', OfferController.getOffersByRestaurant);
router.post('/', OfferController.createOffer);
router.put('/:offerId', OfferController.updateOffer);
router.patch('/:offerId/status', OfferController.toggleOfferStatus);
router.delete('/:offerId', OfferController.deleteOffer);
router.get('/:campaignId/analytics', OfferController.getCampaignAnalytics);

module.exports = router;