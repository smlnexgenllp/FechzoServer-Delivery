const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');
const Rating = require('../../../models/restaurants/RatingModels');
const ActionLog = require('../../../models/restaurants/actionlogs/actionlogschema');


exports.getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find(
      { approvalStatus: "Approved" },
      {
        restaurantId: 1,
        restaurantName: 1,
        images: 1,
        cuisines: 1,
        approvalStatus: 1,
        discount: 1,
        _id: 1,
        "restaurantAddress": 1,
      }
    );

    // Fetch all active suspensions or blocks
    const activeActions = await ActionLog.find({
      type: { $in: ['suspension', 'block'] },
      status: 'active'
    });

    // Create a Set of restaurant IDs that are suspended or blocked
    const restrictedRestaurantIds = new Set(
      activeActions.map(action => action.restaurantId.toString())
    );

    // Filter out suspended or blocked restaurants
    const availableRestaurants = restaurants.filter(
      restaurant => !restrictedRestaurantIds.has(restaurant._id.toString())
    );

    const enrichedRestaurants = await Promise.all(
      availableRestaurants.map(async (restaurant) => {
        const { _id: restaurantObjectId, restaurantName } = restaurant;

        // Query ratings using the MongoDB ObjectId
        const ratings = await Rating.find({ restaurantId: restaurantObjectId });

        const reviewCount = ratings.length;

        const averageRating = reviewCount > 0
          ? (ratings.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1)
          : null;

        return {
          ...restaurant.toObject(),
          rating: averageRating ? parseFloat(averageRating) : 0,
          reviewCount,
        };
      })
    );

    res.status(200).json(enrichedRestaurants);

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch restaurants', error });
  }
};