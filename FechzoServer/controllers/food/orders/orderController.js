const Order = require('../../../models/order/order');
const mongoose = require('mongoose');
const Payment = require('../../../models/order/payment');
const notificationController = require('../../restaurants/notificationController');

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

