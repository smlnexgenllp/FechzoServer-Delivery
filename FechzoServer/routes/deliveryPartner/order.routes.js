const express = require("express");
const router = express.Router();
const verifyPartner = require("../../middleware/auth/verifyPartner");
const authMiddleware = require("../../middleware/auth/authMiddleware");
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
getRecentEarnings,
getRestaurantOrders
} = require("../../controllers/food/orders/orderController");
const DeliveryPartner = require("../../models/deliverypartner/DeliveryPartner");

router.get("/status", verifyPartner, async (req, res) => {
  try {
    const partner = await DeliveryPartner.findById(req.partner._id)
      .select("fullName email phone approvalStatus isActive onboardingCompleted documentsSubmitted");

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found"
      });
    }

    res.json({
      success: true,
      status: {
        fullName: partner.fullName || "",
        email: partner.email || "",
        phone: partner.phone || "",
        approvalStatus: partner.approvalStatus || "PENDING",
        isActive: partner.isActive || false,
        onboardingCompleted: partner.onboardingCompleted || false,
        documentsSubmitted: partner.documentsSubmitted || false,
        onlineStatus: true,
      }
    });

  } catch (err) {
    console.error("Status endpoint crashed:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

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
router.get('/earnings/recent', verifyPartner, getRecentEarnings);
router.get('/restaurant/orders',  getRestaurantOrders);

// Optional: status-specific route
router.get('/restaurant/orders/:status', getRestaurantOrders);
module.exports = router;
