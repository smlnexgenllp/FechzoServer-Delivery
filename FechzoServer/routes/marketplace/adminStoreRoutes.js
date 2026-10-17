// adminStoreRoutes.js

const express = require("express");
const router = express.Router();
const {
  getStoreOrders,
  getStoreMenus,
} = require("../../controllers/marketplace/storeadmin/adminStoreController"); // adjust path

// Orders
router.get("/:storeId/orders", getStoreOrders);

// Menus / Products
router.get("/:storeId/menus", getStoreMenus);

module.exports = router;