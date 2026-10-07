const express = require("express");
const router = express.Router();

const marketOrderRoutes = require("../marketOrderRoutes");
const marketPaymentRoutes = require("../storepaymentRoutes");
const storeOfferRoutes = require("../storeOfferRoutes");
const returnRoutes = require("../returnRoutes");
router.use("/orders", marketOrderRoutes);
router.use("/payments", marketPaymentRoutes);
router.use("/store/offers", storeOfferRoutes);  // clearer
router.use("/returns", returnRoutes);
module.exports = router;