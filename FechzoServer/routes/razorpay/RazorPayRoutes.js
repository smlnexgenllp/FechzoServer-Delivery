const express = require('express');
const router = express.Router();
const paymentController = require('../../controllers/payment/PaymentController');


router.get('/order/:orderId', paymentController.getOrderById);
router.get('/key', paymentController.getRazorpayKey);
router.post('/create-order', paymentController.createOrder);
router.post('/verify-payment', paymentController.verifyPayment);

module.exports = router;