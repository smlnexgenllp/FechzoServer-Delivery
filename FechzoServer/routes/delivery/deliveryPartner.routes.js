const express = require("express");
const router = express.Router();

const {
  checkDeliveryPartner,
  getPendingPartners,
  approvePartner,
  getApprovedPartners,
} = require("../../controllers/deliverypartner/deliveryPartner.controller");

const adminAuth = require("../../middleware/auth/adminAuth");

// existing route
router.post("/check", checkDeliveryPartner);

// ADMIN – get pending partners
router.get(
  "/admin/pending",
  adminAuth,
  getPendingPartners
);
router.get("/admin/approved", adminAuth, getApprovedPartners);
router.put("/admin/approve/:partnerId", adminAuth, approvePartner);

module.exports = router;
