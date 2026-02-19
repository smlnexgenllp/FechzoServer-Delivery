const express = require("express");
const router = express.Router();

const partnerAuth = require("../../middleware/auth/partnerAuth");

// ── IMPORTANT: Import multer (your upload middleware) ──────────────────────
const upload = require("../../middleware/multer"); // ← adjust path if different

const { submitOnboarding } = require("../../controllers/deliverypartner/onboarding.controller");

// POST /api/partner/onboarding
router.post(
  "/onboarding",
  partnerAuth,
  upload.fields([                           // ← THIS WAS MISSING
    { name: "profilePhoto", maxCount: 1 },
    { name: "panCard", maxCount: 1 },
    { name: "aadharFront", maxCount: 1 },
    { name: "drivingLicenseFront", maxCount: 1 },
    { name: "rcBookFront", maxCount: 1 },
  ]),
  submitOnboarding
);

// GET /api/partner/dashboard (no change needed here)
router.get("/dashboard", partnerAuth, async (req, res) => {
  try {
    const partner = await require("../../models/deliverypartner/DeliveryPartner")
      .findById(req.partner._id || req.partner.id)
      .select(
        "fullName phone city area vehicleType vehicleNumber " +
        "approvalStatus onboardingCompleted isActive profilePhoto"
      )
      .lean();

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Welcome to partner dashboard",
      partner: {
        id: req.partner._id || req.partner.id,
        email: req.partner.email,
        role: req.partner.role || "partner",
        fullName: partner.fullName || null,
        phone: partner.phone,
        city: partner.city || null,
        area: partner.area || null,
        vehicleType: partner.vehicleType || null,
        vehicleNumber: partner.vehicleNumber || null,
        profilePhoto: partner.profilePhoto || null,
        onboardingCompleted: partner.onboardingCompleted,
        approvalStatus: partner.approvalStatus,
        isActive: partner.isActive,
      },
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while loading dashboard",
    });
  }
});

module.exports = router;