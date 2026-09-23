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
} = require(
  "../../controllers/marketplace/storeController"
);

// ============================================================
// PUBLIC FETCH STORE CONTROLLERS
// ============================================================

const {
  getStoresByType,
  getStoreById: getPublicStoreById,
  getAllApprovedStores,
} = require(
  "../../controllers/marketplace/fetchstoreController"
);

// ============================================================
// MIDDLEWARE
// ============================================================

const upload = require(
  "../../middleware/multer"
);

const protectStore = require(
  "../../middleware/marketplace/protectStore"
);

// ============================================================
// ADMIN ROUTES
// ============================================================

router.get(
  "/admin/pending",
  getPendingStores
);

router.get(
  "/admin/all",
  getAllStores
);

router.patch(
  "/admin/:id/status",
  updateStoreStatus
);

// ============================================================
// STORE REGISTRATION
// ============================================================

router.post(
  "/register",

  upload.fields([
    {
      name: "logo",
      maxCount: 1,
    },

    {
      name: "banner",
      maxCount: 1,
    },

    {
      name: "storefrontImage",
      maxCount: 1,
    },

    {
      name: "interiorImages",
      maxCount: 6,
    },

    {
      name: "kitchenImages",
      maxCount: 4,
    },

    {
      name: "packagingImages",
      maxCount: 3,
    },

    {
      name: "images",
      maxCount: 10,
    },

    {
      name: "gstCertificate",
      maxCount: 1,
    },

    {
      name: "panCard",
      maxCount: 1,
    },

    {
      name: "aadhaarCard",
      maxCount: 1,
    },

    {
      name: "shopLicense",
      maxCount: 1,
    },

    {
      name: "fssaiCertificate",
      maxCount: 1,
    },

    {
      name: "cancelledCheque",
      maxCount: 1,
    },

    {
      name: "addressProof",
      maxCount: 1,
    },
  ]),

  registerStore
);

// ============================================================
// STORE OWNER ROUTES
// ============================================================

// GET MY STORE
router.get(
  "/my",
  protectStore,
  getMyStores
);

// GET STORE SETTINGS
router.get(
  "/owner/:id",
  protectStore,
  getStoreOwnerById
);

// UPDATE STORE SETTINGS
router.put(
  "/owner/:id",
  protectStore,
  updateStore
);

// ============================================================
// PUBLIC STORE ROUTES
// ============================================================

router.get(
  "/all",
  getAllApprovedStores
);

router.get(
  "/",
  getStoresByType
);

router.get(
  "/:id",
  getPublicStoreById
);

module.exports = router;