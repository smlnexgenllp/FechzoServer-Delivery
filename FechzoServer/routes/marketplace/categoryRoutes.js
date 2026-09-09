const express = require("express");

const router = express.Router();

const {
  getCategories,
  getProductCategories,
  getAllCategories,
  createCategory,
} = require("../../controllers/marketplace/categoryController");

// =====================================================
// MAIN CATEGORIES
// GET /api/categories
// =====================================================

router.get("/", getCategories);

// =====================================================
// ALL CATEGORIES
// GET /api/categories/all
// =====================================================

router.get("/all", getAllCategories);

// =====================================================
// SUB CATEGORIES
// GET /api/categories/product-categories?categoryId=xxx
// =====================================================

router.get(
  "/product-categories",
  getProductCategories
);

// =====================================================
// CREATE CATEGORY
// POST /api/categories
// =====================================================

router.post("/", createCategory);

module.exports = router;