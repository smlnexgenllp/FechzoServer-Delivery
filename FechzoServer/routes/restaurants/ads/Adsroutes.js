const express = require('express');
const router = express.Router();
const upload = require('../../../middleware/multer');
const { 
  createAd, 
  getRestaurantAds, 
  getPendingAdImages, 
  editAd, 
  cancelAd, 
  updateAdStatus, 
  getActiveAds,
  trackAdMetrics,
  getAllAds,
  // Add these payment-related functions from AdsController
  getRazorpayKey,
  createAdPayment,
  verifyAdPayment,
  getAdPaymentDetails,
  processAdRefund
} = require('../../../controllers/restaurants/ads/AdsController');

// Admin routes
router.get('/admin/ads', getAllAds);
router.get('/active-ads', getActiveAds);
router.post('/ads/:adId/track', trackAdMetrics);
router.put('/admin/ads/:adId/status', updateAdStatus);

// Payment routes for ads - now using functions from AdsController
router.get('/ads/razorpay-key', getRazorpayKey);
router.post('/ads/create-payment', createAdPayment);
router.post('/ads/verify-payment', upload.single('adImage'), verifyAdPayment);
router.get('/ads/payment/:paymentId', getAdPaymentDetails);
router.post('/ads/:adId/refund', processAdRefund);

// Restaurant ad routes
router.get('/:restaurantId/advertisements', getRestaurantAds);
router.post('/:restaurantId/advertisements/create', 
  upload.single('adImage'),
  createAd
);
router.get('/:restaurantId/advertisements/pending-images', getPendingAdImages);
router.put('/:restaurantId/advertisements/:adId/edit',
  upload.single('adImage'),
  editAd
);
router.delete('/:restaurantId/advertisements/:adId/cancel',
  cancelAd
);

module.exports = router;