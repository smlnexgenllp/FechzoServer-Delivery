const express = require('express');
const router = express.Router();

const { updateCartItem } = require("../../../controllers/food/orders/cart");
const { addToCart } = require("../../../controllers/food/orders/cart");
const authUser  = require('../../../middleware/auth/authUser');
const {
  getCartItemsWithDetails,
} = require("../../../controllers/food/orders/fetchCart");
const addressController = require("../../../controllers/food/orders/address");
const orderController = require("../../../controllers/food/orders/orderController");
const kitchenController = require("../../../controllers/food/orders/kitchenController");
router.get("/history", kitchenController.getOrderHistory);
const partnerAuth = require("../../../middleware/auth/partnerAuth");
 
router.post("/cart", addToCart);
router.post("/updatecart", updateCartItem);

router.get("/fetchcart/:userId", getCartItemsWithDetails);

// Route to add a new address
router.post("/addresses", addressController.addAddress);

// Route to get all addresses for a specific user
router.get("/users/:userId/addresses", addressController.getUserAddresses);

// Route to update an existing address
router.put("/:userId/address/:addressId", addressController.updateAddress);

// Route to delete an address
router.delete("/:userId/address/:addressId", addressController.deleteAddress);

// order routes
router.get("/user/:userId/orders", orderController.getUserOrders);
router.get("/details/:orderId", orderController.getOrderById);
router.put("/status/:orderId", orderController.updateOrderStatus);

router.get("/kitchen", kitchenController.getKitchenOrders);
router.get("/all", kitchenController.getAllOrders); //
router.patch("/kitchen/:orderId/status",kitchenController.updateKitchenOrderStatus);

// Add new route for getting restaurant details
router.get('/restaurant-details/order/:orderId', kitchenController.getRestaurantDetailsForOrder);

// Refund and cancellation routes
router.post('/cancel/:orderId', orderController.cancelOrder);
router.get('/refunds/:restaurantId', orderController.getRestaurantRefunds);
router.patch('/refund/:orderId', orderController.updateRefundStatus);

// Admin refund routes
router.get('/admin/refunds', orderController.getAdminRefunds);
router.get('/admin/refunds/:restaurantId', orderController.getAdminRefunds);
router.patch('/admin/refunds/:orderId/approve', orderController.approveRefund);
router.patch('/admin/refunds/:orderId/reject', orderController.rejectRefund);
router.get('/available-orders', partnerAuth, orderController.getAvailableOrders);
router.put('/accept/:orderId', partnerAuth, orderController.acceptOrder);
router.put('/update-order-status/:orderId', partnerAuth, orderController.updateOrderStatus);
router.put('/:orderId/rate-partner', orderController.rateDeliveryPartner);


module.exports = router;
