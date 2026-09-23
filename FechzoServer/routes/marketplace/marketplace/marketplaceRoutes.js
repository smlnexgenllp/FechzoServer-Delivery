const express = require("express");
const router = express.Router();

// ✅ New Market Order routes
const marketOrderRoutes = require("../marketOrderRoutes");
const marketPaymentRoutes = require("../storepaymentRoutes");



// ✅ Mount order routes
router.use("/orders", marketOrderRoutes);
router.use("/payments", marketPaymentRoutes);
module.exports = router;