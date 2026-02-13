const mongoose = require('mongoose');
const Payment = require('../../models/order/payment');
const Order = require('../../models/order/order');
const User = require('../../models/User/User');

// Helper function to format payment method for frontend
const formatPaymentMethod = (method) => {
  switch (method) {
    case 'cash': return 'Cash on Delivery';
    case 'cards': return 'Credit Card';
    case 'upi': return 'UPI';
    case 'wallets': return 'Digital Wallet';
    default: return method || 'Unknown';
  }
};

// Get all payments with filtering
exports.getPayments = async (req, res) => {
  try {
    const { status, paymentMethod, restaurantName, page = 1, limit = 8, dateRange, startDate, endDate } = req.query;

    const query = {};
    if (status && status !== 'all') {
      query.paymentStatus = status;
    }
    if (paymentMethod && paymentMethod !== 'all') {
      const methodMap = {
        'Cash on Delivery': 'cash',
        'Credit Card': 'cards',
        'UPI': 'upi',
        'Digital Wallet': 'wallets'
      };
      query.paymentMethod = methodMap[paymentMethod] || paymentMethod;
    }

    // Add date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let start;
      switch (dateRange) {
        case 'today':
          start = new Date(now.setHours(0, 0, 0, 0));
          query.createdAt = { $gte: start };
          break;
        case 'lastWeek':
          start = new Date(now.setDate(now.getDate() - 7));
          query.createdAt = { $gte: start };
          break;
        case 'lastMonth':
          start = new Date(now.setMonth(now.getMonth() - 1));
          query.createdAt = { $gte: start };
          break;
        case 'custom':
          if (startDate && endDate) {
            query.createdAt = {
              $gte: new Date(startDate),
              $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
          }
          break;
        default:
          break;
      }
    }

    // Aggregate payments with order and user data
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: 'orderId',
          as: 'order'
        }
      },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'order.userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
    ];

    if (restaurantName && restaurantName !== 'all') {
      pipeline.push({
        $match: {
          'order.restaurantName': { $regex: `^${restaurantName}$`, $options: 'i' }
        }
      });
    }

    pipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );

    const payments = await Payment.aggregate(pipeline);

    const formattedPayments = payments.map(payment => ({
      id: payment.paymentId || payment._id.toString(),
      customer: payment.user?.name || 'Unknown',
      restaurant: payment.order?.restaurantName || 'Unknown',
      restaurantId: payment.order?._id.toString() || 'N/A',
      amount: payment.order?.total || 0,
      status: payment.paymentStatus || 'Unknown',
      date: payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) : 'N/A',
      method: formatPaymentMethod(payment.paymentMethod),
      items: payment.order?.cartItems?.length || 0,
      upiId: payment.paymentMethod === 'upi' ? payment.upiId : undefined,
      cardDetails: payment.paymentMethod === 'cards' ? {
        cardholderName: payment.cardholderName,
        cardExpiry: payment.cardExpiry,
        maskedCardNumber: payment.maskedCardNumber
      } : undefined
    }));

    const totalPipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: 'orderId',
          as: 'order'
        }
      },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } }
    ];
    if (restaurantName && restaurantName !== 'all') {
      totalPipeline.push({
        $match: {
          'order.restaurantName': { $regex: `^${restaurantName}$`, $options: 'i' }
        }
      });
    }
    const totalResult = await Payment.aggregate(totalPipeline);
    const total = totalResult.length;

    res.status(200).json({
      success: true,
      data: formattedPayments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
};

// Remaining controllers (getRevenueData, getTransactionData, getDashboardStats) remain unchanged
// Including them for completeness
exports.getRevenueData = async (req, res) => {
  try {
    const { dateRange, startDate, endDate } = req.query;
    let start, end = new Date();

    if (dateRange === 'today') {
      start = new Date(end.setHours(0, 0, 0, 0));
    } else if (dateRange === 'lastMonth') {
      start = new Date(end.setMonth(end.getMonth() - 1));
    } else if (dateRange === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    } else {
      // Default to last 7 days
      start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const revenue = await Payment.aggregate([
      {
        $match: {
          paymentStatus: 'completed',
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: 'orderId',
          as: 'order'
        }
      },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            day: { $dayOfWeek: '$createdAt' }
          },
          revenue: { $sum: '$order.total' }
        }
      },
      {
        $project: {
          name: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id.day', 1] }, then: 'Sun' },
                { case: { $eq: ['$_id.day', 2] }, then: 'Mon' },
                { case: { $eq: ['$_id.day', 3] }, then: 'Tue' },
                { case: { $eq: ['$_id.day', 4] }, then: 'Wed' },
                { case: { $eq: ['$_id.day', 5] }, then: 'Thu' },
                { case: { $eq: ['$_id.day', 6] }, then: 'Fri' },
                { case: { $eq: ['$_id.day', 7] }, then: 'Sat' }
              ],
              default: 'Unknown'
            }
          },
          revenue: 1
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const revenueData = days.map(day => {
      const found = revenue.find(r => r.name === day);
      return {
        name: day,
        revenue: found ? found.revenue : 0
      };
    });

    res.status(200).json({
      success: true,
      data: revenueData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue data',
      error: error.message
    });
  }
};

exports.getTransactionData = async (req, res) => {
  try {
    const { dateRange, startDate, endDate } = req.query;
    let matchQuery = { paymentStatus: 'completed' };

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let start;
      switch (dateRange) {
        case 'today':
          start = new Date(now.setHours(0, 0, 0, 0));
          matchQuery.createdAt = { $gte: start };
          break;
        case 'lastWeek':
          start = new Date(now.setDate(now.getDate() - 7));
          matchQuery.createdAt = { $gte: start };
          break;
        case 'lastMonth':
          start = new Date(now.setMonth(now.getMonth() - 1));
          matchQuery.createdAt = { $gte: start };
          break;
        case 'custom':
          if (startDate && endDate) {
            matchQuery.createdAt = {
              $gte: new Date(startDate),
              $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
          }
          break;
        default:
          break;
      }
    }

    const transactions = await Payment.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$paymentMethod',
          value: { $sum: 1 }
        }
      },
      {
        $project: {
          name: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id', 'cash'] }, then: 'Cash on Delivery' },
                { case: { $eq: ['$_id', 'cards'] }, then: 'Credit Card' },
                { case: { $eq: ['$_id', 'upi'] }, then: 'UPI' },
                { case: { $eq: ['$_id', 'wallets'] }, then: 'Digital Wallet' }
              ],
              default: 'Other'
            }
          },
          value: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction data',
      error: error.message
    });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const { dateRange, startDate, endDate } = req.query;
    let matchQuery = {};

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let start;
      switch (dateRange) {
        case 'today':
          start = new Date(now.setHours(0, 0, 0, 0));
          matchQuery.createdAt = { $gte: start };
          break;
        case 'lastWeek':
          start = new Date(now.setDate(now.getDate() - 7));
          matchQuery.createdAt = { $gte: start };
          break;
        case 'lastMonth':
          start = new Date(now.setMonth(now.getMonth() - 1));
          matchQuery.createdAt = { $gte: start };
          break;
        case 'custom':
          if (startDate && endDate) {
            matchQuery.createdAt = {
              $gte: new Date(startDate),
              $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
          }
          break;
        default:
          break;
      }
    }

    const completedMatch = { ...matchQuery, paymentStatus: 'completed' };
    const pendingMatch = { ...matchQuery, paymentStatus: 'pending' };
    const failedMatch = { ...matchQuery, paymentStatus: 'failed' };

    const [totalRevenue, totalOrders, pendingPayments, failedPayments, avgOrderValue] = await Promise.all([
      Payment.aggregate([
        { $match: completedMatch },
        { $lookup: { from: 'orders', localField: 'orderId', foreignField: 'orderId', as: 'order' } },
        { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
        { $group: { _id: null, total: { $sum: '$order.total' } } }
      ]).then(result => result[0]?.total || 0),
      Order.countDocuments(matchQuery),
      Payment.countDocuments(pendingMatch),
      Payment.countDocuments(failedMatch),
      Payment.aggregate([
        { $match: completedMatch },
        { $lookup: { from: 'orders', localField: 'orderId', foreignField: 'orderId', as: 'order' } },
        { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
        { $group: { _id: null, avg: { $avg: '$order.total' } } }
      ]).then(result => result[0]?.avg || 0)
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalOrders,
        pendingPayments,
        failedPayments,
        averageOrderValue: avgOrderValue
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
};


const Settings = require('../../models/Admin/Settings');

// Save delivery partner payment settings
exports.saveDeliveryPartnerPaymentSettings = async (req, res) => {
  try {
    const settingsData = req.body;

    // Basic validation
    if (!settingsData.baseAmount || !settingsData.perKmAmount || !settingsData.minimumPayout) {
      return res.status(400).json({
        success: false,
        message: "Base amount, per km amount, and minimum payout are required"
      });
    }

    const updatedSettings = await Settings.findOneAndUpdate(
      { key: 'delivery_partner_payment' },
      { value: settingsData, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: "Delivery partner payment settings updated successfully",
      data: updatedSettings.value
    });
  } catch (error) {
    console.error("Error saving delivery partner settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save settings",
      error: error.message
    });
  }
};

// Get current delivery partner payment settings
exports.getDeliveryPartnerPaymentSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne({ key: 'delivery_partner_payment' });

    // Default values if no settings exist yet
    const defaultSettings = {
      baseAmount: 50,
      perKmAmount: 10,
      minimumPayout: 60,
      peakHourBonus: 30,
      nightSurcharge: 30,
      badWeatherBonus: 25,
      codExtraFee: 10,
      isPeakHourActive: true,
      peakHoursStart: "18:00",
      peakHoursEnd: "23:00",
    };

    res.status(200).json({
      success: true,
      data: settings ? settings.value : defaultSettings
    });
  } catch (error) {
    console.error("Error fetching delivery partner settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
      error: error.message
    });
  }
};