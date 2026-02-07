const express = require("express");
const router = express.Router();
const { 
  getRestaurants, 
  approveRestaurant, 
  rejectRestaurant,
  updateBranchApproval,
  getRestaurantName
} = require('../../controllers/admin/restaurantControllers');

const ratingController = require('../../controllers/admin/restaurantreviewControllers');

const offerRoutes = require('./adminOfferRoutes');
const alertControllers = require('../../controllers/admin/restaurantAlertControllers');
const orderController = require('../../controllers/admin/restaurantOrderControllers');

const adminController = require('../../controllers/admin/AdminDashboardControllers');

const offerController = require('../../controllers/admin/restaurantOffersControllers');

const paymentController = require('../../controllers/admin/AdminPaymentControllers');

const restaurantpaymentController = require('../../controllers/admin/restaurantPaymentControllers');

const paymentManagemnt = require('../../controllers/admin/paymentManagementControllers');
// Route to get all restaurants with their branches
router.get('/restaurants', getRestaurants);

// Route to approve a restaurant
router.put('/restaurants/approve/:id', approveRestaurant);

// Route to reject a restaurant
router.put('/restaurants/reject/:id', rejectRestaurant);

// Update branch approval status - simplified route
router.put('/branches/:branchId', updateBranchApproval);

// Route to get restaurant name by ID
router.get('/restaurants/:id/name', getRestaurantName);

router.get('/adminrestaurantreviews', ratingController.getReviews);
// router.post('/alert', ratingController.sendAlert);


router.post('/alert', alertControllers.createAlert);

// GET /api/restaurant/alerts
router.get('/alerts', alertControllers.getAlerts);

// PATCH /api/restaurant/alerts/:id
router.patch('/alerts/:id', alertControllers.updateAlert)

router.patch('/alerts/:alertId/read', alertControllers.markAlertAsRead);


router.get('/orders/:restaurantId', orderController.getRestaurantOrders);

router.get('/dashboard', adminController.getDashboardData);
router.get('/search', adminController.searchOrdersAndRestaurants);
router.get('/activerestaurants', adminController.getActiveRestaurantsDetails);

router.use('/offers', offerRoutes);
// GET all offers for a restaurant
router.get('/restaurantoffers/:restaurantId', offerController.getOffers);
// GET all offers for a admin 
router.get('/offer/:restaurantId', offerController.getAdminOffers);

router.get('/promocodes', offerController.getAdminPromoCodes);

// GET all payment for a admin
router.get('/payments', paymentController.getPayments);
router.get('/revenue', paymentController.getRevenueData);
router.get('/transactions', paymentController.getTransactionData);
router.get('/stats', paymentController.getDashboardStats);

// GET all restaurat payment for a admin restaurant activity center

router.get('/restaurant/:restaurantId', restaurantpaymentController.getRestaurantPayments);


// Get all payment management
router.get('/paymentdaily', paymentManagemnt.getDailyPayments);
router.get('/paymentmonthly', paymentManagemnt.getMonthlyPayments);
router.get('/paymenthistory', paymentManagemnt.getPaymentHistory);
router.post('/confirmPayment', paymentManagemnt.confirmPayment);

module.exports = router;