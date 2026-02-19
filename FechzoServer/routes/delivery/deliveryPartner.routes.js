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

} = require("../../controllers/deliverypartner/deliveryPartner.controller");
const { requestPayout, getMyPayoutRequests , linkBankAccount} = require("../../controllers/deliverypartner/payoutController");
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
router.post('/bank/link', verifyPartner, linkBankAccount);
// Get own profile (partner authenticated)


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