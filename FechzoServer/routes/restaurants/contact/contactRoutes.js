const express = require('express');
const router = express.Router();
const contactController = require('../../../controllers/restaurants/ContactController'); // Adjust path as necessary

router.get('/:restaurantId', contactController.getRestaurantContact);
router.put('/:restaurantId/update-owner', contactController.updateOwnerDetails);
router.post('/:restaurantId/send-invite', contactController.sendInvite);
router.post('/:restaurantId/accept-invite', contactController.acceptInvite);
router.put('/:restaurantId/update-social-media', contactController.updateSocialMedia);

module.exports = router;