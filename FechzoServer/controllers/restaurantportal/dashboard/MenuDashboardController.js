const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');
const mongoose = require('mongoose');
const Rating = require('../../../models/restaurants/RatingModels');
const Order = require('../../../models/order/order');
const Payment = require('../../../models/order/payment');

const getMenuDashboardInfo = async (req, res) => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id).select('restaurantName');

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    res.json({ title: `${restaurant.restaurantName} - Dashboard` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching dashboard info' });
  }
};

// Add this helper function for date filtering
const getDateRange = (timeRange) => {
  const now = new Date();
  let startDate, endDate;
  
  switch(timeRange) {
    case 'today':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay()); // Sunday
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6); // Saturday
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    default:
      // Default to all time
      startDate = null;
      endDate = null;
  }
  
  return { startDate, endDate };
};

// Controller to fetch dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const restaurantId = req.query.restaurantId || req.user?.restaurantId;
    const timeRange = req.query.timeRange || 'all';
    const customStartDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const customEndDate = req.query.endDate ? new Date(req.query.endDate) : null;
    
    // Get date range based on timeRange
    let { startDate, endDate } = getDateRange(timeRange);
    
    // Override with custom dates if provided
    if (customStartDate && customEndDate) {
      startDate = customStartDate;
      endDate = customEndDate;
    }
    
    // Build date filter condition based on date range
    const dateFilter = (startDate && endDate) ? {
      createdAt: { 
        $gte: startDate, 
        $lte: endDate
      }
    } : {};

    // Validate restaurantId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ error: 'Invalid restaurant ID' });
    }

    // 1. Fetch Average Rating and Review Count
    const ratingStats = await Rating.aggregate([
      { $match: { restaurantId: restaurantId.toString() } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]);

    const averageRating = ratingStats[0]?.averageRating
      ? Number(ratingStats[0].averageRating.toFixed(1))
      : 0;
    const reviewCount = ratingStats[0]?.reviewCount || 0;

    // 2. Fetch Total Items Sold (all time, only for delivered orders with completed payments)
    const completedOrders = await Payment.aggregate([
      { $match: { paymentStatus: 'completed' } },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: 'orderId',
          as: 'order',
        },
      },
      { $unwind: '$order' },
      {
        $match: {
          'order.restaurantId': new mongoose.Types.ObjectId(restaurantId),
          'order.orderStatus': 'delivered', // Only delivered orders
        },
      },
      { $unwind: '$order.cartItems' },
      {
        $group: {
          _id: null,
          totalItemsSold: { $sum: '$order.cartItems.quantity' },
        },
      },
    ]);

    const totalItemsSold = completedOrders[0]?.totalItemsSold || 0;

    // 3. Fetch Top Selling Items (all time, only delivered & paid)
    const topSellingItems = await Order.aggregate([
      {
        $match: {
          restaurantId: new mongoose.Types.ObjectId(restaurantId),
          orderStatus: 'delivered',
        },
      },
      { $unwind: '$cartItems' },
      {
        $lookup: {
          from: 'payments',
          localField: 'orderId',
          foreignField: 'orderId',
          as: 'payment',
        },
      },
      { $unwind: '$payment' },
      { $match: { 'payment.paymentStatus': 'completed' } },
      {
        $group: {
          _id: '$cartItems.name',
          sales: { $sum: '$cartItems.quantity' },
          revenue: { $sum: { $multiply: ['$cartItems.quantity', '$cartItems.price'] } },
        },
      },
      {
        $project: {
          name: '$_id',
          sales: 1,
          revenue: 1,
          _id: 0,
        },
      },
      { $sort: { sales: -1 } },
      // { $limit: 5 },
    ]);

    // 4. Fetch Customer Favorites (by rating)
    const customerFavorites = await Rating.aggregate([
      { $match: { restaurantId: restaurantId.toString() } },
      {
        $group: {
          _id: '$foodId',
          name: { $first: '$foodId' }, // Ideally, join with menu to get food name
          rating: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          name: 1,
          rating: { $round: ['$rating', 1] },
          count: 1,
          _id: 0,
        },
      },
      { $sort: { rating: -1 } },
      { $limit: 5 },
    ]);

    // 5. Peak Ordering Times - Group orders by hour of day
    const peakOrderingTimes = await Order.aggregate([
      {
        $match: {
          restaurantId: new mongoose.Types.ObjectId(restaurantId),
          orderStatus: { $in: ['placed', 'processing', 'delivered'] },
          ...dateFilter
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
      { $unwind: '$payment' },
      { $match: { 'payment.paymentStatus': 'completed' } },
      {
        $project: {
          hour: { $hour: '$createdAt' },
          orderId: 1
        }
      },
      {
        $group: {
          _id: '$hour',
          orders: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          hour: '$_id',
          time: { 
            $concat: [
              { $toString: '$_id' }, 
              ':00'
            ] 
          },
          orders: 1
        }
      },
      { $sort: { hour: 1 } }
    ]);
    
    // 6. Sales by Day of Week
    const salesByDayOfWeek = await Order.aggregate([
      {
        $match: {
          restaurantId: new mongoose.Types.ObjectId(restaurantId),
          orderStatus: 'delivered',
          ...dateFilter
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
      { $unwind: '$payment' },
      { $match: { 'payment.paymentStatus': 'completed' } },
      {
        $project: {
          dayOfWeek: { $dayOfWeek: '$createdAt' }, // 1 for Sunday, 2 for Monday, etc.
          total: 1
        }
      },
      {
        $group: {
          _id: '$dayOfWeek',
          sales: { $sum: '$total' }
        }
      },
      {
        $project: {
          _id: 0,
          dayNum: '$_id',
          day: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id', 1] }, then: 'Sun' },
                { case: { $eq: ['$_id', 2] }, then: 'Mon' },
                { case: { $eq: ['$_id', 3] }, then: 'Tue' },
                { case: { $eq: ['$_id', 4] }, then: 'Wed' },
                { case: { $eq: ['$_id', 5] }, then: 'Thu' },
                { case: { $eq: ['$_id', 6] }, then: 'Fri' },
                { case: { $eq: ['$_id', 7] }, then: 'Sat' }
              ],
              default: 'Unknown'
            }
          },
          sales: 1
        }
      },
      { $sort: { dayNum: 1 } }
    ]);

    res.status(200).json({
      averageRating,
      reviewCount,
      totalItemsSold,
      topSellingItems,
      customerFavorites,
      peakOrderingTimes,
      salesByDayOfWeek
    });
    
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getMenuDashboardInfo,
  getDashboardStats,
};