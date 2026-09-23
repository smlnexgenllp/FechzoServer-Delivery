const express = require("express");
const router = express.Router();
const paymentController = require("../../controllers/marketplace/marketpaymentController");

// List + Search + Filter
router.get("/", paymentController.getPayments);

// Summary cards
router.get("/summary", paymentController.getPaymentSummary);

// PDF Download
router.get("/download-pdf", paymentController.downloadPaymentsPDF);

// Update payment status (mainly for COD)
router.patch("/:orderId/status", paymentController.updatePaymentStatus);

module.exports = router;