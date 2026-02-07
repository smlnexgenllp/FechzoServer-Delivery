const express = require('express');
const router = express.Router();
const notificationController = require('../../controllers/restaurants/notificationController');

// Get all notifications for a restaurant
router.get('/:restaurantId', notificationController.getNotifications);

// Mark a notification as read
router.patch('/:restaurantId/:notificationId/read', notificationController.markAsRead);

// Mark all notifications as read
router.patch('/:restaurantId/read-all', notificationController.markAllAsRead);

module.exports = router;