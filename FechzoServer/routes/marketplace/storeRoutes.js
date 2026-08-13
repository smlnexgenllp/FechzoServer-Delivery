const express = require("express");
const router = express.Router();

// ============================================================
// STORE CONTROLLERS
// ============================================================
const {
  registerStore,
  getMyStores,
  getStoreById,
  updateStore,
  getPendingStores,
  updateStoreStatus,
} = require("../../controllers/marketplace/storeController");

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
const authMiddleware = require("../../middleware/auth/authMiddleware");

// ============================================================
// ADMIN ROUTES  (must come BEFORE /:id)
// ============================================================
router.get(
  "/admin/pending",
  authMiddleware,
  getPendingStores
);

router.patch(
  "/admin/:id/status",
  authMiddleware,
  updateStoreStatus
);

// ============================================================
// STORE OWNER / PARTNER ROUTES
// ============================================================

// Register store  → PUBLIC (no login required)
router.post(
  "/register",
  registerStore
);

// Get my stores
router.get(
  "/my",
  authMiddleware,
  getMyStores
);

// Update store
router.put(
  "/:id",
  authMiddleware,
  updateStore
);

// Get store by ID
router.get(
  "/:id",
  authMiddleware,
  getStoreById
);

module.exports = router;