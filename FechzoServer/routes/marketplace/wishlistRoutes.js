const express = require("express");
const router = express.Router();

const {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  checkWishlist,
} = require("../../controllers/marketplace/wishlistController");

const authMiddleware = require("../../middleware/auth/authMiddleware");

router.post("/", authMiddleware, addToWishlist);

router.delete("/", authMiddleware, removeFromWishlist);

router.get("/", authMiddleware, getWishlist);

router.get("/check", authMiddleware, checkWishlist);

module.exports = router;