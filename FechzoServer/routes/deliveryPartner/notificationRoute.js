const express = require("express");

const router = express.Router();

const verifyPartner = require("../../middleware/auth/verifyPartner");

const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead,
  deleteNotification,
} = require("../../controllers/deliverypartner/notificationController");

router.get("/", verifyPartner, getNotifications);

router.get("/unread-count", verifyPartner, getUnreadCount);

router.patch("/:id/read", verifyPartner, markAsRead);

router.patch("/read-all", verifyPartner, markAllRead);

router.delete("/:id", verifyPartner, deleteNotification);

module.exports = router;