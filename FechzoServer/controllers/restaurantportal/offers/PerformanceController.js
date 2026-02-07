const Order = require('../../../models/order/order');
const Payment = require('../../../models/order/payment');
const moment = require('moment');

exports.getPerformanceData = async (req, res) => {
  try {
    const { restaurantId, timeFilter } = req.query;

    if (!restaurantId || !timeFilter) {
      return res.status(400).json({ message: 'restaurantId and timeFilter are required' });
    }

    // Calculate date ranges based on timeFilter
    const { currentPeriod, previousPeriod } = calculateDateRanges(timeFilter);

    // Fetch current period data
    const currentOrders = await Order.find({
      restaurantId,
      createdAt: { $gte: currentPeriod.start, $lte: currentPeriod.end },
      orderStatus: { $ne: 'cancelled' }
    });

    // Fetch previous period data for comparison
    const previousOrders = await Order.find({
      restaurantId,
      createdAt: { $gte: previousPeriod.start, $lte: previousPeriod.end },
      orderStatus: { $ne: 'cancelled' }
    });

    // Calculate current metrics
    const currentMetrics = await calculateMetrics(currentOrders, restaurantId, currentPeriod);
    const previousMetrics = await calculateMetrics(previousOrders, restaurantId, previousPeriod);

    const performanceData = {
      current: currentMetrics,
      previous: previousMetrics
    };

    res.status(200).json(performanceData);
  } catch (error) {
    console.error('Error fetching performance data:', error);
    res.status(500).json({ message: 'Failed to fetch performance data', error: error.message });
  }
};

// Helper function to calculate date ranges
const calculateDateRanges = (timeFilter) => {
  const now = moment();
  let currentStart, currentEnd, previousStart, previousEnd;

  switch (timeFilter) {
    case 'daily':
      currentStart = moment().startOf('day');
      currentEnd = moment().endOf('day');
      previousStart = moment().subtract(1, 'day').startOf('day');
      previousEnd = moment().subtract(1, 'day').endOf('day');
      break;
    case 'weekly':
      currentStart = moment().startOf('week');
      currentEnd = moment().endOf('week');
      previousStart = moment().subtract(1, 'week').startOf('week');
      previousEnd = moment().subtract(1, 'week').endOf('week');
      break;
    case 'monthly':
      currentStart = moment().startOf('month');
      currentEnd = moment().endOf('month');
      previousStart = moment().subtract(1, 'month').startOf('month');
      previousEnd = moment().subtract(1, 'month').endOf('month');
      break;
    default:
      throw new Error('Invalid timeFilter');
  }

  return {
    currentPeriod: { start: currentStart.toDate(), end: currentEnd.toDate() },
    previousPeriod: { start: previousStart.toDate(), end: previousEnd.toDate() }
  };
};

// Helper function to calculate performance metrics
const calculateMetrics = async (orders, restaurantId, period) => {
  // Calculate gross sales
  const grossSales = orders.reduce((sum, order) => sum + order.total, 0);

  // Get delivered orders count
  const deliveredOrders = orders.filter(order => order.orderStatus === 'delivered').length;

  // Calculate discount given from payments.appliedOffers (standardized approach)
  const orderIds = orders.map(order => order.orderId);
  const payments = await Payment.find({ orderId: { $in: orderIds } });

  let totalDiscount = 0;
  payments.forEach(payment => {
    // Primary method: from payment.appliedOffers
    if (payment.appliedOffers && payment.appliedOffers.length > 0) {
      totalDiscount += payment.appliedOffers.reduce((sum, offer) => sum + (offer.discountAmount || 0), 0);
    } else {
      // Fallback method: from payment.orderSummary (for backward compatibility)
      const discountItem = payment.orderSummary?.find(item => item.type === 'discount');
      if (discountItem) {
        totalDiscount += parseFloat(discountItem.value) || 0;
      }
    }
  });

  // Calculate effective discount percentage
  const effectiveDiscount = grossSales > 0 ? ((totalDiscount / grossSales) * 100).toFixed(1) : '0.0';

  return {
    grossSales: `₹${grossSales.toFixed(0)}`,
    orders: deliveredOrders,
    discountGiven: `₹${totalDiscount.toFixed(0)}`,
    effectiveDiscount: `${effectiveDiscount}%`
  };
};