const Rating = require('../../models/restaurants/RatingModels');
const Restaurant = require('../../models/restaurants/shops/RestaurantDetails');
const mongoose = require('mongoose');

exports.getReviews = async (req, res) => {
  try {
    const {
      restaurantId,
      ratings,
      search,
      startDate,
      tab = 'all',
      page = 1,
      limit = 10,
      countOnly = false,
    } = req.query;

    let query = {};

    // Restaurant ID filter
    if (restaurantId) {
      if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        return res.status(400).json({ success: false, message: 'Invalid restaurant ID' });
      }
      query.restaurantId = restaurantId;
    }

    // Ratings filter (support multiple ratings, e.g., "1,2")
    if (ratings) {
      const ratingArray = ratings.split(',').map((r) => parseInt(r.trim())).filter((r) => !isNaN(r));
      if (ratingArray.length > 0) {
        query.rating = { $in: ratingArray };
      }
    }

    // Search filter (include restaurantName)
    if (search) {
      const restaurants = await Restaurant.find(
        { restaurantName: { $regex: search, $options: 'i' } },
        '_id'
      );
      const restaurantIds = restaurants.map((r) => r._id);

      query.$or = [
        { review: { $regex: search, $options: 'i' } },
        { 'userId.name': { $regex: search, $options: 'i' } },
        { restaurantId: { $in: restaurantIds } },
      ];
    }

    // Single date filter (for the selected day)
    if (startDate) {
      try {
        const selectedDate = new Date(startDate);
        if (isNaN(selectedDate.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid date format' });
        }
        const start = new Date(selectedDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(selectedDate);
        end.setHours(23, 59, 59, 999);

        query.createdAt = {
          $gte: start,
          $lte: end,
        };
      } catch (error) {
        return res.status(400).json({ success: false, message: 'Invalid date format' });
      }
    }

    // Reported reviews filter
    if (tab === 'reported') {
      if (!ratings) {
        query.rating = { $in: [1, 2] };
      }
      // Optionally use reported flag if needed
      // query.reported = true;
    }

    // Handle countOnly for reported reviews count
    if (countOnly === 'true') {
      const count = await Rating.countDocuments(query);
      return res.status(200).json({ success: true, count });
    }

    // Fetch reviews with pagination
    const reviews = await Rating.find(query)
      .populate('userId', 'name')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Rating.countDocuments(query);

    // Format reviews
    const formattedReviews = await Promise.all(
      reviews.map(async (review) => {
        let restaurantName = 'Unknown';
        if (review.restaurantId) {
          const restaurant = await Restaurant.findById(review.restaurantId);
          restaurantName = restaurant ? restaurant.restaurantName : 'Unknown';
        }
        return {
          id: review._id.toString(),
          customerName: review.userId?.name || 'Anonymous',
          restaurantName,
          rating: review.rating || 0,
          reviewText: review.review || '',
          createdAt: review.createdAt ? review.createdAt.toISOString() : 'N/A',
          status: 'Published',
          reported: review.rating <= 2 || review.reported,
          orderId: review.foodId || 'N/A',
          reportReason: review.reportReason || '',
        };
      })
    );

    res.status(200).json({
      success: true,
      data: formattedReviews,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.sendAlert = async (req, res) => {
  const { restaurantId, message } = req.body;
  try {
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ success: false, message: 'Invalid restaurant ID' });
    }
    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Alert message is required' });
    }
    console.log(`Sending alert to restaurant ${restaurantId}: ${message}`);
    res.status(200).json({
      success: true,
      message: 'Alert sent successfully',
    });
  } catch (error) {
    console.error('Error sending alert:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};