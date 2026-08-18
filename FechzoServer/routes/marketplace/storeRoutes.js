const express = require("express");
const router = express.Router();

const {
  registerStore,
  getMyStores,
  getStoreById,
  updateStore,
  getPendingStores,
  getAllStores,
  updateStoreStatus,
} = require("../../controllers/marketplace/storeController");

const upload = require("../../middleware/multer");

// ============================================================
// ADMIN ROUTES
// ============================================================

router.get("/admin/pending", getPendingStores);

router.get("/admin/all", getAllStores);

router.patch("/admin/:id/status", updateStoreStatus);

// ============================================================
// STORE OWNER / PARTNER ROUTES
// ============================================================

// Register store (with images + documents)
router.post(
  "/register",
  upload.fields([
    // Store images
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
    { name: "storefrontImage", maxCount: 1 },
    { name: "interiorImages", maxCount: 6 },
    { name: "kitchenImages", maxCount: 4 },
    { name: "packagingImages", maxCount: 3 },
    { name: "images", maxCount: 10 },

    // Documents
    { name: "gstCertificate", maxCount: 1 },
    { name: "panCard", maxCount: 1 },
    { name: "aadhaarCard", maxCount: 1 },
    { name: "shopLicense", maxCount: 1 },
    { name: "fssaiCertificate", maxCount: 1 },
    { name: "cancelledCheque", maxCount: 1 },
    { name: "addressProof", maxCount: 1 },
  ]),
  registerStore
);

// ============================================================
// STORE ROUTES
// ============================================================

// Get my stores
router.get("/my", getMyStores);

// Update store
router.put("/:id", updateStore);

// Get store by ID
router.get("/:id", getStoreById);

module.exports = router;