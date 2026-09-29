const express = require("express");
const router = express.Router();
const storeOfferController = require("../../controllers/marketplace/storeOfferController");
const userOfferController = require("../../controllers/marketplace/userOfferController");

// Optional: protectStore middleware
// const { protectStore } = require("../../middleware/auth");

router.get("/", storeOfferController.getStoreOffers);
router.post("/", storeOfferController.createStoreOffer);
router.put("/:id", storeOfferController.updateStoreOffer);
router.patch("/:id/toggle", storeOfferController.toggleStoreOffer);
router.delete("/:id", storeOfferController.deleteStoreOffer);

// User-facing offers (cart)
router.post("/offers/applicable", userOfferController.getApplicableOffers);
router.post("/offers/validate-coupon", userOfferController.validateCoupon);
router.get("/offers/store/:storeId", userOfferController.getStoreActiveOffers);
module.exports = router;