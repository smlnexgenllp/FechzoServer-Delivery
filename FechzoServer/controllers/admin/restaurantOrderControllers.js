const Order = require('../../models/order/order');

// Get orders for a specific restaurant
exports.getRestaurantOrders = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Validate restaurantId
    if (!restaurantId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid restaurant ID format',
      });
    }

    // Fetch orders for the restaurant
    const orders = await Order.find({ restaurantId })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Transform orders to match frontend format
    const formattedOrders = orders.map(order => {
      try {
        return {
          id: order.orderId,
          customer: order.userId?.name || 'N/A',
          address: order.selectedAddress?.address || 'N/A',
          items: order.cartItems?.map(item => item.name).join(', ') || 'N/A',
          total: order.total ? `₹${order.total.toFixed(2)}` : 'N/A',
          status: mapOrderStatus(order.orderStatus),
          orderedDate: order.createdAt
            ? new Date(order.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : 'N/A',
          time: order.createdAt
            ? new Date(order.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'N/A',
          tracking: createTrackingSteps(order.orderStatus, order.updatedAt),
        };
      } catch (error) {
        console.error(`Error formatting order ${order.orderId}:`, error);
        return null;
      }
    }).filter(order => order !== null);

    res.status(200).json({
      success: true,
      data: formattedOrders,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message,
    });
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;

    if (!orderId || !newStatus) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and new status are required',
      });
    }

    const validStatuses = ['placed', 'preparing', 'pickedUp', 'delivered', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Update order status
    order.orderStatus = newStatus;
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        id: order.orderId,
        status: mapOrderStatus(newStatus),
        tracking: createTrackingSteps(newStatus, order.updatedAt),
      },
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order status',
      error: error.message,
    });
  }
};

// Helper function to map backend status to frontend status
const mapOrderStatus = (status) => {
  switch (status) {
    case 'placed':
      return 'Order Placed';
    case 'preparing':
      return 'Preparing Food';
    case 'pickedUp':
      return 'On The Way';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
};

// Helper function to create tracking steps for display
const createTrackingSteps = (currentStatus, updatedAt) => {
  const steps = [
    { status: 'Order Placed', time: '', completed: false },
    { status: 'Preparing Food', time: '', completed: false },
    { status: 'On The Way', time: '', completed: false },
    { status: 'Delivered', time: '', completed: false },
  ];

  // Map backend statuses to frontend step indices
  const statusToStepIndex = {
    placed: 0,
    preparing: 1,
    pickedUp: 2,
    delivered: 3,
  };

  // Get the current step index
  const currentStepIndex = statusToStepIndex[currentStatus] !== undefined ? statusToStepIndex[currentStatus] : -1;

  // Mark steps as completed up to the current status
  steps.forEach((step, index) => {
    if (currentStepIndex >= index) {
      step.completed = true;
      step.time = new Date(updatedAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else {
      step.completed = false;
      step.time = 'Pending';
    }
  });

  // If the order is cancelled, only mark "Order Placed" as completed
  if (currentStatus === 'cancelled') {
    steps.forEach((step, index) => {
      step.completed = index === 0;
      step.time = index === 0 ? new Date(updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Pending';
    });
  }

  return steps;
};