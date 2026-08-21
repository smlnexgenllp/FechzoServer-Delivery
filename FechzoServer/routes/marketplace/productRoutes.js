const express = require("express");

const router = express.Router();

const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../../controllers/marketplace/productController");

/*
=========================================================
GET ALL PRODUCTS
GET /api/products
=========================================================
*/
router.get("/", getProducts);

/*
=========================================================
GET SINGLE PRODUCT
GET /api/products/:id
=========================================================
*/
router.get("/:id", getProductById);

/*
=========================================================
CREATE PRODUCT
POST /api/products
=========================================================
*/
router.post("/", createProduct);

/*
=========================================================
UPDATE PRODUCT
PUT /api/products/:id
=========================================================
*/
router.put("/:id", updateProduct);

/*
=========================================================
DELETE PRODUCT
DELETE /api/products/:id
=========================================================
*/
router.delete("/:id", deleteProduct);

module.exports = router;