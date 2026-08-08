const express = require("express");
const router = express.Router();
// Middleware imports
const  verifyPartner  = require("../../middleware/auth/verifyPartner");
const adminAuth = require("../../middleware/auth/adminAuth");
// Controller imports (all functions must be exported from the controller)
const {
  checkDeliveryPartner,
  getPendingPartners,
  approvePartner,
  getApprovedPartners,
  getMyProfile,
  updateMyProfile,
  uploadDocument,
  getPartnerDocuments,
  updateAvailability,
} = require("../../controllers/deliverypartner/deliveryPartner.controller");
const { requestPayout, getMyPayoutRequests } = require("../../controllers/deliverypartner/payoutController");
// ─────────────────────────────────────────────
// Public / Partner routes
// ─────────────────────────────────────────────
// Check / register delivery partner
router.post("/check", checkDeliveryPartner);
router.get("/profile",verifyPartner, getMyProfile);
// PATCH /api/delivery-partner/profile
router.patch("/profile", verifyPartner, updateMyProfile);
router.post("/documents/upload", verifyPartner, uploadDocument);
router.get('/documents', verifyPartner, getPartnerDocuments);
router.post('/payout/requests', verifyPartner, requestPayout);
router.get('/payout/requests', verifyPartner, getMyPayoutRequests);
router.patch(
  "/orders/availability",
  verifyPartner,
  updateAvailability
);
router.get("/admin/pending", getPendingPartners);
router.get("/admin/approved",getApprovedPartners);
router.put("/admin/approve/:partnerId",approvePartner);
module.exports = router;