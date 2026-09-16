const express = require("express");
const router = express.Router();

// ✅ New Market Order routes
const marketOrderRoutes = require("../marketOrderRoutes");


// ✅ Mount order routes
router.use("/orders", marketOrderRoutes);

module.exports = router;