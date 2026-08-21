const express = require("express");

const router = express.Router();

const {
  getCategories,
  getProductCategories,
  getAllCategories,
  createCategory,
} = require("../../controllers/marketplace/categoryController");

// Main categories
router.get("/", getCategories);

// All categories
router.get("/all", getAllCategories);

// Product/Sub categories
router.get(
  "/product-categories",
  getProductCategories
);

// Create category
router.post("/", createCategory);

module.exports = router;