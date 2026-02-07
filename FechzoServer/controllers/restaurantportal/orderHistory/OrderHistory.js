const mongoose = require('mongoose');
const Order = require('../../../models/order/order');
const Payment = require('../../../models/order/payment');

// Helper to format dates and times
const formatDate = (date) => {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(',', '');
};

const formatTime = (date) => {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// Helper to calculate delivery time between placed and delivered
const calculateDeliveryTime = (placedTime, deliveredTime) => {
  if (!placedTime || !deliveredTime) return '';
  const diffMs = new Date(deliveredTime) - new Date(placedTime);
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours} hour ${minutes} minutes` : `${minutes} minutes`;
};

// Helper to calculate date range (createdAt to settledAt/updatedAt)
const calculateDateRange = (createdAt, settledAt, updatedAt) => {
  const start = formatDate(new Date(createdAt));
  const endDate = settledAt || updatedAt;
  const end = endDate ? formatDate(new Date(endDate)) : formatDate(new Date());
  return `${start} - ${end}`;
};

// Fetch orders for a specific restaurant
// ... other imports and helpers remain the same

exports.getOrdersByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Validate restaurantId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: 'Invalid restaurant ID' });
    }

    // Fetch orders for the restaurant
    const orders = await Order.find({ restaurantId })
      .populate('userId', 'name')
      .populate('restaurantId', 'name address')
      .lean();

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'No orders found for this restaurant' });
    }

    // Fetch payment details for all orders
    const orderIds = orders.map((order) => order.orderId);
    const payments = await Payment.find({ orderId: { $in: orderIds } }).lean();

    // Map payments to a dictionary for quick lookup
    const paymentMap = payments.reduce((acc, payment) => {
      acc[payment.orderId] = payment;
      return acc;
    }, {});

    // Format orders to match frontend expectations
    const formattedOrders = orders.map((order) => {
      const payment = paymentMap[order.orderId] || {};

      // Calculate financials with fallback values
      let grossRevenue = 0;
      let netReceivable = 0;
      let unsettledAmount = 0;

      if (payment.orderSummary) {
        const itemsTotal = parseFloat(payment.orderSummary.find((s) => s.type === 'itemsTotal')?.value || '0');
        const grandTotal = parseFloat(payment.orderSummary.find((s) => s.type === 'grandTotal')?.value || '0');
        grossRevenue = isNaN(itemsTotal) ? 0 : itemsTotal;
        netReceivable = isNaN(grandTotal) ? 0 : grandTotal;
        unsettledAmount = payment.restaurantAdminTransactionStatus === 'pending' ? netReceivable : 0;
      } else if (order.total) {
        grossRevenue = parseFloat(order.total) || 0;
        netReceivable = parseFloat(order.total) || 0;
        unsettledAmount = payment.restaurantAdminTransactionStatus === 'pending' ? netReceivable : 0;
      }

      // Normalize payment method
      const paymentMethod = payment.paymentMethod
        ? payment.paymentMethod.charAt(0).toUpperCase() + payment.paymentMethod.slice(1)
        : 'Unknown';

      // Normalize status
      const status = order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1);

      // Calculate timeline
      const timelineSteps = [
        { status: 'Placed', time: formatTime(new Date(order.createdAt)), date: formatDate(new Date(order.createdAt)), completed: true },
        { status: 'Accepted', time: '', date: '', completed: false },
        { status: 'Delivery partner arrived', time: '', date: '', completed: false },
        { status: 'Ready', time: '', date: '', completed: false },
        { status: 'Picked up', time: '', date: '', completed: false },
        { status: 'Delivered', time: '', date: '', completed: false },
      ];

      // Update timeline based on order status
      let currentStep = 0;
      if (order.orderStatus === 'placed') currentStep = 1;
      if (order.orderStatus === 'accepted') currentStep = 2;
      if (order.orderStatus === 'delivered') currentStep = 5;

      for (let i = 0; i <= currentStep; i++) {
        timelineSteps[i].completed = true;
        if (i > 0 && i <= currentStep) {
          const stepTime = new Date(order.createdAt);
          stepTime.setMinutes(stepTime.getMinutes() + i * 15);
          timelineSteps[i].time = formatTime(stepTime);
          timelineSteps[i].date = formatDate(stepTime);
        }
      }

      // Mark 'Ready' as incorrect for demo purposes
      if (order.orderId === 'ORD001') {
        timelineSteps[3].incorrect = true;
      }

      // Calculate delivery time
      const deliveredStep = timelineSteps.find((step) => step.status === 'Delivered' && step.completed);
      const placedStep = timelineSteps[0];
      const deliveryTime = calculateDeliveryTime(
        new Date(`${placedStep.date} ${placedStep.time}`),
        deliveredStep ? new Date(`${deliveredStep.date} ${deliveredStep.time}`) : null
      );

      // Calculate date range
      const dateRange = calculateDateRange(
        order.createdAt,
        payment.restaurantAdminTransactionStatus === 'completed' ? payment.updatedAt : null,
        order.updatedAt
      );

      // Format items
      const items = order.cartItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price) || 0,
      }));

      // Format customer's address
      const customerAddress = order.selectedAddress
        ? `${order.selectedAddress.address}, ${order.selectedAddress.city}, ${order.selectedAddress.state} - ${order.selectedAddress.pincode}`
        : 'Unknown Address';

      return {
        id: order.orderId,
        orderNumber: order.orderId,
        dateRange,
        date: order.createdAt,
        grossRevenue,
        netReceivable,
        unsettledAmount,
        timeline: timelineSteps,
        items,
        customer: order.userId?.name || 'Unknown',
        deliveryTime,
        status,
        settled: payment.restaurantAdminTransactionStatus === 'completed',
        settledAt: payment.restaurantAdminTransactionStatus === 'completed' ? formatTime(new Date(payment.updatedAt)) + ' ' + formatDate(new Date(payment.updatedAt)) : null,
        location: customerAddress,
        paymentMethod,
        restaurantLocation: order.restaurantId?.address || 'Unknown Location',
      };
    });

    res.status(200).json(formattedOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Server error while fetching orders' });
  }
};