const express = require('express');
const router = express.Router();
const AdminOfferController = require('../../controllers/admin/AdminOfferController');

// Get all offers
router.get('/', AdminOfferController.getAllOffers);

// SPECIFIC ROUTES FIRST
// Get offer statistics - specific path
router.get('/stats/overview', AdminOfferController.getOfferStats);

// Get combined offers - specific path
router.get('/combined', AdminOfferController.getAllCombinedOffers);

// Bulk operations endpoint
router.post('/bulk', AdminOfferController.bulkUpdateOffers);

// WILDCARD ROUTES LAST
// Get offer by ID - this has a wildcard parameter so should come AFTER specific routes
router.get('/:id', AdminOfferController.getOfferById);

// Other routes with parameters
router.put('/:id', AdminOfferController.updateOffer);
router.patch('/:id/status', AdminOfferController.toggleOfferStatus);
router.delete('/:id', AdminOfferController.deleteOffer);

// Create new offer
router.post('/', AdminOfferController.createOffer);

module.exports = router;