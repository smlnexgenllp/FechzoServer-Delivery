const express = require("express");
const router = express.Router();
const {
  getNotifications,
  updateNotification,
  deleteNotification,
  getUnreadNotificationsCount, // Add this import
  getNotificationCounts, // Add this import
} = require("../../controllers/admin/NotificationController");

// Add this new route
router.get("/unread-count", getUnreadNotificationsCount);
router.get("/counts", getNotificationCounts);

router.get("/", getNotifications);
router.put("/:id", updateNotification);
router.delete("/:id", deleteNotification);

module.exports = router;
