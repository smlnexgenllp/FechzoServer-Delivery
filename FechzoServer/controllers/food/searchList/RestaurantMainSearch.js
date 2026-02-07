const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');
const mongoose = require('mongoose');

const searchMainRestaurants = async (req, res) => {
  try {
    const { name, limit = 10, skip = 0, excludeId } = req.query;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ message: "Name query must be at least 2 characters long" });
    }

    const query = {
      restaurantName: { $regex: name.trim(), $options: "i" },
    };

    // Use _id for exclusion if excludeId is provided
    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    // Filter out branches to only allow parent restaurants
    query.isBranch = { $ne: true };

    const restaurants = await Restaurant.find(query)
      .select('restaurantName _id restaurantId images.profile isBranch')
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const formattedRestaurants = restaurants.map(restaurant => ({
      id: restaurant._id.toString(), // Return MongoDB _id as string
      restaurantId: restaurant.restaurantId, // Include for display if needed
      name: restaurant.restaurantName,
      profileImage: restaurant.images?.profile || null,
      isBranch: restaurant.isBranch,
    }));

    res.status(200).json({ restaurants: formattedRestaurants });
  } catch (error) {
    console.error("Error searching restaurants:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  searchMainRestaurants,
};