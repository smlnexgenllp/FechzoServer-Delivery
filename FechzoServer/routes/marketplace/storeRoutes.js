const express = require("express");
const router = express.Router();

// ============================================================
// STORE CONTROLLERS
// ============================================================
const {
  registerStore,
  getMyStores,
  getStoreById: getStoreOwnerById,
  updateStore,
  getPendingStores,
  getAllStores,
  updateStoreStatus,
} = require("../../controllers/marketplace/storeController");

// ============================================================
// FETCH STORE CONTROLLERS
// ============================================================
const {
  getStoresByType,
  getStoreById: getPublicStoreById,
  getAllApprovedStores,
} = require("../../controllers/marketplace/fetchstoreController");

// ============================================================
// MIDDLEWARE
// ============================================================
const upload = require("../../middleware/multer");

// ============================================================
// ADMIN ROUTES
// ============================================================

// Get pending stores
router.get("/admin/pending", getPendingStores);

// Get all stores
router.get("/admin/all", getAllStores);

// Update store approval/status
router.patch("/admin/:id/status", updateStoreStatus);

// ============================================================
// STORE OWNER / PARTNER ROUTES
// ============================================================

// Register store with images + documents
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
// STORE OWNER ROUTES
// ============================================================

// Get my stores
router.get("/my", getMyStores);

// Update store
router.put("/:id", updateStore);

// ============================================================
// PUBLIC STORE ROUTES
// ============================================================

// Get all approved stores
// IMPORTANT: Keep this BEFORE /:id
router.get("/all", getAllApprovedStores);

// Get stores by type/category
router.get("/", getStoresByType);

// Get public store by ID
router.get("/:id", getPublicStoreById);


module.exports = router;