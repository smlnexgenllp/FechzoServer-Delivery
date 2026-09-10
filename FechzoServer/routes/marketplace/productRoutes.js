const express = require("express");

const router = express.Router();

const {
  getProducts,
  getStoreProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
} = require("../../controllers/marketplace/productController");

// =====================================================
// GET STORE PRODUCTS
// IMPORTANT: Before /:id
// =====================================================

router.get(
  "/store",
  getStoreProducts
);

// =====================================================
// GET ALL PRODUCTS
// GET /api/products
// =====================================================

router.get(
  "/",
  getProducts
);

// =====================================================
// CREATE PRODUCT
// POST /api/products
// =====================================================

router.post(
  "/",
  createProduct
);

// =====================================================
// UPDATE PRODUCT
// PUT /api/products/:id
// =====================================================

router.put(
  "/:id",
  updateProduct
);

// =====================================================
// DELETE PRODUCT
// DELETE /api/products/:id
// =====================================================

router.delete(
  "/:id",
  deleteProduct
);

// =====================================================
// RESTORE PRODUCT
// PATCH /api/products/:id/restore
// =====================================================

router.patch(
  "/:id/restore",
  restoreProduct
);

// =====================================================
// GET SINGLE PRODUCT
// IMPORTANT: Keep this AFTER /store
// =====================================================

router.get(
  "/:id",
  getProductById
);

module.exports = router;