const express = require("express");
const router = express.Router();

const {
  checkDeliveryPartner,
} = require("../../controllers/deliverypartner/deliveryPartner.controller");

router.post("/check", checkDeliveryPartner);

module.exports = router;
