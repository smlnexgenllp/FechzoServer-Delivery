const express = require("express");
const router = express.Router();

// Middleware imports
const { verifyPartner } = require("../../middleware/auth/verifyPartner");
const adminAuth = require("../../middleware/auth/adminAuth");

// Controller imports (all functions must be exported from the controller)
const {
  checkDeliveryPartner,
  getPendingPartners,
  approvePartner,
  getApprovedPartners,
 
} = require("../../controllers/deliverypartner/deliveryPartner.controller");

// ─────────────────────────────────────────────
// Public / Partner routes
// ─────────────────────────────────────────────

// Check / register delivery partner
router.post("/check", checkDeliveryPartner);



// ─────────────────────────────────────────────
// Admin-only routes
// ─────────────────────────────────────────────

// Get all pending partners
router.get("/admin/pending", adminAuth, getPendingPartners);

// Get all approved partners
router.get("/admin/approved", adminAuth, getApprovedPartners);

// Approve a pending partner
router.put("/admin/approve/:partnerId", adminAuth, approvePartner);

module.exports = router;