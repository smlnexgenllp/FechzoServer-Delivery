const express = require("express");
const router = express.Router();
const {
  searchMarketplace,
} = require("../../controllers/marketplace/marketplaceSearchController");
router.get("/", searchMarketplace);
module.exports = router;