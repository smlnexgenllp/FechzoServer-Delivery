const Order = require('../../../models/order/order');
const mongoose = require('mongoose');
const Payment = require('../../../models/order/payment');
const notificationController = require('../../restaurants/notificationController');
const Restaurant = require('../../../models/restaurants/Restaurants');
const {createNotifications} = require('../../../controllers/deliverypartner/notificationController')
const Settings = require('../../../models/Admin/Settings');
// Get all orders for a specific user
exports.getUserOrders = async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate userId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }

 
        const orders = await Order.find({ userId })
            .sort({ createdAt: -1 })
            .lean();

        console.log(`Retrieved ${orders.length} orders for user ${userId}`);

        // Return the orders
        res.status(200).json(orders);
    } catch (err) {
        console.error('Error fetching user orders:', err);
        res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
    }
};

// Get a specific order by ID
exports.getOrderById = async (req, res) => {
    try {
        const { orderId } = req.params;

        // Fetch the order
        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Fetch the payment for this order
        const Payment = require('../../../models/order/payment');
        const payment = await Payment.findOne({ orderId });

        // Merge orderSummary and payment fields into the response
        const response = {
            ...order.toObject(),
            paymentId: payment?.paymentId,
            paymentMethod: payment?.paymentMethod,
            paymentStatus: payment?.paymentStatus,
            razorpayOrderId: payment?.razorpayOrderId,
            razorpayPaymentId: payment?.razorpayPaymentId,
            upiId: payment?.upiId,
            cardholderName: payment?.cardholderName,
            cardExpiry: payment?.cardExpiry,
            cardToken: payment?.cardToken,
            maskedCardNumber: payment?.maskedCardNumber,
            paymentCreatedAt: payment?.createdAt,
            orderSummary: payment?.orderSummary,
            appliedOffers: payment?.appliedOffers,
        };

        res.status(200).json(response);
    } catch (err) {
        console.error('Error fetching order details:', err);
        res.status(500).json({ error: 'Failed to fetch order', details: err.message });
    }
};

// Optional: Update order status (for admins or tracking)

// Update order status (enhanced for cancellation)
exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, cancellationReason } = req.body;

        const validStatuses = ['placed', 'preparing', 'pickedUp', 'delivered', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid order status' });
        }

        const order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Apply cancellation rules
        if (status === 'cancelled') {
            // Check if order can be cancelled based on current status
            if (order.orderStatus === 'pickedUp' || order.orderStatus === 'delivered') {
                return res.status(400).json({
                    error: 'Cannot cancel order in this state',
                    message: 'Orders that are already pickedUp or delivered cannot be cancelled.'
                });
            }

            // Require a reason for cancellation
            if (!cancellationReason || cancellationReason.trim() === '') {
                return res.status(400).json({
                    error: 'Cancellation reason required',
                    message: 'Please provide a reason for cancellation.'
                });
            }

            // Store cancellation reason
            order.cancellationReason = cancellationReason;

            // Handle refund logic based on the order's current state
            if (order.paymentMethod !== 'cash' && order.paymentStatus === 'completed') {
                // Determine refund amount based on order status
                let refundPercentage = 100; // Default to full refund

                if (order.orderStatus === 'processing') {
                    refundPercentage = 80; // 20% cancellation fee
                }

                const refundAmount = (order.total * refundPercentage / 100).toFixed(2);

                  // Record the refund in the order
                order.refundAmount = refundAmount;
                order.refundPercentage = refundPercentage;
                order.refundStatus = 'pending';

                // Note: In a real system, you would initiate an actual refund through your payment gateway
                console.log(`Initiating refund of ₹${refundAmount} (${refundPercentage}%) for order ${orderId}`);
            }
        }

        // Update the order status
        order.orderStatus = status;
        await order.save();

        // Update payment status to 'completed' if delivered
        if (status === 'delivered') {
            const Payment = require('../../../models/order/payment');
            await Payment.findOneAndUpdate(
                { orderId: order.orderId },
                { paymentStatus: 'completed' }
            );
        }

        // Get the io instance
        const io = req.app.get('io');

        // Emit order status update event to the restaurant
        if (io && order.restaurantId) {
            io.to(order.restaurantId.toString()).emit('orderStatusUpdate', {
                orderId: order.orderId,
                status: order.orderStatus,
                cancellationReason: order.cancellationReason,
                restaurantId: order.restaurantId.toString()
            });

            console.log(`Emitted orderStatusUpdate event for order ${orderId} to restaurant ${order.restaurantId}`);

            // Create a notification in the database for cancelled orders
            if (status === 'cancelled') {
                const notificationController = require('../../restaurants/notificationController');
                await notificationController.createNotification({
                    restaurantId: order.restaurantId,
                    type: 'order_cancelled',
                    title: 'Order Cancelled',
                    message: `Order #${order.orderId} has been cancelled: ${cancellationReason}`,
                    details: {
                        orderId: order.orderId,
                        status: 'cancelled',
                        cancellationReason: cancellationReason,
                        items: order.items,
                        total: order.total,
                        customer: order.customer,
                        phone: order.phone
                    },
                    priority: 'high',
                    icon: 'FaTimes'
                });

                // Emit a specific notification event for the cancelled order
                io.to(order.restaurantId.toString()).emit('notification', {
                    type: 'order_cancelled',
                    orderId: order.orderId,
                    message: `Order #${order.orderId} has been cancelled`
                });
            }
        }

        res.status(200).json({
            message: `Order status updated to ${status} successfully`,
            order: {
                orderId: order.orderId,
                status: order.orderStatus,
                cancellationReason: order.cancellationReason,
                refundAmount: order.refundAmount,
                refundPercentage: order.refundPercentage,
                refundStatus: order.refundStatus
            }
        });
    } catch (err) {
        console.error('Error updating order status:', err);
        res.status(500).json({ error: 'Failed to update order', details: err.message });
    }
};

// Cancel an order and request refund
exports.cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { cancellationReason } = req.body;

        if (!cancellationReason) {
            return res.status(400).json({ error: 'Cancellation reason is required' });
        }

        // Find the order
        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check if order can be cancelled (only if it's in placed or preparing status)
        const allowedStatuses = ['placed', 'preparing'];
        if (!allowedStatuses.includes(order.orderStatus)) {
            return res.status(400).json({ 
                error: 'Order cannot be cancelled', 
                message: 'Orders can only be cancelled if they are in placed or preparing status'
            });
        }

        // Update order status and add cancellation reason
        order.orderStatus = 'cancelled';
        order.cancellationReason = cancellationReason;
        order.refundStatus = 'pending';
        order.refundEligible = true;
        order.refundAmount = order.total;
        order.refundRequestDate = new Date();

        await order.save();

        // Send notification to restaurant
        await notificationController.createNotification({
            restaurantId: order.restaurantId,
            title: 'Order Cancelled',
            message: `Order #${order.orderId} has been cancelled by the customer.`,
            type: 'order_cancelled',
            data: {
                orderId: order.orderId,
                orderDetails: order
            }
        });

        res.status(200).json({ 
            success: true, 
            message: 'Order cancelled successfully',
            order
        });
    } catch (err) {
        console.error('Error cancelling order:', err);
        res.status(500).json({ error: 'Failed to cancel order', details: err.message });
    }
};
// Add this function to your controller file (orderController.js)

// Get orders for the logged-in restaurant (with optional status & date filter)
exports.getRestaurantOrders = async (req, res) => {
  try {
    const restaurantId = req.restaurant?._id; // ← from auth middleware (verifyRestaurant)
    if (!restaurantId) {
      return res.status(401).json({ success: false, message: "Restaurant not authenticated" });
    }

    const { status, date } = req.query; // status = 'preparing', 'ready', etc.   date = '2025-02-14'

    let query = { restaurantId: new mongoose.Types.ObjectId(restaurantId) };

    if (status && status !== 'all') {
      query.orderStatus = status;
    }

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const orders = await Order.find(query)
      .populate({
        path: 'delivery.partnerId',
        select: 'fullName phone profileImage vehicleNumber rating totalDeliveries currentLocation',
      })
      .populate('restaurantId', 'restaurantName restaurantImage') // optional – if needed
      .sort({ createdAt: -1 })
      .lean();

    // Optional: add calculated fields if needed
    const enriched = orders.map(order => ({
      ...order,
      // You can add frontend-friendly fields here if you want
      displayStatus: order.orderStatus === 'pickedUp' ? 'Picked Up' : order.orderStatus,
    }));

    res.status(200).json({
      success: true,
      orders: enriched,
      count: enriched.length,
    });
  } catch (err) {
    console.error('Error fetching restaurant orders:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to load orders',
      details: err.message,
    });
  }
};
// Get all refund requests for a restaurant
exports.getRestaurantRefunds = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    console.log('Fetching refunds for restaurant:', restaurantId);

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ error: 'Invalid restaurant ID format' });
    }

    // Find all cancelled orders for this restaurant and join with payment data
    const cancelledOrders = await Order.aggregate([
      {
        $match: {
          restaurantId: new mongoose.Types.ObjectId(restaurantId),
          orderStatus: 'cancelled',
        }
      },
      {
        $lookup: {
          from: 'payments',
          localField: 'orderId',
          foreignField: 'orderId',
          as: 'payment'
        }
      },
      {
        $unwind: {
          path: '$payment',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'restaurants',
          localField: 'restaurantId',
          foreignField: '_id',
          as: 'restaurant'
        }
      },
      {
        $unwind: {
          path: '$restaurant',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      }
    ]);

    // Process orders to include payment method and other details
    const processedOrders = cancelledOrders.map(order => ({
      ...order,
      restaurantName: order.restaurant?.restaurantName || 'Unknown',
      customerName: order.user?.name || order.customer || 'Unknown Customer',
      paymentMethod: order.payment?.paymentMethod || 'Unknown',
      paymentStatus: order.payment?.paymentStatus || 'Unknown'
    }));

    res.status(200).json({
      success: true,
      data: processedOrders
    });
  } catch (err) {
    console.error('Error fetching restaurant refunds:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch refunds', 
      details: err.message 
    });
  }
};

// Update refund status
exports.updateRefundStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes, refundPercentage } = req.body;

    console.log(`Updating refund status for order ${orderId} to ${status}`);
    console.log(`Refund percentage: ${refundPercentage}%`);

    // Validate status
    const validStatuses = ['pending', 'sent_to_admin', 'approved', 'completed', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid refund status' 
      });
    }

    // Find the order
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    // Update refund status and notes
    order.refundStatus = status;
    
    if (notes) {
      order.refundNotes = notes;
    }
    
    // Handle refund percentage
    if (refundPercentage !== undefined) {
      // Ensure refundPercentage is a number between 0 and 100
      const percentage = Math.min(Math.max(Number(refundPercentage) || 100, 0), 100);
      order.refundPercentage = percentage;
      
      // Calculate refund amount based on percentage
      const refundAmount = (order.total * percentage / 100).toFixed(2);
      order.refundAmount = refundAmount;
      
      console.log(`Calculated refund amount: ${refundAmount} (${percentage}% of ${order.total})`);
    }

    // If status is approved or completed, set the refund completed date
    if (status === 'approved' || status === 'completed') {
      order.refundCompletedDate = new Date();
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: `Refund status updated to ${status} successfully`,
      order: {
        orderId: order.orderId,
        refundStatus: order.refundStatus,
        refundNotes: order.refundNotes,
        refundAmount: order.refundAmount,
        refundPercentage: order.refundPercentage
      }
    });
  } catch (err) {
    console.error('Error updating refund status:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update refund status', 
      details: err.message 
    });
  }
};

// Add a new endpoint for admin to get all refund requests
exports.getAdminRefunds = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    console.log('Admin fetching refunds:', restaurantId ? `for restaurant ${restaurantId}` : 'for all restaurants');

    const matchStage = {
      orderStatus: 'cancelled',
      refundStatus: { $exists: true }
    };

    if (restaurantId && mongoose.Types.ObjectId.isValid(restaurantId)) {
      matchStage.restaurantId = new mongoose.Types.ObjectId(restaurantId);
    }

    const refundRequests = await Order.aggregate([
      {
        $match: matchStage
      },
      {
        $lookup: {
          from: 'payments',
          localField: 'orderId',
          foreignField: 'orderId',
          as: 'payment'
        }
      },
      {
        $unwind: {
          path: '$payment',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'restaurants',  // Make sure this matches your collection name
          localField: 'restaurantId',
          foreignField: '_id',
          as: 'restaurant'
        }
      },
      {
        $unwind: {
          path: '$restaurant',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $sort: { updatedAt: -1 }
      }
    ]);

    // Process and format the refund requests
    const processedRequests = refundRequests.map(request => ({
      ...request,
      customerName: request.user?.name || request.customer || 'Unknown Customer',
      restaurantName: request.restaurant?.restaurantName || request.restaurantName || 'Unknown Restaurant', // Fixed here
      paymentMethod: request.payment?.paymentMethod || 'Unknown',
      paymentStatus: request.payment?.paymentStatus || 'Unknown',
      refundPercentage: request.refundPercentage || 100,
      refundAmount: request.refundAmount || ((request.total || 0) * ((request.refundPercentage || 100) / 100)).toFixed(2)
    }));

    // Log the first request to debug
    if (processedRequests.length > 0) {
      console.log('Sample request:', {
        restaurantData: processedRequests[0].restaurant,
        restaurantName: processedRequests[0].restaurantName
      });
    }

    res.status(200).json({
      success: true,
      data: processedRequests
    });
  } catch (err) {
    console.error('Error fetching admin refunds:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch refunds', 
      details: err.message 
    });
  }
};

// Handle admin approval of refund
exports.approveRefund = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;

    console.log(`Admin approving refund for order ${orderId}`);

    // Find the order
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    // Update refund status and notes
    order.refundStatus = 'approved';
    if (notes) {
      order.adminNotes = notes;
    }
    order.refundCompletedDate = new Date();

    await order.save();

    // Get the io instance for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Emit event to restaurant dashboard
      io.to(order.restaurantId.toString()).emit('refundApproved', {
        orderId: order.orderId,
        adminNotes: order.adminNotes
      });
    }

    res.status(200).json({
      success: true,
      message: 'Refund approved successfully',
      order: {
        orderId: order.orderId,
        refundStatus: order.refundStatus,
        adminNotes: order.adminNotes
      }
    });
  } catch (err) {
    console.error('Error approving refund:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to approve refund', 
      details: err.message 
    });
  }
};

// Handle admin rejection of refund
exports.rejectRefund = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;

    if (!notes) {
      return res.status(400).json({ 
        success: false,
        error: 'Rejection reason is required' 
      });
    }

    console.log(`Admin rejecting refund for order ${orderId}`);

    // Find the order
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    // Update refund status and notes
    order.refundStatus = 'rejected';
    order.adminNotes = notes;

    await order.save();

    // Get the io instance for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Emit event to restaurant dashboard
      io.to(order.restaurantId.toString()).emit('refundRejected', {
        orderId: order.orderId,
        adminNotes: order.adminNotes
      });
    }

    res.status(200).json({
      success: true,
      message: 'Refund rejected successfully',
      order: {
        orderId: order.orderId,
        refundStatus: order.refundStatus,
        adminNotes: order.adminNotes
      }
    });
  } catch (err) {
    console.error('Error rejecting refund:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to reject refund', 
      details: err.message 
    });
  }
};


// Get nearby available orders (Zomato style)
// Get nearby available orders (directly using deliveryLocation)
exports.getAvailableOrders = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: "Partner location required" });
    }

    // Ensure lat/lng are numbers
    const partnerLat = Number(lat);
    const partnerLng = Number(lng);

    if (isNaN(partnerLat) || isNaN(partnerLng)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    // Find orders within 5 km
    const orders = await Order.find({
      orderStatus: "ready",
      "delivery.partnerId": null,
      deliveryLocation: {
        $near: {
          $geometry: { type: "Point", coordinates: [partnerLng, partnerLat] },
          $maxDistance: 5000, // 5 km
        },
      },
    })
      .populate("restaurantId", "restaurantName restaurantImage") // fetch restaurant info
      .lean();

    // Optionally calculate distance (in km) for frontend
    const ordersWithDistance = orders.map((order) => {
      const [lng, lat] = order.deliveryLocation.coordinates;
      const distanceKm =
        getDistanceFromLatLonInKm(partnerLat, partnerLng, lat, lng);
      return { ...order, distanceKm };
    });

    res.json(ordersWithDistance);
  } catch (err) {
    console.error("Error fetching nearby orders:", err);
    res.status(500).json({ error: err.message });
  }
};

// Helper function to calculate distance between two coordinates
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

exports.acceptOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId; // should be _id
    const partnerId = req.partner._id;

    const order = await Order.findOne({
      _id: orderId,
      orderStatus: "ready",
      "delivery.partnerId": null,
    });

    if (!order) {
      return res.status(400).json({ 
        error: "Order not ready or already assigned" 
      });
    }

    // Update ONLY delivery partner fields
    order.deliveryPartnerStatus = "accepted";
    order.delivery.partnerId = partnerId;
    order.delivery.assignedAt = new Date();

    // VERY IMPORTANT: DO NOT CHANGE orderStatus here
    // order.orderStatus remains "ready"

    await order.save();
    const io = req.app.get("io");

// Notify Restaurant
await createNotifications({
  io,
  userId: order.restaurantId,
  userType: "restaurant",
  userModel: "Restaurant",
  title: "Order Accepted",
  message: `Delivery partner accepted Order #${order.orderId}`,
  type: "partner_accepted",
  orderId: order._id,
});

// Notify Customer
await createNotifications({
  io,
  userId: order.userId,
  userType: "customer",
  userModel: "User",
  title: "Delivery Partner Assigned",
  message: "A delivery partner has been assigned to your order.",
  type: "partner_assigned",
  orderId: order._id,
});
   
    io.emit("newOrderAvailable", {
    orderId: order._id,
    restaurant: order.restaurantName,
    total: order.total
});
    if (io) {
      io.to(order.restaurantId.toString()).emit("partnerAccepted", {
        orderId: order._id,
        message: `Delivery partner has accepted order ${order.orderId}`
      });
    }

    res.json({ 
      success: true, 
      message: "Order accepted - proceed to pickup",
      order 
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// PATCH /api/delivery-partner/orders/:id/status
exports.updatePartnerOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, cashReceived, paymentCollected } = req.body;
    const partnerId = req.partner._id;

    const order = await Order.findOne({
      _id: orderId,
      'delivery.partnerId': partnerId,
    });

    if (!order) {
      return res.status(403).json({ error: 'Not your order or not found' });
    }

    const validStatuses = ['accepted', 'reached_restaurant', 'picked_up', 'reached_customer', 'delivered', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid partner status' });
    }

    // Update delivery partner status
    order.deliveryPartnerStatus = status;

    // Sync main order status
    if (status === 'picked_up') {
      order.orderStatus = 'out_for_delivery';
      order.delivery.pickedUpAt = new Date();
      const io = req.app.get("io");

await createNotifications({
  io,
  userId: order.userId,
  userType: "customer",
  userModel: "User",
  title: "Order Picked Up",
  message: "Your food has been picked up and is on the way.",
  type: "picked_up",
  orderId: order._id,
});

await createNotifications({
  io,
  userId: order.restaurantId,
  userType: "restaurant",
  userModel: "Restaurant",
  title: "Order Picked Up",
  message: `Order #${order.orderId} has been picked up.`,
  type: "picked_up",
  orderId: order._id,
});
    } else if (status === 'delivered') {
      order.orderStatus = 'delivered';
      order.delivery.deliveredAt = new Date();
      order.paymentConfirmedAt = new Date();

      // ── COD cash confirmation ─────────────────────────────────────
      if (cashReceived) {
        order.cashReceived = true;
        order.paymentCollected = paymentCollected || order.total;

        // IMPORTANT: Also update the Payment document
        const payment = await Payment.findOne({ orderId: order.orderId });
        if (payment) {
          payment.paymentStatus = 'completed';
          payment.restaurantAdminTransactionStatus = 'completed'; // or 'pending' if you want admin verification
          payment.updatedAt = new Date();
          await payment.save();

          console.log(`Payment for ${order.orderId} marked as completed (cash collected)`);
        } else {
          console.warn(`No payment record found for order ${order.orderId}`);
        }
      }
    }

    await order.save();
const io = req.app.get("io");

// Customer
await createNotifications({
  io,
  userId: order.userId,
  userType: "customer",
  userModel: "User",
  title: "Order Delivered",
  message: "Enjoy your meal. Thank you for ordering.",
  type: "delivered",
  orderId: order._id,
});

// Restaurant
await createNotifications({
  io,
  userId: order.restaurantId,
  userType: "restaurant",
  userModel: "Restaurant",
  title: "Order Delivered",
  message: `Order #${order.orderId} has been delivered.`,
  type: "delivered",
  orderId: order._id,
});

// Partner
await createNotifications({
  io,
  userId: partnerId,
  userType: "partner",
  userModel: "DeliveryPartner",
  title: "Delivery Completed",
  message: `Order #${order.orderId} delivered successfully.`,
  type: "delivered",
  orderId: order._id,
});
    // Emit socket update (keep your existing io code)
    
    if (io) {
      io.to(`order:${order._id}`).emit('partnerStatusUpdated', {
        orderId: order._id,
        orderNumber: order.orderId,
        deliveryPartnerStatus: status,
        mainOrderStatus: order.orderStatus,
        cashReceived: order.cashReceived,
        paymentCollected: order.paymentCollected,
        // ... other fields
      });
    }

    res.json({
      success: true,
      message: `Order marked as ${status}`,
      order,
    });
  } catch (err) {
    console.error('updatePartnerOrderStatus error:', err);
    res.status(500).json({ error: err.message });
  }
};
// Get all orders assigned to the current delivery partner
// Get all orders assigned to the current logged-in delivery partner
exports.getMyActiveOrders = async (req, res) => {
  try {
    const partnerId = req.partner._id;

    const orders = await Order.find({
      "delivery.partnerId": partnerId,
      deliveryPartnerStatus: { $in: ["accepted", "reached_restaurant", "picked_up", "reached_customer"] },
      orderStatus: { $nin: ["delivered", "cancelled"] }
    })
      .populate("restaurantId", "restaurantName restaurantImage address phone")
      .sort({ updatedAt: -1 })
      .lean();

    // Fetch payments for these orders
    const orderIds = orders.map(o => o.orderId);
    const payments = await Payment.find({ orderId: { $in: orderIds } })
      .select('orderId paymentMethod paymentStatus')
      .lean();

    // Map payments by orderId
    const paymentMap = {};
    payments.forEach(p => {
      paymentMap[p.orderId] = p.paymentMethod;
    });

    // Enrich orders with paymentMethod
    const enrichedOrders = orders.map(order => ({
      ...order,
      paymentMethod: paymentMap[order.orderId] || 'online'  // fallback
    }));

    res.status(200).json(enrichedOrders);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Failed to load active orders" });
  }
};
exports.getPartnerOrderHistory = async (req, res) => {
  try {
    const partnerId = req.partner._id || req.partner.id;

    if (!partnerId) {
      return res.status(401).json({ message: "Partner not authenticated" });
    }

    console.log("History for partner:", partnerId);

    const orders = await Order.find({
      "delivery.partnerId": new mongoose.Types.ObjectId(partnerId),
      orderStatus: { $in: ["delivered", "Cancelled"] }
    })
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json(orders);

  } catch (error) {
    console.error("History error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Partner cancels an assigned order (Zomato-style)
exports.cancelOrderByPartner = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const partnerId = req.partner._id;

    // Validate reason
    const validReasons = [
      "Restaurant closed or unavailable",
      "Unable to contact restaurant",
      "Order already picked up by another partner",
      "Wrong/incomplete address",
      "Traffic / too far / cannot deliver on time",
      "Personal reason / emergency",
      "Other"
    ];

    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({ 
        error: "Invalid or missing cancellation reason" 
      });
    }

    const order = await Order.findById(orderId);

console.log(order);
console.log("partner from token:", partnerId.toString());

console.log("order status:", order?.orderStatus);

console.log("delivery status:", order?.deliveryPartnerStatus);

console.log(
    "partner in order:",
    order?.delivery?.partnerId?.toString()
);
    if (!order) {
      return res.status(403).json({ 
        error: "Order not found, not assigned to you, or cannot be cancelled now" 
      });
    }

    // Update order
    order.orderStatus = "cancelled";
    order.deliveryPartnerStatus = "cancelled_by_partner";
    order.cancellationReason = `Cancelled by partner: ${reason}`;
    order.cancelledBy = "partner";
    order.cancelledAt = new Date();

    // Reset assignment so another partner can take it
    order.delivery.partnerId = null;
    order.delivery.assignedAt = null;

    await order.save();
const io = req.app.get("io");

// Restaurant
await createNotifications({
  io,
  userId: order.restaurantId,
  userType: "restaurant",
  userModel: "Restaurant",
  title: "Order Cancelled",
  message: `Delivery partner cancelled Order #${order.orderId}`,
  type: "partner_cancelled",
  orderId: order._id,
});

// Customer
await createNotifications({
  io,
  userId: order.userId,
  userType: "customer",
  userModel: "User",
  title: "Delivery Delayed",
  message: "Your delivery partner cancelled the order. We are assigning another partner.",
  type: "partner_cancelled",
  orderId: order._id,
});
  
    if (io && order.restaurantId) {
      io.to(order.restaurantId.toString()).emit("orderCancelledByPartner", {
        orderId: order._id,
        orderNumber: order.orderId,
        reason: order.cancellationReason,
        message: "Delivery partner cancelled this order"
      });
    }

    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order
    });
  } catch (err) {
    console.error("Partner cancel error:", err);
    res.status(500).json({ error: "Failed to cancel order", details: err.message });
  }
};

// Partner reports delay / late delivery
exports.reportDelayByPartner = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const partnerId = req.partner._id;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: "Please provide a valid delay reason" });
    }

    const order = await Order.findOne({
      _id: orderId,
      "delivery.partnerId": partnerId,
      orderStatus: { $in: ["ready", "pickedup"] }, // only allow reporting delay for active orders
    });

    if (!order) {
      return res.status(403).json({ 
        error: "Order not found or not assigned to you" 
      });
    }

    // Update delay info
    order.delivery.delayReportedAt = new Date();
    order.delivery.delayReason = reason.trim();

    await order.save();

    // Optional: Notify restaurant / system
    const io = req.app.get("io");
    if (io && order.restaurantId) {
      io.to(order.restaurantId.toString()).emit("partnerReportedDelay", {
        orderId: order._id,
        orderNumber: order.orderId,
        reason: order.delivery.delayReason,
        message: "Delivery partner reported delay for this order"
      });
    }

    res.status(200).json({
      success: true,
      message: "Delay reported successfully",
      order
    });
  } catch (err) {
    console.error("Partner delay report error:", err);
    res.status(500).json({ error: "Failed to report delay", details: err.message });
  }
};


// Helper: Load payment settings with defaults
const loadPaymentSettings = async () => {
  const settingsDoc = await Settings.findOne({ key: 'delivery_partner_payment' });
  return settingsDoc?.value || {
    baseAmount: 90,           // your new base
    perKmAmount: 10,
    minimumPayout: 60,
    peakHourBonus: 30,
    nightSurcharge: 30,
    badWeatherBonus: 25,
    codExtraFee: 15,          // extra for COD
    isPeakHourActive: true,
  };
};
// In earningsController.js
exports.calculateWeeklyEarnings = async (partnerId, startDate) => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  let totalGross = 0;
  let totalPenalties = 0;
  let totalTips = 0;
  let ordersCount = 0;

  for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
    const day = await exports.calculateDailyEarnings(partnerId, new Date(d));
    totalGross += day.grossEarnings;
    totalPenalties += day.penalties;
    totalTips += day.tips;
    ordersCount += day.ordersCompleted;
  }

  const platformFee = totalGross * 0.05; // example 5% (Zomato often 0–10%)
  const net = totalGross - platformFee - totalPenalties;

  return {
    gross: Math.round(totalGross),
    tips: Math.round(totalTips),
    penalties: Math.round(totalPenalties),
    platformFee: Math.round(platformFee),
    netPayable: Math.max(0, Math.round(net)),
    orders: ordersCount,
    periodStart: startDate,
    periodEnd: endDate,
  };
};
// Get today's earnings (fixed)
exports.getTodayEarnings = async (req, res) => {
  try {
    const partnerId = req.partner?._id;
    if (!partnerId) {
      return res.status(401).json({ error: "No partner ID" });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Load real settings
    const settings = await loadPaymentSettings();

    const completedOrders = await Order.find({
      "delivery.partnerId": partnerId,
      orderStatus: "delivered",
      updatedAt: { $gte: todayStart }
    }).lean();

    let totalEarnings = 0;
    completedOrders.forEach(order => {
      let payout = settings.baseAmount;

      // Add COD extra if applicable
      if (order.paymentMethod === 'cash') {
        payout += settings.codExtraFee;
      }

      // Optional: Add distance-based (if you have distanceKm field)
      // const distanceKm = order.distanceKm || 0;
      // payout += distanceKm * settings.perKmAmount;

      // Apply minimum payout
      payout = Math.max(payout, settings.minimumPayout);

      totalEarnings += payout;
    });

    res.json({
      success: true,
      todayEarnings: Math.round(totalEarnings),
      completedDeliveries: completedOrders.length,
      currency: "₹"
    });
  } catch (err) {
    console.error("getTodayEarnings ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get total lifetime earnings (fixed)
exports.getTotalEarnings = async (req, res) => {
  try {
    const partnerId = req.partner._id;

    const settings = await loadPaymentSettings();

    const completedOrders = await Order.find({
      "delivery.partnerId": partnerId,
      orderStatus: "delivered"
    }).lean();

    let totalEarnings = 0;
    completedOrders.forEach(order => {
      let payout = settings.baseAmount;

      if (order.paymentMethod === 'cash') {
        payout += settings.codExtraFee;
      }

      // Optional distance
      // payout += (order.distanceKm || 0) * settings.perKmAmount;

      payout = Math.max(payout, settings.minimumPayout);
      totalEarnings += payout;
    });

    res.json({
      success: true,
      totalEarnings: Math.round(totalEarnings),
      totalDeliveries: completedOrders.length
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch total earnings" });
  }
};

// Get current month earnings (fixed)
exports.getCurrentMonthEarnings = async (req, res) => {
  try {
    const partnerId = req.partner._id;

    const settings = await loadPaymentSettings();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const completedOrders = await Order.find({
      "delivery.partnerId": partnerId,
      orderStatus: "delivered",
      updatedAt: { $gte: startOfMonth, $lte: endOfMonth }
    }).lean();

    let monthlyEarnings = 0;
    completedOrders.forEach(order => {
      let payout = settings.baseAmount;

      if (order.paymentMethod === 'cash') {
        payout += settings.codExtraFee;
      }

      payout = Math.max(payout, settings.minimumPayout);
      monthlyEarnings += payout;
    });

    res.json({
      success: true,
      monthlyEarnings: Math.round(monthlyEarnings),
      monthlyDeliveries: completedOrders.length,
      month: now.toLocaleString('default', { month: 'long', year: 'numeric' })
    });
  } catch (err) {
    console.error("Error fetching monthly earnings:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getRecentEarnings = async (req, res) => {
  try {
    const partnerId = req.partner?._id;
    if (!partnerId) {
      return res.status(401).json({ 
        success: false, 
        message: "Partner not authenticated" 
      });
    }

    const days = parseInt(req.query.days) || 7;
    if (days < 1 || days > 90) {
      return res.status(400).json({ success: false, message: "Invalid days parameter" });
    }

    const settings = await loadPaymentSettings();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    // Fetch only delivered orders for this partner in the date range
    const deliveredOrders = await Order.find({
      "delivery.partnerId": partnerId,
      orderStatus: "delivered",
      "delivery.deliveredAt": { $gte: startDate }
    })
      .select("delivery.deliveredAt paymentMethod distanceKm total") // minimal fields
      .lean();

    // Group by day
    const dailyData = {};
    
    // Initialize all days (even with 0 earnings)
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
      dailyData[dateStr] = { amount: 0, deliveries: 0 };
    }

    // Calculate earnings per order
    deliveredOrders.forEach(order => {
      if (!order.delivery?.deliveredAt) return; // safety check

      const dateStr = new Date(order.delivery.deliveredAt)
        .toISOString()
        .split("T")[0];

      let payout = settings.baseAmount || 90;

      if (order.paymentMethod === "cash") {
        payout += settings.codExtraFee || 15;
      }

      // Add distance bonus only if you actually store distanceKm
      // if (order.distanceKm && !isNaN(order.distanceKm)) {
      //   payout += order.distanceKm * (settings.perKmAmount || 10);
      // }

      // Apply minimum
      payout = Math.max(payout, settings.minimumPayout || 60);

      if (dailyData[dateStr]) {
        dailyData[dateStr].amount += payout;
        dailyData[dateStr].deliveries += 1;
      }
    });

    // Build response array - newest first
    const recent = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      recent.push({
        date: dateStr,
        amount: Math.round(dailyData[dateStr]?.amount || 0),
        deliveries: dailyData[dateStr]?.deliveries || 0
      });
    }

    res.json({
      success: true,
      recent,
      queryDays: days,
      partnerId: partnerId.toString()
    });

  } catch (err) {
    console.error("getRecentEarnings error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load recent earnings",
      error: err.message
    });
  }
};
exports.rateDeliveryPartner = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { rating, review } = req.body;

    let userId;
    if (req.user && req.user._id) {
      userId = req.user._id;
      console.log('[rating] Authenticated user ID:', userId);
    } else {
      console.warn('[rating] No authenticated user found - skipping ownership check (dev mode)');
      // In production: return res.status(401).json({ error: 'Please login to rate' });
    }

    const query = userId ? { orderId, userId } : { orderId };
    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({ error: "Order not found or not yours" });
    }

    if (order.orderStatus !== "delivered") {
      return res.status(400).json({ error: "Can only rate delivered orders" });
    }

    if (order.partnerRating) {
      return res.status(400).json({ error: "You have already rated this delivery" });
    }

    order.partnerRating = rating;
    order.partnerReview = review?.trim() || null;
    order.partnerRatedAt = new Date();

    await order.save();

    res.json({ success: true, message: "Thank you for your feedback!" });
  } catch (err) {
    console.error('[rating] Error:', err.stack);
    res.status(500).json({
      error: "Failed to submit rating",
      details: err.message
    });
  }
};
// controllers/deliveryPartner/orderController.js (add this function)
exports.getOrderDetail = async (req, res) => {
  try {
    const { orderId } = req.params; // Mongo _id
    const partnerId = req.partner._id;

    const order = await Order.findOne({
      _id: orderId,
      "delivery.partnerId": partnerId
    })
      .populate('restaurantId', 'restaurantName restaurantImage address phone')
      .lean();

    if (!order) {
      return res.status(404).json({ error: 'Order not found or not yours' });
    }

    res.status(200).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
exports.getPartnerDashboardStats = async (req, res) => {
  try {
    const partnerId = req.partner._id;

    const totalAssigned = await Order.countDocuments({
      "delivery.partnerId": partnerId
    });

    const accepted = await Order.countDocuments({
      "delivery.partnerId": partnerId,
      deliveryPartnerStatus: {
        $in: [
          "accepted",
          "reached_restaurant",
          "picked_up",
          "reached_customer",
          "delivered"
        ]
      }
    });

    const cancelled = await Order.countDocuments({
      "delivery.partnerId": partnerId,
      deliveryPartnerStatus: "cancelled_by_partner"
    });

    const delivered = await Order.countDocuments({
      "delivery.partnerId": partnerId,
      orderStatus: "delivered"
    });

    const ratedOrders = await Order.find({
      "delivery.partnerId": partnerId,
      partnerRating: { $exists: true, $ne: null }
    }).select("partnerRating");

    const avgRating =
      ratedOrders.length > 0
        ? (
            ratedOrders.reduce((a, b) => a + b.partnerRating, 0) /
            ratedOrders.length
          ).toFixed(1)
        : 0;

    res.json({
      success: true,
      acceptanceRate:
        totalAssigned === 0
          ? 0
          : Math.round((accepted / totalAssigned) * 100),

      cancellationRate:
        totalAssigned === 0
          ? 0
          : Math.round((cancelled / totalAssigned) * 100),

      totalOrders: totalAssigned,
      delivered,
      avgRating,
      totalRatings: ratedOrders.length
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};