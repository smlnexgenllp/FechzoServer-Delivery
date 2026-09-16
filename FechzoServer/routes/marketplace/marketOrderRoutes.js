const express = require("express");
const router = express.Router();

const {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getStoreOrders,
} = require("../../controllers/marketplace/marketOrderController");

// ================= USER =================
router.post("/", createOrder);                          // POST /api/market-orders
router.get("/user/:userId", getUserOrders);             // GET  /api/market-orders/user/:userId
router.get("/:orderId", getOrderById);                  // GET  /api/market-orders/:orderId
router.put("/:orderId/cancel", cancelOrder);            // PUT  /api/market-orders/:orderId/cancel

// ================= STORE / ADMIN =================
router.get("/store/:storeId", getStoreOrders);          // GET  /api/market-orders/store/:storeId
router.put("/:orderId/status", updateOrderStatus);      // PUT  /api/market-orders/:orderId/status

module.exports = router;