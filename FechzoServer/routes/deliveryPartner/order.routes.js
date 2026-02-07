const express = require("express");
const router = express.Router();
const verifyPartner = require("../../middleware/auth/verifyPartner");

const {
  getNearbyOrders,
} = require("../../controllers/deliverypartner/order.controller");

router.get("/nearby-orders", verifyPartner, getNearbyOrders);

module.exports = router;
