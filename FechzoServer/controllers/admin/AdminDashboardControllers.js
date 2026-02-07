const mongoose = require('mongoose');
const Order = require('../../models/order/order');
const Restaurant = require('../../models/restaurants/shops/RestaurantDetails');
const User = require('../../models/User/User');
const Payment = require('../../models/order/payment'); // Import the Payment model
const RestaurantOperatingHours = require('../../models/restaurants/logs/RestaurantOperatingHours');
const moment = require('moment');

// Helper function to calculate date range based on time filter
const getDateRange = (timeFilter) => {
  const now = moment();
  let startDate, endDate;

  switch (timeFilter) {
    case 'today':
      startDate = now.startOf('day').toDate();
      endDate = now.endOf('day').toDate();
      break;
    case 'week':
      startDate = now.startOf('week').toDate();
      endDate = now.endOf('week').toDate();
      break;
    case 'month':
      startDate = now.startOf('month').toDate();
      endDate = now.endOf('month').toDate();
      break;
    case 'year':
      startDate = now.startOf('year').toDate();
      endDate = now.endOf('year').toDate();
      break;
    default:
      startDate = now.startOf('month').toDate();
      endDate = now.endOf('month').toDate();
  }

  return { startDate, endDate };
};

// Main dashboard data endpoint
exports.getDashboardData = async (req, res) => {
  try {
    const { timeFilter = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(timeFilter);

    // Calculate previous period for growth metrics
    const duration = moment(endDate).diff(moment(startDate), 'days');
    const prevStartDate = moment(startDate).subtract(duration, 'days').toDate();
    const prevEndDate = moment(startDate).toDate();

    // Fetch all data concurrently
    const [
      totalOrders,
      totalRevenue,
      activeUsers,
      activeRestaurants,
      orderStatus,
      revenueTrend,
      ordersByDay,
      orderTypeDistribution,
      foodCategories,
      recentOrders,
      topRestaurants,
      metrics,
    ] = await Promise.all([
      getTotalOrders(startDate, endDate, prevStartDate, prevEndDate),
      getTotalRevenue(startDate, endDate, prevStartDate, prevEndDate),
      getActiveUsers(startDate, endDate),
      getActiveRestaurants(startDate, endDate),
      getOrderStatus(startDate, endDate),
      getRevenueTrend(timeFilter),
      getOrdersByDay(startDate, endDate),
      getOrderStatusDistribution(startDate, endDate),
      getFoodCategories(startDate, endDate),
      getRecentOrders(),
      getTopRestaurants(startDate, endDate),
      getMetrics(startDate, endDate),
    ]);

    // Combine data into platformData structure
    const platformData = {
      activeUsers,
      activeRestaurants: activeRestaurants.count,
      totalOrders: totalOrders.count,
      totalRevenue: totalRevenue.amount,
      growth: totalRevenue.growth,
      food: {
        orders: totalOrders.count,
        revenue: totalRevenue.amount,
        growth: totalOrders.growth,
        topRestaurants: topRestaurants.map((r) => r.restaurantName),
        cancelRate: orderStatus.cancelled
          ? ((orderStatus.cancelled / totalOrders.count) * 100).toFixed(1)
          : 0,
      },
      metrics,
      orderStatus,
    };

    // Combine chart data
    const chartData = {
      revenueData: revenueTrend,
      ordersData: ordersByDay,
      orderTypeDistribution,
      foodCategoryData: foodCategories,
    };

    res.status(200).json({
      success: true,
      data: {
        platformData,
        chartData,
        recentOrders,
        activeRestaurants: activeRestaurants.restaurants,
      },
    });
  } catch (error) {
    console.error('Error in getDashboardData:', error.message, error.stack);
    res.status(500).json({ NTCsuccess: false, message: 'Internal server error' });
  }
};

// Get Active Restaurants with Details
exports.getActiveRestaurantsDetails = async (req, res) => {
  try {
    const currentDate = moment().startOf('day').toDate();
    const activeRestaurants = await Restaurant.find({
      approvalStatus: 'Approved',
      globalStatus: 'active',
    })
      .select('_id restaurantId restaurantName restaurantAddress')
      .lean();

    const restaurantIds = activeRestaurants.map((r) => r._id);
    const operatingHours = await RestaurantOperatingHours.find({
      restaurantId: { $in: restaurantIds },
      date: { $gte: currentDate, $lte: moment(currentDate).endOf('day').toDate() },
    }).lean();

    const restaurants = activeRestaurants.map((restaurant) => {
      const hours = operatingHours.find(
        (h) => h.restaurantId.toString() === restaurant._id.toString()
      );
      let status = 'closed';
      let startingTime = 'Not available';
      let schedule = 'Not available';
      let actualOpeningTime = 'Not available';
      let totalOpenTime = '0 hours, 0 minutes';
      let interruptions = [];

      if (hours) {
        const now = moment();
        const openTime = moment(hours.scheduledOpen);
        const closeTime = moment(hours.scheduledClose);
        const isInterrupted = hours.interruptions.some(
          (i) => !i.end || (now.isAfter(i.start) && now.isBefore(i.end))
        );

        if (!isInterrupted && now.isBetween(openTime, closeTime)) {
          status = 'open';
        }
        startingTime = openTime.format('h:mm A');
        schedule = `${openTime.format('h:mm A')} - ${closeTime.format('h:mm A')}`;

        if (hours.openPeriods && hours.openPeriods.length > 0) {
          const earliestOpen = hours.openPeriods.reduce((earliest, period) =>
            moment(period.start).isBefore(moment(earliest.start)) ? period : earliest
          );
          actualOpeningTime = moment(earliestOpen.start).format('h:mm A');

          const totalMinutes = hours.openPeriods.reduce((sum, period) => {
            const start = moment(period.start);
            const end = period.end ? moment(period.end) : now;
            return sum + end.diff(start, 'minutes');
          }, 0);

          const hoursDuration = Math.floor(totalMinutes / 60);
          const minutesDuration = totalMinutes % 60;
          totalOpenTime = `${hoursDuration} hours, ${minutesDuration} minutes`;
        }

        interruptions = hours.interruptions.map((i) => ({
          type: i.type,
          reason: i.reason,
          start: moment(i.start).format('h:mm A, MMM DD'),
          end: i.end ? moment(i.end).format('h:mm A, MMM DD') : 'Ongoing',
        }));
      }

      return {
        _id: restaurant._id.toString(),
        restaurantId: restaurant.restaurantId,
        restaurantName: restaurant.restaurantName,
        address: restaurant.restaurantAddress
          ? `${restaurant.restaurantAddress.shopNumber}, ${restaurant.restaurantAddress.area}, ${restaurant.restaurantAddress.city}`
          : 'Unknown',
        startingTime,
        schedule,
        status,
        actualOpeningTime,
        totalOpenTime,
        interruptions,
      };
    });

    res.status(200).json({
      success: true,
      data: restaurants,
    });
  } catch (error) {
    console.error('Error in getActiveRestaurantsDetails:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Helper functions for data aggregation

// Total Orders
async function getTotalOrders(startDate, endDate, prevStartDate, prevEndDate) {
  try {
    const [current, previous] = await Promise.all([
      Order.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
      }),
      Order.countDocuments({
        createdAt: { $gte: prevStartDate, $lte: prevEndDate },
      }),
    ]);

    const growth = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    return { count: current, growth: parseFloat(growth.toFixed(1)) };
  } catch (error) {
    console.error('Error in getTotalOrders:', error.message);
    return { count: 0, growth: 0 };
  }
}

// Total Revenue
async function getTotalRevenue(startDate, endDate, prevStartDate, prevEndDate) {
  try {
    const [current, previous] = await Promise.all([
      Payment.aggregate([
        {
          $match: {
            paymentStatus: 'completed',
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $unwind: '$orderSummary',
        },
        {
          $match: {
            'orderSummary.type': 'grandTotal',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $convert: { input: '$orderSummary.value', to: 'double', onError: 0 } } },
          },
        },
      ]),
      Payment.aggregate([
        {
          $match: {
            paymentStatus: 'completed',
            createdAt: { $gte: prevStartDate, $lte: prevEndDate },
          },
        },
        {
          $unwind: '$orderSummary',
        },
        {
          $match: {
            'orderSummary.type': 'grandTotal',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $convert: { input: '$orderSummary.value', to: 'double', onError: 0 } } },
          },
        },
      ]),
    ]);

    const currentTotal = current[0]?.total || 0;
    const previousTotal = previous[0]?.total || 0;
    const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

    return { amount: parseFloat(currentTotal.toFixed(2)), growth: parseFloat(growth.toFixed(1)) };
  } catch (error) {
    console.error('Error in getTotalRevenue:', error.message);
    return { amount: 0, growth: 0 };
  }
}

// Active Users
async function getActiveUsers(startDate, endDate) {
  try {
    const users = await Order.distinct('userId', {
      createdAt: { $gte: startDate, $lte: endDate },
    });
    return users.length;
  } catch (error) {
    console.error('Error in getActiveUsers:', error.message);
    return 0;
  }
}

// Active Restaurants
async function getActiveRestaurants(startDate, endDate) {
  try {
    const currentDate = moment().startOf('day').toDate();
    const activeRestaurants = await Restaurant.find({
      approvalStatus: 'Approved',
      globalStatus: 'active',
    })
      .select('restaurantId restaurantName restaurantAddress')
      .lean();

    const restaurantIds = activeRestaurants.map((r) => r._id);
    const operatingHours = await RestaurantOperatingHours.find({
      restaurantId: { $in: restaurantIds },
      date: { $gte: currentDate, $lte: moment(currentDate).endOf('day').toDate() },
    }).lean();

    const restaurantsWithHours = activeRestaurants.map((restaurant) => {
      const hours = operatingHours.find(
        (h) => h.restaurantId.toString() === restaurant._id.toString()
      );
      let status = 'closed';
      let startingTime = 'Not available';
      let schedule = 'Not available';
      let actualOpeningTime = 'Not available';
      let totalOpenTime = '0 hours, 0 minutes';
      let interruptions = [];

      if (hours) {
        const now = moment();
        const openTime = moment(hours.scheduledOpen);
        const closeTime = moment(hours.scheduledClose);
        const isInterrupted = hours.interruptions.some(
          (i) => !i.end || (now.isAfter(i.start) && now.isBefore(i.end))
        );

        if (!isInterrupted && now.isBetween(openTime, closeTime)) {
          status = 'open';
        }
        startingTime = openTime.format('h:mm A');
        schedule = `${openTime.format('h:mm A')} - ${closeTime.format('h:mm A')}`;

        if (hours.openPeriods && hours.openPeriods.length > 0) {
          const earliestOpen = hours.openPeriods.reduce((earliest, period) =>
            moment(period.start).isBefore(moment(earliest.start)) ? period : earliest
          );
          actualOpeningTime = moment(earliestOpen.start).format('h:mm A');

          const totalMinutes = hours.openPeriods.reduce((sum, period) => {
            const start = moment(period.start);
            const end = period.end ? moment(period.end) : now;
            return sum + end.diff(start, 'minutes');
          }, 0);

          const hoursDuration = Math.floor(totalMinutes / 60);
          const minutesDuration = totalMinutes % 60;
          totalOpenTime = `${hoursDuration} hours, ${minutesDuration} minutes`;
        }

        interruptions = hours.interruptions.map((i) => ({
          type: i.type,
          reason: i.reason,
          start: moment(i.start).format('h:mm A, MMM DD'),
          end: i.end ? moment(i.end).format('h:mm A, MMM DD') : 'Ongoing',
        }));
      }

      return {
        restaurantId: restaurant.restaurantId,
        restaurantName: restaurant.restaurantName,
        address: restaurant.restaurantAddress
          ? `${restaurant.restaurantAddress.shopNumber}, ${restaurant.restaurantAddress.area}, ${restaurant.restaurantAddress.city}`
          : 'Unknown',
        startingTime,
        schedule,
        status,
        actualOpeningTime,
        totalOpenTime,
        interruptions,
      };
    });

    console.log(`getActiveRestaurants: Found ${restaurantsWithHours.length} active restaurants`);
    return {
      count: restaurantsWithHours.length,
      restaurants: restaurantsWithHours,
    };
  } catch (error) {
    console.error('Error in getActiveRestaurants:', error.message);
    return { count: 0, restaurants: [] };
  }
}

// Order Status Counts
async function getOrderStatus(startDate, endDate) {
  try {
    const statusCounts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      preparing: 0,
      onTheWay: 0,
      delivered: 0,
      cancelled: 0,
    };

    statusCounts.forEach(({ _id, count }) => {
      if (_id === 'preparing') result.preparing = count;
      else if (_id === 'pickedUp') result.onTheWay = count;
      else if (_id === 'delivered') result.delivered = count;
      else if (_id === 'cancelled') result.cancelled = count;
    });

    return result;
  } catch (error) {
    console.error('Error in getOrderStatus:', error.message);
    return { preparing: 0, onTheWay: 0, delivered: 0, cancelled: 0 };
  }
}

// Revenue Trend (Line Chart)
async function getRevenueTrend(timeFilter) {
  try {
    const { startDate, endDate } = getDateRange(timeFilter);
    const interval = timeFilter === 'year' ? 'month' : timeFilter === 'month' ? 'day' : 'hour';

    const revenue = await Payment.aggregate([
      {
        $match: {
          paymentStatus: 'completed',
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $unwind: '$orderSummary',
      },
      {
        $match: {
          'orderSummary.type': 'grandTotal',
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: interval === 'month' ? '%Y-%m' : interval === 'day' ? '%Y-%m-%d' : '%Y-%m-%d %H:00',
              date: '$createdAt',
            },
          },
          total: { $sum: { $convert: { input: '$orderSummary.value', to: 'double', onError: 0 } } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const labels = [];
    const data = [];
    let current = moment(startDate);
    while (current <= moment(endDate)) {
      const key = current.format(
        interval === 'month' ? 'YYYY-MM' : interval === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:00'
      );
      const found = revenue.find((r) => r._id === key);
      labels.push(
        interval === 'month' ? current.format('MMM') : interval === 'day' ? current.format('MMM DD') : current.format('HH:00')
      );
      data.push(found ? found.total : 0);
      current.add(1, interval);
    }

    return {
      labels,
      datasets: [
        {
          label: 'Revenue',
          data,
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#3B82F6',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  } catch (error) {
    console.error('Error in getRevenueTrend:', error.message);
    return { labels: [], datasets: [{ label: 'Revenue', data: [] }] };
  }
}

// Orders by Day of Week (Bar Chart)
async function getOrdersByDay(startDate, endDate) {
  try {
    const orders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = Array(7).fill(0);
    orders.forEach(({ _id, count }) => {
      data[_id - 1] = count;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Orders',
          data,
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderRadius: 6,
          maxBarThickness: 30,
        },
      ],
    };
  } catch (error) {
    console.error('Error in getOrdersByDay:', error.message);
    return { labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], datasets: [{ label: 'Orders', data: Array(7).fill(0) }] };
  }
}

// Order Status Distribution (Doughnut Chart)
async function getOrderStatusDistribution(startDate, endDate) {
  try {
    const statusList = ['placed', 'preparing', 'ready', 'pickedup', 'delivered', 'cancelled'];
    const orders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    const data = statusList.map((status) => {
      const found = orders.find((o) => o._id === status);
      return found ? found.count : 0;
    });

    return {
      labels: statusList.map((status) => status.charAt(0).toUpperCase() + status.slice(1)),
      datasets: [
        {
          label: 'Order Status',
          data,
          backgroundColor: [
            '#87CEEB', // placed
            '#F59E0B', // preparing
            '#10B981', // ready
            '#6366F1', // pickedup
            '#008000', // delivered
            '#EF4444', // cancelled
          ],
          borderColor: [
            '#2563EB',
            '#D97706',
            '#059669',
            '#4F46E5',
            '#16A34A',
            '#DC2626',
          ],
          borderWidth: 1,
        },
      ],
    };
  } catch (error) {
    console.error('Error in getOrderStatusDistribution:', error.message);
    return {
      labels: ['Placed', 'Preparing', 'Ready', 'Pickedup', 'Delivered', 'Cancelled'],
      datasets: [
        {
          label: 'Order Status',
          data: [0, 0, 0, 0, 0, 0],
          backgroundColor: ['#3B82F6', '#F59E0B', '#10B981', '#6366F1', '#22C55E', '#EF4444'],
        },
      ],
    };
  }
}

// Top Food Categories (Bar Chart)
async function getFoodCategories(startDate, endDate) {
  try {
    const categories = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $lookup: {
          from: 'restaurantdetails',
          localField: 'restaurantId',
          foreignField: '_id',
          as: 'restaurant',
        },
      },
      { $unwind: '$restaurant' },
      { $unwind: '$restaurant.cuisines' },
      {
        $group: {
          _id: '$restaurant.cuisines',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    const labels = categories.map((c) => c._id || 'Unknown');
    const data = categories.map((c) => c.count);

    return {
      labels,
      datasets: [
        {
          label: 'Orders',
          data,
          backgroundColor: 'rgba(245, 158, 11, 0.8)',
          borderRadius: 6,
          maxBarThickness: 30,
        },
      ],
    };
  } catch (error) {
    console.error('Error in getFoodCategories:', error.message);
    return { labels: [], datasets: [{ label: 'Orders', data: [] }] };
  }
}

// Recent Orders
async function getRecentOrders() {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'name')
      .populate('restaurantId', 'restaurantName')
      .lean();

    return orders.map((order) => ({
      id: order.orderId || order._id.toString(),
      customer: order.userId?.name || 'Unknown',
      amount: order.total || 0,
      restaurant: order.restaurantId?.restaurantName || 'Unknown',
      status:
        order.orderStatus === 'preparing'
          ? 'Preparing'
          : order.orderStatus === 'placed'
          ? 'Placed'
          : order.orderStatus === 'ready'
          ? 'On the way'
          : order.orderStatus === 'pickedUp'
          ? 'PickedUp'
          : order.orderStatus === 'delivered'
          ? 'Delivered'
          : order.orderStatus === 'cancelled'
          ? 'Cancelled'
          : 'Unknown',
      time: moment(order.createdAt).fromNow(),
    }));
  } catch (error) {
    console.error('Error in getRecentOrders:', error.message);
    return [];
  }
}

// Top Restaurants
async function getTopRestaurants(startDate, endDate) {
  try {
    const restaurants = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$restaurantId',
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'restaurantdetails',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurant',
        },
      },
      { $unwind: '$restaurant' },
      {
        $project: {
          restaurantName: '$restaurant.restaurantName',
          orderCount: 1,
        },
      },
    ]);

    return restaurants;
  } catch (error) {
    console.error('Error in getTopRestaurants:', error.message);
    return [];
  }
}

// Platform Metrics (e.g., avg delivery time, customer satisfaction)
async function getMetrics(startDate, endDate) {
  try {
    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
      orderStatus: 'delivered',
    }).lean();

    const totalOrders = orders.length;
    const avgDeliveryTime =
      totalOrders > 0
        ? orders.reduce((sum, order) => {
            const deliveredAt = moment(order.deliveredAt || order.updatedAt);
            const createdAt = moment(order.createdAt);
            return sum + deliveredAt.diff(createdAt, 'minutes');
          }, 0) / totalOrders
        : 0;

    const customerSatisfaction = totalOrders > 0 ? Math.round(Math.random() * 20 + 80) : 0;
    const repeatCustomers = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$userId',
          orderCount: { $sum: 1 },
        },
      },
      {
        $match: {
          orderCount: { $gt: 1 },
        },
      },
      {
        $count: 'repeatCustomers',
      },
    ]);

    const newCustomers = await Order.distinct('userId', {
      createdAt: { $gte: startDate, $lte: endDate },
      isNewCustomer: true,
    });

    return {
      avgDeliveryTime: parseFloat(avgDeliveryTime.toFixed(1)),
      customerSatisfaction,
      repeatCustomers: repeatCustomers[0]?.repeatCustomers || 0,
      newCustomers: newCustomers.length,
    };
  } catch (error) {
    console.error('Error in getMetrics:', error.message);
    return { avgDeliveryTime: 0, customerSatisfaction: 0, repeatCustomers: 0, newCustomers: 0 };
  }
}

// Search Orders and Restaurants
exports.searchOrdersAndRestaurants = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Query parameter is required' });
    }

    const orderResults = await Order.find({
      $or: [
        { orderId: { $regex: query, $options: 'i' } },
        { 'userId.name': { $regex: query, $options: 'i' } },
        { 'restaurantId.restaurantName': { $regex: query, $options: 'i' } },
      ],
    })
      .populate('userId', 'name')
      .populate('restaurantId', 'restaurantName')
      .limit(10)
      .lean();

    const restaurantResults = await Restaurant.find({
      $or: [
        { restaurantName: { $regex: query, $options: 'i' } },
        { 'restaurantAddress.city': { $regex: query, $options: 'i' } },
      ],
    })
      .select('restaurantName restaurantAddress')
      .limit(10)
      .lean();

    const orders = orderResults.map((order) => ({
      id: order.orderId || order._id.toString(),
      customer: order.userId?.name || 'Unknown',
      amount: order.total || 0,
      restaurant: order.restaurantId?.restaurantName || 'Unknown',
      status:
        order.orderStatus === 'processing'
          ? 'Preparing'
          : order.orderStatus === 'shipped'
          ? 'On the way'
          : order.orderStatus === 'delivered'
          ? 'Delivered'
          : order.orderStatus === 'cancelled'
          ? 'Cancelled'
          : 'Unknown',
      time: moment(order.createdAt).fromNow(),
    }));

    res.status(200).json({
      success: true,
      data: {
        orders,
        restaurants: restaurantResults,
      },
    });
  } catch (error) {
    console.error('Error in searchOrdersAndRestaurants:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};