const express = require("express");

const router = express.Router();

const {
  storeLogin,
} = require("../../controllers/marketplace/storeController");

const protectStore = require("../../middleware/marketplace/storeAuthMiddleware");

// Store Login
router.post("/login", storeLogin);

// Logged-in Store Details
router.get("/me", protectStore, (req, res) => {
  res.json({
    success: true,
    data: req.store,
  });
});

module.exports = router;