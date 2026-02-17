const express = require("express");
const partnerAuth = require("../../middleware/auth/partnerAuth");
const { submitOnboarding } = require("../../controllers/deliverypartner/onboarding.controller");

const router = express.Router();

const verifyPartner = require("../../middleware/auth/verifyPartner");
router.post("/onboarding", partnerAuth, submitOnboarding);
router.get("/dashboard", verifyPartner, (req, res) => {
  res.json({
    success: true,
    message: "Welcome to partner dashboard",
    partner: {
      id: req.partner._id,
      email: req.partner.email,
      role: req.partner.role,
    },
  });
});

// Add more protected routes later
// router.get("/orders", verifyPartner, getPartnerOrders);
// router.get("/earnings", verifyPartner, getPartnerEarnings);
// router.put("/profile", verifyPartner, updatePartnerProfile);

module.exports = router;