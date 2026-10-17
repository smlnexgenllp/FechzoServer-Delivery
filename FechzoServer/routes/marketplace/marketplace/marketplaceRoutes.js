const express = require("express");
const router = express.Router();

const marketOrderRoutes = require("../marketOrderRoutes");
const marketPaymentRoutes = require("../storepaymentRoutes");
const storeOfferRoutes = require("../storeOfferRoutes");
const returnRoutes = require("../returnRoutes");
const adminStoreRoutes = require("../adminStoreRoutes");

router.use("/orders", marketOrderRoutes);
router.use("/payments", marketPaymentRoutes);
router.use("/store/offers", storeOfferRoutes);  // clearer
router.use("/returns", returnRoutes);
router.use("/admin/stores", adminStoreRoutes);

module.exports = router;