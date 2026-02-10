const express = require("express");
const router = express.Router();
const verifyPartner = require("../../middleware/auth/verifyPartner");

const {
  getAvailableOrders,
  acceptOrder,
  updateOrderStatus
} = require("../../controllers/food/orders/orderController");

// Nearby orders
router.get("/nearby-orders", verifyPartner, getAvailableOrders);

// Accept an order
router.post("/:orderId/accept", verifyPartner, acceptOrder);

// Reject an order (or update status)
router.post("/:orderId/reject", verifyPartner, updateOrderStatus);

module.exports = router;
