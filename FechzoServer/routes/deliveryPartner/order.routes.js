const express = require("express");
const router = express.Router();
const verifyPartner = require("../../middleware/auth/verifyPartner");

const {
  getAvailableOrders,
  acceptOrder,
  updateOrderStatus,
  getMyActiveOrders,
  updatePartnerOrderStatus,
  getPartnerOrderHistory,
  cancelOrderByPartner,
  reportDelayByPartner,
  getTodayEarnings,
  getTotalEarnings,
getCurrentMonthEarnings,
} = require("../../controllers/food/orders/orderController");
router.get("/nearby-orders", verifyPartner, getAvailableOrders);
router.post("/:orderId/accept", verifyPartner, acceptOrder);
router.patch("/:orderId/status", verifyPartner, updatePartnerOrderStatus);
router.post("/:orderId/reject", verifyPartner, updateOrderStatus);
router.get("/my-active", verifyPartner, getMyActiveOrders);
router.get("/history", verifyPartner, getPartnerOrderHistory);
router.post("/:orderId/cancel", verifyPartner, cancelOrderByPartner);
router.patch("/:orderId/report-delay", verifyPartner, reportDelayByPartner);
router.get('/earnings/today', verifyPartner, getTodayEarnings);
router.get('/earnings/total', verifyPartner, getTotalEarnings);
router.get('/earnings/month', verifyPartner, getCurrentMonthEarnings);
module.exports = router;
