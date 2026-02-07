const mongoose = require('mongoose');
const Payment = require('../../models/order/payment');
const Order = require('../../models/order/order');
const User = require('../../models/User/User');

// Helper function to format payment method for frontend
const formatPaymentMethod = (method) => {
  switch (method) {
    case 'cash': return 'Cash';
    case 'cards': return 'Credit Card';
    case 'upi': return 'UPI';
    case 'wallets': return 'Wallet';
    default: return method || 'Unknown';
  }
};

// Get payments for a specific restaurant
exports.getRestaurantPayments = async (req, res) => {
  try {
    const {
      restaurantId,
    } = req.params;
    const {
      dateRange = 'thisWeek',
      startDate,
      endDate,
      status,
      paymentMethod,
      search,
      sortField = 'date',
      sortDirection = 'desc',
      page = 1,
      limit = 10,
    } = req.query;

    // Validate restaurantId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid restaurant ID',
      });
    }

    const query = { 'order.restaurantId': new mongoose.Types.ObjectId(restaurantId) };

    // Apply status filter
    if (status && status !== 'all') {
      const statuses = status.split(',');
      query.paymentStatus = { $in: statuses };
    }

    // Apply payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      const methods = paymentMethod.split(',').map((m) => {
        const methodMap = {
          'Cash': 'cash',
          'Credit Card': 'cards',
          'UPI': 'upi',
          'Wallet': 'wallets',
        };
        return methodMap[m] || m;
      });
      query.paymentMethod = { $in: methods };
    }

    // Apply date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      let start;
      switch (dateRange) {
        case 'today':
          start = new Date(now.setHours(0, 0, 0, 0));
          query.createdAt = { $gte: start };
          break;
        case 'yesterday':
          start = new Date(now.setDate(now.getDate() - 1));
          start.setHours(0, 0, 0, 0);
          query.createdAt = {
            $gte: start,
            $lte: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1),
          };
          break;
        case 'thisWeek':
          start = new Date(now.setDate(now.getDate() - now.getDay()));
          start.setHours(0, 0, 0, 0);
          query.createdAt = { $gte: start };
          break;
        case 'thisMonth':
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          query.createdAt = { $gte: start };
          break;
        case 'custom':
          if (startDate && endDate) {
            query.createdAt = {
              $gte: new Date(startDate),
              $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
            };
          }
          break;
        default:
          break;
      }
    }

    // Apply search filter
    const searchQuery = {};
    if (search) {
      const term = search.trim();
      searchQuery.$or = [
        { paymentId: { $regex: term, $options: 'i' } },
        { orderId: { $regex: term, $options: 'i' } },
        { 'user.name': { $regex: term, $options: 'i' } },
      ];
    }

    // Aggregation pipeline
    const pipeline = [
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: 'orderId',
          as: 'order',
        },
      },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'order.userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $match: { ...query, ...searchQuery } },
      {
        $sort: {
          [sortField === 'amount' ? 'order.total' : 'createdAt']:
            sortDirection === 'asc' ? 1 : -1,
        },
      },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },
    ];

    const payments = await Payment.aggregate(pipeline);

    const formattedPayments = payments.map((payment) => ({
      id: payment.paymentId,
      orderId: payment.orderId,
      customer: payment.user?.name || 'Unknown',
      amount: payment.order?.total || 0,
      date: payment.createdAt
        ? new Date(payment.createdAt).toISOString().split('T')[0]
        : 'N/A',
      status: payment.paymentStatus.charAt(0).toUpperCase() + payment.paymentStatus.slice(1),
      paymentMethod: formatPaymentMethod(payment.paymentMethod),
      upiId: payment.paymentMethod === 'upi' ? payment.upiId : undefined,
      cardDetails:
        payment.paymentMethod === 'cards'
          ? {
              cardholderName: payment.cardholderName,
              cardExpiry: payment.cardExpiry,
              maskedCardNumber: payment.maskedCardNumber,
            }
          : undefined,
    }));

    // Calculate summary
    const summaryPipeline = [
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: 'orderId',
          as: 'order',
        },
      },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      { $match: { ...query, ...searchQuery } },
      {
        $group: {
          _id: '$paymentStatus',
          totalAmount: { $sum: '$order.total' },
          count: { $sum: 1 },
        },
      },
    ];

    const summaryResult = await Payment.aggregate(summaryPipeline);
    const summary = {
      total: 0,
      completed: 0,
      pending: 0,
      failed: 0,
      refunded: 0,
      totalTransactions: 0,
      completedTransactions: 0,
      pendingTransactions: 0,
      failedTransactions: 0,
      refundedTransactions: 0,
    };

    summaryResult.forEach((item) => {
      const status = item._id.toLowerCase();
      summary[status] = item.totalAmount || 0;
      summary[`${status}Transactions`] = item.count || 0;
      summary.total += item.totalAmount || 0;
      summary.totalTransactions += item.count || 0;
    });

    // Total count for pagination
    const totalPipeline = [
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: 'orderId',
          as: 'order',
        },
      },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      { $match: { ...query, ...searchQuery } },
      { $count: 'total' },
    ];
    const totalResult = await Payment.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: formattedPayments,
      summary,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('getRestaurantPayments: Error fetching payments', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message,
    });
  }
};
